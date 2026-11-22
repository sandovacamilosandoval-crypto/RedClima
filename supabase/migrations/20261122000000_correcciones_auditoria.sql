-- =====================================================================
-- RedClima · Correcciones de la auditoría QA (2026-11-22)
--  RC-01  zonas_cercanas exige un reporte vigente y solo mira cerca de él
--  RC-02  crear_reporte bloquea la fila del perfil (sin carreras / doble XP)
--  RC-04  zonas por celdas fijas de ~1 km en vez de DBSCAN encadenado
--  RC-05  una zona solo se muestra con 2+ personas (o si es solo tuya)
--  RC-06  la precisión GPS es obligatoria
--  RC-13  límite de mensajes de soporte por usuario
-- =====================================================================

-- ---------------------------------------------------------------------
-- RC-02 + RC-06: crear_reporte
-- ---------------------------------------------------------------------
create or replace function public.crear_reporte (
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

  -- Bloquea la fila del perfil: dos peticiones simultáneas del mismo usuario
  -- se ejecutan una detrás de otra, así la regla de 10 min no se puede saltar.
  perform 1 from public.perfiles where id = v_uid for update;
  if not found then
    raise exception 'Primero debes elegir tu nombre de usuario';
  end if;

  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación inválida';
  end if;
  if p_precision_m is null or p_precision_m < 0 or p_precision_m = 'NaN'::real then
    raise exception 'No pudimos medir la precisión de tu ubicación. Activa el GPS e inténtalo de nuevo.';
  end if;
  if p_precision_m > 500 then
    raise exception 'Tu ubicación no es lo bastante precisa (% m). Activa el GPS e inténtalo de nuevo.', round(p_precision_m);
  end if;

  select max(creado_en) into v_ultimo from public.reportes where usuario_id = v_uid;
  if v_ultimo is not null and v_ultimo > now() - interval '10 minutes' then
    v_minutos := greatest(1, ceil(extract(epoch from (v_ultimo + interval '10 minutes') - now()) / 60));
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

-- ---------------------------------------------------------------------
-- RC-01 + RC-04 + RC-05: zonas_cercanas
-- ---------------------------------------------------------------------
create or replace function public.zonas_cercanas (
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
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_mio extensions.geography;
  v_centro extensions.geography;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación inválida';
  end if;

  -- El mapa solo se ve si tienes un reporte vigente (antes solo lo exigía la app)
  select r.ubicacion into v_mio
    from public.reportes r
   where r.usuario_id = v_uid and r.expira_en > now()
   order by r.creado_en desc
   limit 1;
  if v_mio is null then
    raise exception 'Reporta el clima en tu zona para ver el mapa';
  end if;

  -- ...y solo alrededor de donde reportaste, no en cualquier parte del país
  v_centro := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  if not extensions.st_dwithin(v_centro, v_mio, 5000) then
    v_centro := v_mio;
  end if;

  return query
  with activos as (
    select r.usuario_id,
           r.tipo,
           r.ubicacion,
           r.creado_en,
           -- los reportes recientes pesan más (1.0 recién hecho → 0.1 al expirar)
           greatest(0.1, 1 - extract(epoch from now() - r.creado_en) / 3600.0) as peso,
           -- celda fija de ~1 km: evita que reportes encadenados formen una sola zona gigante
           floor(extensions.st_x(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)) / 1000)::bigint as celda_x,
           floor(extensions.st_y(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)) / 1000)::bigint as celda_y
      from public.reportes r
     where r.expira_en > now()
       and extensions.st_dwithin(r.ubicacion, v_centro, least(greatest(p_radio_m, 1000), 20000))
  ),
  visibles as (
    -- privacidad: una zona se muestra si la reportaron 2+ personas, o si es solo tuya
    select a.celda_x, a.celda_y
      from activos a
     group by a.celda_x, a.celda_y
    having count(distinct a.usuario_id) >= 2 or bool_and(a.usuario_id = v_uid)
  ),
  votos as (
    select a.celda_x, a.celda_y, a.tipo as tipo_voto, sum(a.peso) as puntaje
      from activos a
      join visibles v on v.celda_x = a.celda_x and v.celda_y = a.celda_y
     group by a.celda_x, a.celda_y, a.tipo
  ),
  ganador as (
    select distinct on (vo.celda_x, vo.celda_y) vo.celda_x, vo.celda_y, vo.tipo_voto, vo.puntaje
      from votos vo
     order by vo.celda_x, vo.celda_y, vo.puntaje desc
  )
  select g.tipo_voto,
         -- redondeo a ~100 m para no revelar la ubicación exacta de nadie
         round(extensions.st_y(extensions.st_centroid(extensions.st_collect(a.ubicacion::extensions.geometry)))::numeric, 3)::double precision,
         round(extensions.st_x(extensions.st_centroid(extensions.st_collect(a.ubicacion::extensions.geometry)))::numeric, 3)::double precision,
         least(250 + 100 * (count(*) filter (where a.tipo = g.tipo_voto) - 1), 600)::integer,
         count(*)::integer,
         round((g.puntaje / sum(a.peso))::numeric, 2)::real,
         -- hora redondeada al minuto
         date_trunc('minute', max(a.creado_en))
    from activos a
    join ganador g on g.celda_x = a.celda_x and g.celda_y = a.celda_y
   group by g.celda_x, g.celda_y, g.tipo_voto, g.puntaje;
end;
$$;

-- ---------------------------------------------------------------------
-- RC-13: máximo 3 mensajes de soporte por hora y 10 por día por usuario
-- ---------------------------------------------------------------------
create function public.limitar_mensajes_soporte ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- serializa los envíos del mismo usuario
  perform pg_advisory_xact_lock(hashtextextended('soporte:' || new.usuario_id::text, 0));

  if (select count(*) from public.mensajes_soporte
       where usuario_id = new.usuario_id and creado_en > now() - interval '1 hour') >= 3
     or (select count(*) from public.mensajes_soporte
       where usuario_id = new.usuario_id and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Ya nos enviaste varios mensajes. Inténtalo de nuevo más tarde.';
  end if;
  return new;
end;
$$;

revoke execute on function public.limitar_mensajes_soporte () from public, anon, authenticated;

create trigger mensajes_soporte_limite
  before insert on public.mensajes_soporte
  for each row execute function public.limitar_mensajes_soporte ();

create index if not exists mensajes_soporte_usuario_fecha_idx
  on public.mensajes_soporte (usuario_id, creado_en desc);
