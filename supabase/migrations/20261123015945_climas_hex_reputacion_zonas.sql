-- =====================================================================
-- RedClima · v3
--  · 8 tipos de clima (de menos a más intenso)
--  · Zonas hexagonales fijas (~500 m) con "último dato" atenuado (30–60 min)
--  · Reputación automática: pesa menos quien casi nunca coincide con sus vecinos
--  · Ocultar automáticamente lo que denuncian 3+ vecinos
--  · Con un reporte vigente se puede consultar cualquier lugar (buscador)
--  · Zonas de interés con avisos
--  · Embudo de conversión (anónimo)
--  · Niveles más exigentes: 500 / 1000 / 2000 / 4000 XP para subir
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos de clima nuevos
-- ---------------------------------------------------------------------
alter type public.clima_tipo add value if not exists 'parcial' after 'soleado';
alter type public.clima_tipo add value if not exists 'niebla' after 'nublado';
alter type public.clima_tipo add value if not exists 'llovizna' after 'niebla';
alter type public.clima_tipo add value if not exists 'granizo' after 'tormenta';

-- Nombre visible de cada tipo (para los avisos)
create function public.etiqueta_clima (p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'soleado' then 'Soleado'
    when 'parcial' then 'Sol y nubes'
    when 'nublado' then 'Nublado'
    when 'niebla' then 'Neblina'
    when 'llovizna' then 'Llovizna'
    when 'lluvia' then 'Lluvia'
    when 'tormenta' then 'Tormenta eléctrica'
    when 'granizo' then 'Granizo'
    else p_tipo
  end;
$$;

-- Familias para medir acuerdo: "sol y nubes" no contradice a "soleado"
create function public.familia_clima (p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tipo in ('soleado', 'parcial') then 'seco'
    when p_tipo in ('nublado', 'niebla') then 'gris'
    when p_tipo in ('llovizna', 'lluvia') then 'agua'
    else 'fuerte'
  end;
$$;

-- ---------------------------------------------------------------------
-- Niveles: 500 / 1000 / 2000 / 4000 XP para subir (acumulado 500/1500/3500/7500)
-- Debe coincidir con src/constants/niveles.js
-- ---------------------------------------------------------------------
create or replace function public.nivel_de_xp (p_xp integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_xp >= 7500 then 5
    when p_xp >= 3500 then 4
    when p_xp >= 1500 then 3
    when p_xp >= 500 then 2
    else 1
  end;
$$;

-- ---------------------------------------------------------------------
-- Reputación: cuántas veces coincidió cada usuario con sus vecinos
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column acuerdo_n integer not null default 0,
  add column acuerdo_si integer not null default 0;

-- Factor de peso del voto: nuevo ≈ 1.0 · siempre coincide → 1.33 · nunca → 0.25
create function public.peso_reputacion (p_n integer, p_si integer, p_verificado boolean)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select least(1.34, greatest(0.2, ((p_si + 3.0) / (p_n + 4.0)) / 0.75))
         * case when p_verificado then 1.5 else 1 end;
$$;

-- ---------------------------------------------------------------------
-- Zonas de interés
-- ---------------------------------------------------------------------
create table public.zonas_interes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 30),
  ubicacion extensions.geography (point, 4326) not null,
  creado_en timestamptz not null default now(),
  ultimo_aviso_en timestamptz,
  ultimo_aviso_tipo text
);

create index zonas_interes_ubicacion_idx on public.zonas_interes using gist (ubicacion);
create index zonas_interes_usuario_idx on public.zonas_interes (usuario_id);

alter table public.zonas_interes enable row level security;

create policy "Cada usuario ve sus zonas de interés"
  on public.zonas_interes for select to authenticated
  using ((select auth.uid()) = usuario_id);

revoke all on public.zonas_interes from anon, authenticated;
grant select on public.zonas_interes to authenticated;

create function public.guardar_zona_interes (p_nombre text, p_lat double precision, p_lng double precision)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_nombre is null or char_length(trim(p_nombre)) not between 1 and 30 then
    raise exception 'Ponle un nombre corto a la zona (máximo 30 caracteres)';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación inválida';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('zonas:' || v_uid::text, 0));
  if (select count(*) from public.zonas_interes where usuario_id = v_uid) >= 5 then
    raise exception 'Puedes tener hasta 5 zonas de interés. Borra una para añadir otra.';
  end if;
  -- se guarda redondeada a ~100 m
  insert into public.zonas_interes (usuario_id, nombre, ubicacion)
  values (v_uid, trim(p_nombre),
          extensions.st_setsrid(extensions.st_makepoint(round(p_lng::numeric, 3), round(p_lat::numeric, 3)), 4326)::extensions.geography)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.eliminar_zona_interes (p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.zonas_interes where id = p_id and usuario_id = auth.uid();
$$;

-- Estado actual de mis zonas (último dato de la comunidad, una persona = un voto)
create function public.mis_zonas_interes ()
returns table (
  id bigint,
  nombre text,
  lat double precision,
  lng double precision,
  tipo text,
  personas integer,
  confianza real,
  actualizado_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select z.id, z.nombre,
         extensions.st_y(z.ubicacion::extensions.geometry),
         extensions.st_x(z.ubicacion::extensions.geometry),
         e.tipo, coalesce(e.personas, 0), e.confianza, e.actualizado_en
    from public.zonas_interes z
    left join lateral (
      with ultimos as (
        select distinct on (r.usuario_id) r.usuario_id, r.tipo::text as tipo, r.creado_en,
               public.peso_reputacion(p.acuerdo_n, p.acuerdo_si, p.verificado) as peso
          from public.reportes r
          join public.perfiles p on p.id = r.usuario_id
         where r.creado_en > now() - interval '60 minutes'
           and not r.oculto
           and extensions.st_dwithin(r.ubicacion, z.ubicacion, 700)
         order by r.usuario_id, r.creado_en desc
      ),
      votos as (
        select u.tipo, sum(u.peso) as puntaje from ultimos u group by u.tipo
      )
      select (select v.tipo from votos v order by v.puntaje desc limit 1) as tipo,
             (select count(*)::integer from ultimos) as personas,
             (select round(((select max(puntaje) from votos) / nullif(sum(peso), 0))::numeric, 2)::real from ultimos) as confianza,
             (select date_trunc('minute', max(creado_en)) from ultimos) as actualizado_en
    ) e on true
   where z.usuario_id = auth.uid()
   order by z.creado_en;
$$;

-- ---------------------------------------------------------------------
-- Al crear un reporte: medir acuerdo con vecinos y avisar a zonas de interés
-- ---------------------------------------------------------------------
create function public._al_crear_reporte ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mayoria text;
  v_peso numeric;
begin
  -- 1) ¿Coincide con lo que reportan otras personas a < 1 km en los últimos 15 min?
  select f.familia into v_mayoria
    from (
      select distinct on (o.usuario_id) public.familia_clima(o.tipo::text) as familia
        from public.reportes o
       where o.usuario_id <> new.usuario_id
         and not o.oculto
         and o.creado_en > now() - interval '15 minutes'
         and extensions.st_dwithin(o.ubicacion, new.ubicacion, 1000)
       order by o.usuario_id, o.creado_en desc
    ) f
   group by f.familia
   order by count(*) desc
   limit 1;

  if v_mayoria is not null then
    update public.perfiles
       set acuerdo_n = acuerdo_n + 1,
           acuerdo_si = acuerdo_si + case when public.familia_clima(new.tipo::text) = v_mayoria then 1 else 0 end
     where id = new.usuario_id;
  end if;

  -- 2) Avisar a quienes tienen una zona de interés cerca (si el reportero es confiable)
  select public.peso_reputacion(p.acuerdo_n, p.acuerdo_si, p.verificado) into v_peso
    from public.perfiles p where p.id = new.usuario_id;

  if v_peso >= 0.65 then
    with avisar as (
      update public.zonas_interes z
         set ultimo_aviso_en = now(), ultimo_aviso_tipo = new.tipo::text
       where z.usuario_id <> new.usuario_id
         and extensions.st_dwithin(z.ubicacion, new.ubicacion, 700)
         and (z.ultimo_aviso_en is null
              or z.ultimo_aviso_en < now() - interval '30 minutes'
              or z.ultimo_aviso_tipo is distinct from new.tipo::text)
      returning z.usuario_id, z.nombre
    )
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo)
    select a.usuario_id, 'zona_interes',
           format('%s en %s', public.etiqueta_clima(new.tipo::text), a.nombre),
           'Alguien acaba de reportar el clima cerca de tu zona de interés.'
      from avisar a;
  end if;

  return new;
end;
$$;

revoke execute on function public._al_crear_reporte () from public, anon, authenticated;

create trigger reportes_al_crear
  after insert on public.reportes
  for each row execute function public._al_crear_reporte ();

-- ---------------------------------------------------------------------
-- Consultar cualquier lugar mientras tengas un reporte vigente
-- (antes: solo 5 km alrededor de donde reportaste)
-- ---------------------------------------------------------------------
create or replace function public._centro_permitido (p_lat double precision, p_lng double precision)
returns extensions.geography
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación inválida';
  end if;
  if not exists (select 1 from public.reportes r
                  where r.usuario_id = auth.uid() and r.expira_en > now()) then
    raise exception 'Reporta el clima en tu zona para ver el mapa';
  end if;
  return extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
end;
$$;

-- ---------------------------------------------------------------------
-- Hexágonos: celda (q, r) de ~500 m en Web Mercator (puntiagudos arriba)
-- ---------------------------------------------------------------------
create function public._hex (p_x double precision, p_y double precision, p_s double precision)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  fq double precision := (sqrt(3.0) / 3 * p_x - p_y / 3) / p_s;
  fr double precision := (2.0 / 3 * p_y) / p_s;
  fs double precision := -fq - fr;
  q double precision := round(fq);
  r double precision := round(fr);
  s double precision := round(fs);
begin
  if abs(q - fq) > abs(r - fr) and abs(q - fq) > abs(s - fs) then
    q := -r - s;
  elsif abs(r - fr) > abs(s - fs) then
    r := -q - s;
  end if;
  return array[q::integer, r::integer];
end;
$$;

-- Zonas: hexágonos, una persona = un voto, peso por reputación,
-- datos frescos (≤ 30 min) y "último dato" atenuado (30–60 min).
-- Función nueva (no se borra zonas_cercanas: así la migración no elimina nada
-- y la versión anterior de la web sigue funcionando mientras se publica).
create function public.zonas_hex (
  p_lat double precision,
  p_lng double precision,
  p_radio_m integer default 20000
)
returns table (
  tipo public.clima_tipo,
  lat double precision,
  lng double precision,
  radio_m integer,
  reportes integer,
  confianza real,
  actualizado_en timestamptz,
  reciente boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_centro extensions.geography := public._centro_permitido(p_lat, p_lng);
  v_lado constant double precision := 500;  -- metros del centro a cada vértice
begin
  return query
  with ultimos as (
    -- una persona, un voto: su reporte más reciente de la última hora
    select distinct on (r.usuario_id)
           r.usuario_id, r.tipo, r.creado_en,
           r.expira_en > now() as fresco,
           public.peso_reputacion(p.acuerdo_n, p.acuerdo_si, p.verificado) as peso,
           public._hex(
             extensions.st_x(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)),
             extensions.st_y(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)),
             v_lado) as celda
      from public.reportes r
      join public.perfiles p on p.id = r.usuario_id
     where r.creado_en > now() - interval '60 minutes'
       and not r.oculto
       and extensions.st_dwithin(r.ubicacion, v_centro, least(greatest(p_radio_m, 1000), 20000))
     order by r.usuario_id, r.creado_en desc
  ),
  celdas as (
    select u.celda, count(*) filter (where u.fresco) as frescos
      from ultimos u group by u.celda
  ),
  usados as (
    -- con 2+ personas frescas (≤ 30 min) solo cuentan esas; si no, se combinan
    -- con el último dato (30–60 min) y la zona se muestra atenuada
    select u.* from ultimos u join celdas c on c.celda = u.celda
     where u.fresco or c.frescos < 2
  ),
  visibles as (
    -- privacidad: 2+ personas, o solo tú
    select x.celda from usados x group by x.celda
    having count(*) >= 2 or bool_and(x.usuario_id = v_uid)
  ),
  votos as (
    select x.celda, x.tipo as tipo_voto, sum(x.peso) as puntaje
      from usados x join visibles v on v.celda = x.celda
     group by x.celda, x.tipo
  ),
  ganador as (
    select distinct on (vo.celda) vo.celda, vo.tipo_voto, vo.puntaje
      from votos vo order by vo.celda, vo.puntaje desc
  )
  select g.tipo_voto,
         -- centro fijo del hexágono (no revela dónde estaba nadie)
         extensions.st_y(extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint(
           v_lado * sqrt(3.0) * (g.celda[1] + g.celda[2] / 2.0), v_lado * 1.5 * g.celda[2]), 3857), 4326)),
         extensions.st_x(extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint(
           v_lado * sqrt(3.0) * (g.celda[1] + g.celda[2] / 2.0), v_lado * 1.5 * g.celda[2]), 3857), 4326)),
         v_lado::integer,
         count(*)::integer,
         round((g.puntaje / sum(x.peso))::numeric, 2)::real,
         date_trunc('minute', max(x.creado_en)),
         bool_and(x.fresco)
    from usados x
    join ganador g on g.celda = x.celda
   group by g.celda, g.tipo_voto, g.puntaje;
end;
$$;

revoke execute on function public.zonas_hex (double precision, double precision, integer) from public, anon;
grant execute on function public.zonas_hex (double precision, double precision, integer) to authenticated;

-- ---------------------------------------------------------------------
-- Denuncias: si 3+ vecinos denuncian el mismo clima en la misma zona en
-- 30 min, se ocultan esos reportes (no los de verificados) y queda registrado
-- ---------------------------------------------------------------------
create or replace function public.crear_ticket (
  p_categoria public.ticket_categoria,
  p_mensaje text,
  p_contexto jsonb default '{}',
  p_lat double precision default null,
  p_lng double precision default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_contexto jsonb := coalesce(p_contexto, '{}');
  v_prioridad smallint := 2;
  v_id bigint;
  v_denunciantes integer;
  v_ocultos integer;
  v_tipo text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if not exists (select 1 from public.perfiles where id = v_uid) then
    raise exception 'Primero debes elegir tu nombre de usuario';
  end if;
  if p_mensaje is null or char_length(trim(p_mensaje)) not between 5 and 2000 then
    raise exception 'Escribe entre 5 y 2000 caracteres';
  end if;
  if jsonb_typeof(v_contexto) <> 'object' or pg_column_size(v_contexto) > 4000 then
    v_contexto := '{}';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ticket:' || v_uid::text, 0));
  if (select count(*) from public.tickets where usuario_id = v_uid and creado_en > now() - interval '1 hour') >= 3
     or (select count(*) from public.tickets where usuario_id = v_uid and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Ya nos enviaste varios mensajes. Inténtalo de nuevo más tarde.';
  end if;

  if p_lat is not null and p_lng is not null
     and p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_contexto := v_contexto || jsonb_build_object(
      'zona', jsonb_build_object('lat', round(p_lat::numeric, 3), 'lng', round(p_lng::numeric, 3)));
  end if;

  if p_categoria = 'cuenta_privacidad' then
    v_prioridad := 3;
  elsif p_categoria = 'reporte_falso' and v_contexto ? 'zona' and (
    select count(*) from public.tickets t
     where t.categoria = 'reporte_falso'
       and t.creado_en > now() - interval '2 hours'
       and t.usuario_id <> v_uid
       and t.contexto ? 'zona'
       and abs((t.contexto -> 'zona' ->> 'lat')::numeric - (v_contexto -> 'zona' ->> 'lat')::numeric) <= 0.01
       and abs((t.contexto -> 'zona' ->> 'lng')::numeric - (v_contexto -> 'zona' ->> 'lng')::numeric) <= 0.01
  ) >= 2 then
    v_prioridad := 3;
  elsif p_categoria = 'sugerencia' then
    v_prioridad := 1;
  end if;

  insert into public.tickets (usuario_id, categoria, prioridad, contexto)
  values (v_uid, p_categoria, v_prioridad, v_contexto)
  returning id into v_id;

  insert into public.ticket_mensajes (ticket_id, autor_id, cuerpo)
  values (v_id, v_uid, trim(p_mensaje));

  -- Ocultar automáticamente lo que denuncian 3+ vecinos
  v_tipo := v_contexto ->> 'zona_tipo';
  if p_categoria = 'reporte_falso' and v_contexto ? 'zona' and v_tipo is not null then
    select count(distinct t.usuario_id) into v_denunciantes
      from public.tickets t
     where t.categoria = 'reporte_falso'
       and t.creado_en > now() - interval '30 minutes'
       and t.contexto ->> 'zona_tipo' = v_tipo
       and abs((t.contexto -> 'zona' ->> 'lat')::numeric - (v_contexto -> 'zona' ->> 'lat')::numeric) <= 0.006
       and abs((t.contexto -> 'zona' ->> 'lng')::numeric - (v_contexto -> 'zona' ->> 'lng')::numeric) <= 0.006;

    if v_denunciantes >= 3 then
      with ocultados as (
        update public.reportes r
           set oculto = true, oculto_motivo = 'Denunciado por 3 o más vecinos'
          from public.perfiles p
         where p.id = r.usuario_id
           and not p.verificado
           and not r.oculto
           and r.tipo::text = v_tipo
           and r.creado_en > now() - interval '60 minutes'
           and extensions.st_dwithin(r.ubicacion,
                 extensions.st_setsrid(extensions.st_makepoint(
                   (v_contexto -> 'zona' ->> 'lng')::double precision,
                   (v_contexto -> 'zona' ->> 'lat')::double precision), 4326)::extensions.geography, 800)
        returning r.id
      )
      select count(*) into v_ocultos from ocultados;

      if v_ocultos > 0 then
        update public.tickets set prioridad = 4 where id = v_id;
        insert into public.ticket_mensajes (ticket_id, autor_id, es_staff, cuerpo, interno)
        values (v_id, null, true,
                format('Sistema: %s vecinos denunciaron "%s" aquí; se ocultaron %s reporte(s). Revísalo en Reportes › Solo ocultos.',
                       v_denunciantes, public.etiqueta_clima(v_tipo), v_ocultos), true);
        insert into public.acciones_moderacion (staff_id, staff_username, ticket_id, accion, motivo, detalle)
        values (null, 'sistema', v_id, 'ocultar_por_denuncias',
                format('%s vecinos denunciaron "%s"', v_denunciantes, public.etiqueta_clima(v_tipo)),
                jsonb_build_object('reportes_ocultos', v_ocultos, 'zona', v_contexto -> 'zona'));
      end if;
    end if;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Embudo de conversión (anónimo: un id aleatorio por navegador)
-- landing → clic "Ver el mapa" → login → registro → primer reporte
-- ---------------------------------------------------------------------
create table public.eventos_embudo (
  sesion uuid not null,
  paso text not null check (paso in ('landing', 'clic_ver_mapa', 'login', 'registro', 'primer_reporte')),
  creado_en timestamptz not null default now(),
  primary key (sesion, paso)
);

create index eventos_embudo_fecha_idx on public.eventos_embudo (creado_en);

alter table public.eventos_embudo enable row level security;
revoke all on public.eventos_embudo from anon, authenticated;

create function public.registrar_paso (p_sesion uuid, p_paso text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.eventos_embudo (sesion, paso)
  select p_sesion, p_paso
   where p_sesion is not null
     and p_paso in ('landing', 'clic_ver_mapa', 'login', 'registro', 'primer_reporte')
  on conflict do nothing;
$$;

create function public.admin_embudo (p_horas integer default 168)
returns table (paso text, sesiones integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.es_staff() then
    raise exception 'No autorizado';
  end if;
  return query
  select p.paso, coalesce(c.n, 0)::integer
    from unnest(array['landing', 'clic_ver_mapa', 'login', 'registro', 'primer_reporte'])
         with ordinality as p(paso, orden)
    left join (
      select e.paso, count(*) as n from public.eventos_embudo e
       where e.creado_en > now() - make_interval(hours => least(greatest(coalesce(p_horas, 168), 1), 24 * 90))
       group by e.paso
    ) c on c.paso = p.paso
   order by p.orden;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke execute on function
  public.guardar_zona_interes (text, double precision, double precision),
  public.eliminar_zona_interes (bigint),
  public.mis_zonas_interes (),
  public.registrar_paso (uuid, text),
  public.admin_embudo (integer),
  public._hex (double precision, double precision, double precision)
from public, anon;

grant execute on function
  public.guardar_zona_interes (text, double precision, double precision),
  public.eliminar_zona_interes (bigint),
  public.mis_zonas_interes (),
  public.registrar_paso (uuid, text),
  public.admin_embudo (integer)
to authenticated;

-- El primer paso del embudo ocurre antes de iniciar sesión
grant execute on function public.registrar_paso (uuid, text) to anon;
grant execute on function
  public.etiqueta_clima (text),
  public.familia_clima (text),
  public.peso_reputacion (integer, integer, boolean)
to anon, authenticated;
