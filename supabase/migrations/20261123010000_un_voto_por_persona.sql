-- =====================================================================
-- RedClima · Una persona, un voto en las zonas
--
-- Hallazgo de la simulación de 100 usuarios en Cali: 6 spammers coordinados
-- que reportan cada 10 minutos acumulaban ~3 votos vigentes cada uno frente a
-- ~1 de un vecino honesto, y volteaban la zona en 5–8 de 12 rondas.
-- Ahora solo cuenta el reporte más reciente de cada persona (`reportes` pasa a
-- ser el número de personas de la zona) y todos los votos vigentes pesan igual
-- (los verificados ×1,5).
--
-- Resultado (3 corridas, 7 barrios × 12 rondas = 84 aciertos posibles):
--   ataque coordinado en el Sur: 5,0/12 → 10,0/12 · uso normal: 79,7 → 81,0 /84
-- =====================================================================

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
  v_centro extensions.geography := public._centro_permitido(p_lat, p_lng);
begin
  return query
  with activos as (
    -- Una persona, un voto: solo cuenta el reporte más reciente de cada usuario.
    -- Así quien reporta cada 10 minutos no pesa más que un vecino ocasional,
    -- y si el clima cambia, tu reporte nuevo reemplaza al anterior.
    select distinct on (r.usuario_id)
           r.usuario_id,
           r.tipo,
           r.ubicacion,
           r.creado_en,
           -- recién hecho pesa 1.0 → 0.1 al expirar (30 min); verificados ×1.5
           -- sin decaimiento por antigüedad: con un voto por persona, el decaimiento
           -- favorecía a quien reporta sin parar (su último voto siempre está fresco).
           -- Los reportes ya caducan a los 30 min, y la zona muestra "Hace X min".
           1.0
             * case when p.verificado then 1.5 else 1 end as peso,
           floor(extensions.st_x(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)) / 1000)::bigint as celda_x,
           floor(extensions.st_y(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)) / 1000)::bigint as celda_y
      from public.reportes r
      join public.perfiles p on p.id = r.usuario_id
     where r.expira_en > now()
       and not r.oculto
       and extensions.st_dwithin(r.ubicacion, v_centro, least(greatest(p_radio_m, 1000), 20000))
     order by r.usuario_id, r.creado_en desc
  ),
  visibles as (
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
         round(extensions.st_y(extensions.st_centroid(extensions.st_collect(a.ubicacion::extensions.geometry)))::numeric, 3)::double precision,
         round(extensions.st_x(extensions.st_centroid(extensions.st_collect(a.ubicacion::extensions.geometry)))::numeric, 3)::double precision,
         least(250 + 100 * (count(*) filter (where a.tipo = g.tipo_voto) - 1), 600)::integer,
         count(*)::integer,
         round((g.puntaje / sum(a.peso))::numeric, 2)::real,
         date_trunc('minute', max(a.creado_en))
    from activos a
    join ganador g on g.celda_x = a.celda_x and g.celda_y = a.celda_y
   group by g.celda_x, g.celda_y, g.tipo_voto, g.puntaje;
end;
$$;
