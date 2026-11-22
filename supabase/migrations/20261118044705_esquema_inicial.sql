-- =====================================================================
-- RedClima · Esquema inicial
-- Reglas: reportes duran 1 hora; zonas por mayoría ponderada por recencia;
-- un reporte cada 10 min por usuario; precisión GPS máx. 500 m;
-- nunca se expone la ubicación exacta de nadie (solo zonas redondeadas).
-- =====================================================================

create extension if not exists postgis with schema extensions;

create type public.clima_tipo as enum ('soleado', 'nublado', 'lluvia', 'tormenta');

-- ---------------------------------------------------------------------
-- Perfiles (1 a 1 con auth.users). Solo se crean/modifican vía funciones.
-- ---------------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,20}$'),
  username_cambiado_en timestamptz not null default now(),
  xp integer not null default 0,
  total_reportes integer not null default 0,
  creado_en timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create policy "Cada usuario ve su propio perfil"
  on public.perfiles for select to authenticated
  using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------
-- Reportes de clima
-- ---------------------------------------------------------------------
create table public.reportes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo public.clima_tipo not null,
  ubicacion extensions.geography (point, 4326) not null,
  precision_m real,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null default now() + interval '1 hour'
);

create index reportes_ubicacion_idx on public.reportes using gist (ubicacion);
create index reportes_expira_idx on public.reportes (expira_en);
create index reportes_usuario_idx on public.reportes (usuario_id, creado_en desc);

alter table public.reportes enable row level security;

create policy "Cada usuario ve sus propios reportes"
  on public.reportes for select to authenticated
  using ((select auth.uid()) = usuario_id);

-- ---------------------------------------------------------------------
-- Mensajes de soporte
-- ---------------------------------------------------------------------
create table public.mensajes_soporte (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid () references public.perfiles (id) on delete cascade,
  asunto text not null check (asunto in ('error', 'sugerencia', 'otro')),
  mensaje text not null check (char_length(mensaje) between 5 and 2000),
  creado_en timestamptz not null default now()
);

create index mensajes_soporte_usuario_idx on public.mensajes_soporte (usuario_id);

alter table public.mensajes_soporte enable row level security;

create policy "Cada usuario envía sus propios mensajes"
  on public.mensajes_soporte for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

-- =====================================================================
-- Funciones (RPC)
-- =====================================================================

-- ¿Está libre un nombre de usuario?
create function public.username_disponible (p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.perfiles where username = lower(p_username));
$$;

-- Crear el perfil del usuario autenticado
create function public.crear_perfil (p_username text)
returns public.perfiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  insert into public.perfiles (id, username)
  values (auth.uid(), lower(p_username))
  returning * into v_perfil;

  return v_perfil;
exception
  when unique_violation then
    if exists (select 1 from public.perfiles where id = auth.uid()) then
      raise exception 'Ya tienes un perfil creado';
    end if;
    raise exception 'Ese nombre de usuario ya está en uso';
  when check_violation then
    raise exception 'Nombre inválido: entre 3 y 20 caracteres (a-z, 0-9, _ - .)';
end;
$$;

-- Cambiar el nombre de usuario (máximo una vez cada 7 días)
create function public.cambiar_username (p_username text)
returns public.perfiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles;
  v_dias_restantes integer;
begin
  select * into v_perfil from public.perfiles where id = auth.uid();
  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  v_dias_restantes := 7 - floor(extract(epoch from now() - v_perfil.username_cambiado_en) / 86400)::integer;
  if v_dias_restantes > 0 then
    raise exception 'Podrás cambiar tu nombre en % día(s)', v_dias_restantes;
  end if;

  update public.perfiles
     set username = lower(p_username), username_cambiado_en = now()
   where id = auth.uid()
  returning * into v_perfil;

  return v_perfil;
exception
  when unique_violation then
    raise exception 'Ese nombre de usuario ya está en uso';
  when check_violation then
    raise exception 'Nombre inválido: entre 3 y 20 caracteres (a-z, 0-9, _ - .)';
end;
$$;

-- Crear un reporte (con reglas anti-abuso) y sumar XP
create function public.crear_reporte (
  p_tipo public.clima_tipo,
  p_lat double precision,
  p_lng double precision,
  p_precision_m real default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ultimo timestamptz;
  v_minutos integer;
  v_reporte public.reportes;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if not exists (select 1 from public.perfiles where id = v_uid) then
    raise exception 'Primero debes elegir tu nombre de usuario';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación inválida';
  end if;
  if p_precision_m is not null and p_precision_m > 500 then
    raise exception 'Tu ubicación no es lo bastante precisa (% m). Activa el GPS e inténtalo de nuevo.', round(p_precision_m);
  end if;

  select max(creado_en) into v_ultimo from public.reportes where usuario_id = v_uid;
  if v_ultimo is not null and v_ultimo > now() - interval '10 minutes' then
    v_minutos := ceil(extract(epoch from (v_ultimo + interval '10 minutes') - now()) / 60);
    raise exception 'Ya reportaste hace poco. Podrás volver a reportar en % min.', v_minutos;
  end if;

  insert into public.reportes (usuario_id, tipo, ubicacion, precision_m)
  values (v_uid, p_tipo, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography, p_precision_m)
  returning * into v_reporte;

  update public.perfiles
     set xp = xp + 10, total_reportes = total_reportes + 1
   where id = v_uid;

  return jsonb_build_object('id', v_reporte.id, 'creado_en', v_reporte.creado_en, 'expira_en', v_reporte.expira_en);
end;
$$;

-- Zonas de clima cercanas (agregadas y anonimizadas)
create function public.zonas_cercanas (
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
  actualizado_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with activos as (
    select r.tipo,
           r.ubicacion,
           r.creado_en,
           -- los reportes recientes pesan más (1.0 recién hecho → 0.1 al expirar)
           greatest(0.1, 1 - extract(epoch from now() - r.creado_en) / 3600.0) as peso
      from public.reportes r
     where r.expira_en > now()
       and extensions.st_dwithin(
             r.ubicacion,
             extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
             least(greatest(p_radio_m, 1000), 50000))
  ),
  agrupados as (
    select a.*,
           extensions.st_clusterdbscan(
             extensions.st_transform(a.ubicacion::extensions.geometry, 3857), eps := 300, minpoints := 1
           ) over () as grupo
      from activos a
  ),
  votos as (
    select grupo, tipo as tipo_voto, sum(peso) as puntaje
      from agrupados
     group by grupo, tipo
  ),
  ganador as (
    select distinct on (grupo) grupo, tipo_voto, puntaje
      from votos
     order by grupo, puntaje desc
  )
  select g.tipo_voto,
         -- redondeo a ~100 m para no revelar la ubicación exacta de nadie
         round(extensions.st_y(extensions.st_centroid(extensions.st_collect(a.ubicacion::extensions.geometry)))::numeric, 3)::double precision,
         round(extensions.st_x(extensions.st_centroid(extensions.st_collect(a.ubicacion::extensions.geometry)))::numeric, 3)::double precision,
         least(250 + 150 * (count(*) filter (where a.tipo = g.tipo_voto) - 1), 1500)::integer,
         count(*)::integer,
         round((g.puntaje / sum(a.peso))::numeric, 2)::real,
         max(a.creado_en)
    from agrupados a
    join ganador g on g.grupo = a.grupo
   group by g.grupo, g.tipo_voto, g.puntaje;
$$;

-- Historial del usuario (coordenadas redondeadas)
create function public.mis_reportes (p_limite integer default 50)
returns table (
  id bigint,
  tipo public.clima_tipo,
  lat double precision,
  lng double precision,
  creado_en timestamptz,
  expira_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         r.tipo,
         round(extensions.st_y(r.ubicacion::extensions.geometry)::numeric, 3)::double precision,
         round(extensions.st_x(r.ubicacion::extensions.geometry)::numeric, 3)::double precision,
         r.creado_en,
         r.expira_en
    from public.reportes r
   where r.usuario_id = auth.uid()
   order by r.creado_en desc
   limit least(greatest(p_limite, 1), 200);
$$;

-- Borrar la cuenta y todos los datos (Ley 1581 de 2012, derecho de supresión)
create function public.borrar_mi_cuenta ()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Solo usuarios autenticados pueden llamar las funciones
revoke execute on function
  public.username_disponible (text),
  public.crear_perfil (text),
  public.cambiar_username (text),
  public.crear_reporte (public.clima_tipo, double precision, double precision, real),
  public.zonas_cercanas (double precision, double precision, integer),
  public.mis_reportes (integer),
  public.borrar_mi_cuenta ()
from public, anon;

grant execute on function
  public.username_disponible (text),
  public.crear_perfil (text),
  public.cambiar_username (text),
  public.crear_reporte (public.clima_tipo, double precision, double precision, real),
  public.zonas_cercanas (double precision, double precision, integer),
  public.mis_reportes (integer),
  public.borrar_mi_cuenta ()
to authenticated;
