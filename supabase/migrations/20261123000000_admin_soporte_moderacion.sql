-- =====================================================================
-- RedClima · Panel de administración, soporte con tickets y moderación
--
-- Roles:  staff (moderador | admin). La seguridad vive aquí (RLS + RPC);
--         la ruta /admin del frontend solo es la interfaz.
-- Primer admin (ejecutar a mano en el SQL Editor de Supabase):
--   insert into public.staff (usuario_id, rol)
--   select id, 'admin' from public.perfiles where username = 'TU_USUARIO';
--
-- Niveles (deben coincidir con src/constants/niveles.js):
--   Observador 0–9 reportes · Informante 10–49 · Explorador 50+
-- =====================================================================

-- ---------------------------------------------------------------------
-- Estado de cuenta y reportes ocultos
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column estado text not null default 'activo'
    check (estado in ('activo', 'advertido', 'suspendido')),
  add column suspendido_hasta timestamptz,
  add column verificado boolean not null default false;

alter table public.reportes
  add column oculto boolean not null default false,
  add column oculto_motivo text;

create index reportes_creado_idx on public.reportes (creado_en desc);

-- ---------------------------------------------------------------------
-- Equipo (staff)
-- ---------------------------------------------------------------------
create type public.rol_staff as enum ('moderador', 'admin');

create table public.staff (
  usuario_id uuid primary key references public.perfiles (id) on delete cascade,
  rol public.rol_staff not null,
  creado_en timestamptz not null default now()
);

alter table public.staff enable row level security;

create policy "Cada miembro ve su propio rol"
  on public.staff for select to authenticated
  using ((select auth.uid()) = usuario_id);

-- ¿El usuario actual es del equipo? (admin cumple cualquier rol)
create function public.es_staff (p_rol public.rol_staff default 'moderador')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
     where s.usuario_id = auth.uid()
       and (s.rol = 'admin' or s.rol = p_rol)
  );
$$;

create function public.mi_rol ()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.rol::text from public.staff s where s.usuario_id = auth.uid();
$$;

create policy "El equipo ve todos los perfiles"
  on public.perfiles for select to authenticated
  using (public.es_staff());

-- ---------------------------------------------------------------------
-- Auditoría de moderación (solo se escribe desde funciones del equipo)
-- ---------------------------------------------------------------------
create table public.acciones_moderacion (
  id bigint generated always as identity primary key,
  staff_id uuid,                 -- sin FK: el registro sobrevive aunque el miembro se vaya
  staff_username text,
  usuario_id uuid references public.perfiles (id) on delete set null,
  reporte_id bigint,
  ticket_id bigint,
  accion text not null,
  motivo text,
  detalle jsonb not null default '{}',
  creado_en timestamptz not null default now()
);

create index acciones_moderacion_usuario_idx on public.acciones_moderacion (usuario_id, creado_en desc);
create index acciones_moderacion_fecha_idx on public.acciones_moderacion (creado_en desc);

alter table public.acciones_moderacion enable row level security;
-- sin políticas: solo se lee vía admin_auditoria()

create function public._registrar_accion (
  p_accion text,
  p_motivo text,
  p_usuario uuid default null,
  p_reporte bigint default null,
  p_ticket bigint default null,
  p_detalle jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.acciones_moderacion
    (staff_id, staff_username, usuario_id, reporte_id, ticket_id, accion, motivo, detalle)
  values
    (auth.uid(), (select username from public.perfiles where id = auth.uid()),
     p_usuario, p_reporte, p_ticket, p_accion, p_motivo, coalesce(p_detalle, '{}'));
$$;

-- ---------------------------------------------------------------------
-- Notificaciones para el usuario (respuestas de soporte, advertencias...)
-- ---------------------------------------------------------------------
create table public.notificaciones (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text,
  ticket_id bigint,
  leida boolean not null default false,
  creado_en timestamptz not null default now()
);

create index notificaciones_usuario_idx on public.notificaciones (usuario_id, leida, creado_en desc);

alter table public.notificaciones enable row level security;

create policy "Cada usuario ve sus notificaciones"
  on public.notificaciones for select to authenticated
  using ((select auth.uid()) = usuario_id);

create function public._notificar (
  p_usuario uuid, p_tipo text, p_titulo text, p_cuerpo text default null, p_ticket bigint default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, ticket_id)
  values (p_usuario, p_tipo, p_titulo, p_cuerpo, p_ticket);
$$;

create function public.marcar_notificaciones_leidas (p_ticket bigint default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notificaciones
     set leida = true
   where usuario_id = auth.uid()
     and not leida
     and (p_ticket is null or ticket_id = p_ticket);
$$;

-- ---------------------------------------------------------------------
-- Tickets de soporte (reemplazan a mensajes_soporte)
-- ---------------------------------------------------------------------
create type public.ticket_categoria as enum
  ('bug', 'reporte_falso', 'queja', 'sugerencia', 'duda', 'cuenta_privacidad');
create type public.ticket_estado as enum
  ('pendiente', 'en_revision', 'esperando_usuario', 'resuelto', 'cerrado');

create table public.tickets (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  categoria public.ticket_categoria not null,
  estado public.ticket_estado not null default 'pendiente',
  -- 1 baja · 2 media · 3 alta · 4 crítica
  prioridad smallint not null default 2 check (prioridad between 1 and 4),
  asignado_a uuid references public.staff (usuario_id) on delete set null,
  contexto jsonb not null default '{}',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primera_respuesta_en timestamptz,
  resuelto_en timestamptz
);

create index tickets_usuario_idx on public.tickets (usuario_id, creado_en desc);
create index tickets_estado_idx on public.tickets (estado, prioridad desc, creado_en);

create table public.ticket_mensajes (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  autor_id uuid references public.perfiles (id) on delete set null,
  es_staff boolean not null default false,
  cuerpo text not null check (char_length(cuerpo) between 1 and 4000),
  interno boolean not null default false,  -- nota del equipo: el usuario no la ve
  creado_en timestamptz not null default now()
);

create index ticket_mensajes_ticket_idx on public.ticket_mensajes (ticket_id, creado_en);

alter table public.tickets enable row level security;
alter table public.ticket_mensajes enable row level security;

create policy "Ver tickets propios o todos si eres del equipo"
  on public.tickets for select to authenticated
  using ((select auth.uid()) = usuario_id or public.es_staff());

create policy "Ver mensajes de tus tickets o todos si eres del equipo"
  on public.ticket_mensajes for select to authenticated
  using (
    public.es_staff()
    or (not interno and exists (
      select 1 from public.tickets t
       where t.id = ticket_id and t.usuario_id = (select auth.uid())))
  );

-- Migrar los mensajes de soporte existentes
do $$
declare
  m record;
  v_id bigint;
begin
  for m in select * from public.mensajes_soporte order by id loop
    insert into public.tickets (usuario_id, categoria, creado_en, actualizado_en)
    values (m.usuario_id,
            case m.asunto when 'error' then 'bug' when 'sugerencia' then 'sugerencia' else 'duda' end::public.ticket_categoria,
            m.creado_en, m.creado_en)
    returning id into v_id;
    insert into public.ticket_mensajes (ticket_id, autor_id, cuerpo, creado_en)
    values (v_id, m.usuario_id, m.mensaje, m.creado_en);
  end loop;
end;
$$;

drop table public.mensajes_soporte;
drop function if exists public.limitar_mensajes_soporte ();

-- Crear un ticket con su primer mensaje
create function public.crear_ticket (
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

  -- Límite anti-spam (serializado por usuario)
  perform pg_advisory_xact_lock(hashtextextended('ticket:' || v_uid::text, 0));
  if (select count(*) from public.tickets where usuario_id = v_uid and creado_en > now() - interval '1 hour') >= 3
     or (select count(*) from public.tickets where usuario_id = v_uid and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Ya nos enviaste varios mensajes. Inténtalo de nuevo más tarde.';
  end if;

  -- Zona aproximada (~100 m), nunca la ubicación exacta
  if p_lat is not null and p_lng is not null
     and p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_contexto := v_contexto || jsonb_build_object(
      'zona', jsonb_build_object('lat', round(p_lat::numeric, 3), 'lng', round(p_lng::numeric, 3)));
  end if;

  -- Prioridad automática
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
    v_prioridad := 3; -- 3+ personas denuncian la misma zona
  elsif p_categoria = 'sugerencia' then
    v_prioridad := 1;
  end if;

  insert into public.tickets (usuario_id, categoria, prioridad, contexto)
  values (v_uid, p_categoria, v_prioridad, v_contexto)
  returning id into v_id;

  insert into public.ticket_mensajes (ticket_id, autor_id, cuerpo)
  values (v_id, v_uid, trim(p_mensaje));

  return v_id;
end;
$$;

-- Responder un ticket (usuario dueño o equipo)
create function public.responder_ticket (
  p_ticket bigint,
  p_cuerpo text,
  p_interno boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_staff boolean := public.es_staff();
  v_ticket public.tickets;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  select * into v_ticket from public.tickets where id = p_ticket for update;
  if not found or (not v_staff and v_ticket.usuario_id <> v_uid) then
    raise exception 'No encontramos ese caso';
  end if;
  if p_cuerpo is null or char_length(trim(p_cuerpo)) not between 1 and 4000 then
    raise exception 'Escribe un mensaje (máximo 4000 caracteres)';
  end if;

  if not v_staff then
    if p_interno then
      raise exception 'No autorizado';
    end if;
    if v_ticket.estado = 'cerrado' then
      raise exception 'Este caso está cerrado. Si necesitas algo más, escríbenos uno nuevo.';
    end if;
    if (select count(*) from public.ticket_mensajes m
          join public.tickets t on t.id = m.ticket_id
         where m.autor_id = v_uid and not m.es_staff and m.creado_en > now() - interval '1 hour') >= 20 then
      raise exception 'Enviaste muchos mensajes seguidos. Espera un momento.';
    end if;
  end if;

  insert into public.ticket_mensajes (ticket_id, autor_id, es_staff, cuerpo, interno)
  values (p_ticket, v_uid, v_staff, trim(p_cuerpo), v_staff and p_interno);

  if v_staff and not p_interno then
    update public.tickets
       set primera_respuesta_en = coalesce(primera_respuesta_en, now()),
           estado = case when estado in ('pendiente', 'en_revision') then 'esperando_usuario' else estado end,
           actualizado_en = now()
     where id = p_ticket;
    perform public._notificar(v_ticket.usuario_id, 'respuesta_ticket',
      'Respondimos tu mensaje', left(trim(p_cuerpo), 140), p_ticket);
  elsif not v_staff then
    update public.tickets
       set estado = case when estado in ('esperando_usuario', 'resuelto') then 'en_revision' else estado end,
           actualizado_en = now()
     where id = p_ticket;
  else
    update public.tickets set actualizado_en = now() where id = p_ticket;
  end if;
end;
$$;

-- Cambiar estado / prioridad / asignación (equipo)
create function public.admin_actualizar_ticket (
  p_ticket bigint,
  p_estado public.ticket_estado default null,
  p_prioridad smallint default null,
  p_asignado uuid default null,
  p_quitar_asignado boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.tickets;
begin
  if not public.es_staff() then
    raise exception 'No autorizado';
  end if;
  select * into v_antes from public.tickets where id = p_ticket for update;
  if not found then
    raise exception 'No encontramos ese caso';
  end if;
  if p_asignado is not null and not exists (select 1 from public.staff where usuario_id = p_asignado) then
    raise exception 'Solo puedes asignar a miembros del equipo';
  end if;

  update public.tickets
     set estado = coalesce(p_estado, estado),
         prioridad = coalesce(p_prioridad, prioridad),
         asignado_a = case when p_quitar_asignado then null else coalesce(p_asignado, asignado_a) end,
         resuelto_en = case
           when p_estado in ('resuelto', 'cerrado') then coalesce(resuelto_en, now())
           when p_estado is not null then null
           else resuelto_en end,
         actualizado_en = now()
   where id = p_ticket;

  if p_estado = 'resuelto' and v_antes.estado <> 'resuelto' then
    perform public._notificar(v_antes.usuario_id, 'ticket_resuelto',
      'Tu caso fue resuelto', 'Si algo sigue sin funcionar, respóndenos en Mis mensajes.', p_ticket);
  end if;

  perform public._registrar_accion('actualizar_ticket', null, v_antes.usuario_id, null, p_ticket,
    jsonb_build_object('estado', p_estado, 'prioridad', p_prioridad, 'asignado', p_asignado));
end;
$$;

-- ---------------------------------------------------------------------
-- Moderación de usuarios y reportes
-- ---------------------------------------------------------------------
create function public.admin_moderar_usuario (
  p_usuario uuid,
  p_accion text,
  p_motivo text,
  p_dias integer default null,
  p_xp integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.es_staff('admin');
begin
  if not public.es_staff() then
    raise exception 'No autorizado';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes moderar tu propia cuenta';
  end if;
  if not exists (select 1 from public.perfiles where id = p_usuario) then
    raise exception 'Usuario no encontrado';
  end if;
  if p_motivo is null or char_length(trim(p_motivo)) < 5 then
    raise exception 'Escribe el motivo (mínimo 5 caracteres)';
  end if;
  -- Los moderadores: advertir, suspender hasta 7 días y ocultar reportes
  if not v_admin and (
       p_accion not in ('advertir', 'suspender', 'ocultar_reportes')
       or (p_accion = 'suspender' and (p_dias is null or p_dias > 7))) then
    raise exception 'Esta acción requiere rol de administrador';
  end if;

  case p_accion
    when 'advertir' then
      update public.perfiles set estado = 'advertido' where id = p_usuario and estado = 'activo';
      perform public._notificar(p_usuario, 'advertencia', 'Recibiste una advertencia', trim(p_motivo));
    when 'suspender' then
      if p_dias is not null and p_dias < 1 then
        raise exception 'La suspensión debe ser de al menos 1 día';
      end if;
      update public.perfiles
         set estado = 'suspendido',
             suspendido_hasta = case when p_dias is null then null else now() + make_interval(days => p_dias) end
       where id = p_usuario;
      update public.reportes set oculto = true, oculto_motivo = 'Cuenta suspendida'
       where usuario_id = p_usuario and expira_en > now();
      perform public._notificar(p_usuario, 'suspension',
        case when p_dias is null then 'Tu cuenta fue suspendida'
             else format('Tu cuenta fue suspendida por %s día(s)', p_dias) end,
        trim(p_motivo));
    when 'reactivar' then
      update public.perfiles set estado = 'activo', suspendido_hasta = null where id = p_usuario;
      perform public._notificar(p_usuario, 'reactivacion', 'Tu cuenta está activa de nuevo', null);
    when 'verificar' then
      update public.perfiles set verificado = true where id = p_usuario;
      perform public._notificar(p_usuario, 'verificacion', '¡Ahora eres reportero verificado!',
        'Tus reportes pesan más en el mapa. Gracias por tu constancia.');
    when 'quitar_verificacion' then
      update public.perfiles set verificado = false where id = p_usuario;
    when 'ajustar_xp' then
      if p_xp is null or p_xp = 0 then
        raise exception 'Indica cuánta XP sumar o restar';
      end if;
      update public.perfiles set xp = greatest(0, xp + p_xp) where id = p_usuario;
    when 'ocultar_reportes' then
      update public.reportes set oculto = true, oculto_motivo = trim(p_motivo)
       where usuario_id = p_usuario and expira_en > now();
    else
      raise exception 'Acción desconocida';
  end case;

  perform public._registrar_accion(p_accion, trim(p_motivo), p_usuario, null, null,
    jsonb_build_object('dias', p_dias, 'xp', p_xp));
end;
$$;

create function public.admin_ocultar_reporte (p_reporte bigint, p_ocultar boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid;
begin
  if not public.es_staff() then
    raise exception 'No autorizado';
  end if;
  if p_ocultar and (p_motivo is null or char_length(trim(p_motivo)) < 5) then
    raise exception 'Escribe el motivo (mínimo 5 caracteres)';
  end if;
  update public.reportes
     set oculto = p_ocultar,
         oculto_motivo = case when p_ocultar then trim(p_motivo) else null end
   where id = p_reporte
  returning usuario_id into v_usuario;
  if not found then
    raise exception 'Reporte no encontrado';
  end if;
  perform public._registrar_accion(
    case when p_ocultar then 'ocultar_reporte' else 'restaurar_reporte' end,
    p_motivo, v_usuario, p_reporte, null, '{}');
end;
$$;

-- ---------------------------------------------------------------------
-- Reglas de reporte: cuentas suspendidas no reportan
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
  v_perfil public.perfiles;
  v_ultimo timestamptz;
  v_minutos integer;
  v_reporte public.reportes;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  -- Bloquea la fila del perfil: reportes simultáneos del mismo usuario van en fila
  select * into v_perfil from public.perfiles where id = v_uid for update;
  if not found then
    raise exception 'Primero debes elegir tu nombre de usuario';
  end if;
  if v_perfil.estado = 'suspendido' then
    if v_perfil.suspendido_hasta is not null and v_perfil.suspendido_hasta <= now() then
      update public.perfiles set estado = 'activo', suspendido_hasta = null where id = v_uid;
    elsif v_perfil.suspendido_hasta is null then
      raise exception 'Tu cuenta está suspendida. Si crees que es un error, escríbenos desde Soporte.';
    else
      raise exception 'Tu cuenta está suspendida hasta el %. Si crees que es un error, escríbenos desde Soporte.',
        to_char(v_perfil.suspendido_hasta at time zone 'America/Bogota', 'DD/MM/YYYY');
    end if;
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
-- Centro de búsqueda permitido: exige reporte vigente y lo limita a 5 km
-- de donde reportaste (uso interno)
-- ---------------------------------------------------------------------
create function public._centro_permitido (p_lat double precision, p_lng double precision)
returns extensions.geography
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mio extensions.geography;
  v_centro extensions.geography;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación inválida';
  end if;
  select r.ubicacion into v_mio
    from public.reportes r
   where r.usuario_id = auth.uid() and r.expira_en > now()
   order by r.creado_en desc
   limit 1;
  if v_mio is null then
    raise exception 'Reporta el clima en tu zona para ver el mapa';
  end if;
  v_centro := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  if not extensions.st_dwithin(v_centro, v_mio, 5000) then
    v_centro := v_mio;
  end if;
  return v_centro;
end;
$$;

-- Zonas: excluye reportes ocultos y da más peso a reporteros verificados
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
    select r.usuario_id,
           r.tipo,
           r.ubicacion,
           r.creado_en,
           greatest(0.1, 1 - extract(epoch from now() - r.creado_en) / 3600.0)
             * case when p.verificado then 1.5 else 1 end as peso,
           floor(extensions.st_x(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)) / 1000)::bigint as celda_x,
           floor(extensions.st_y(extensions.st_transform(r.ubicacion::extensions.geometry, 3857)) / 1000)::bigint as celda_y
      from public.reportes r
      join public.perfiles p on p.id = r.usuario_id
     where r.expira_en > now()
       and not r.oculto
       and extensions.st_dwithin(r.ubicacion, v_centro, least(greatest(p_radio_m, 1000), 20000))
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

-- Actividad alrededor (para el estado vacío del mapa)
create function public.actividad_cercana (p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_centro extensions.geography := public._centro_permitido(p_lat, p_lng);
  v_otros integer;
  v_minutos integer;
  v_km integer;
begin
  select count(*),
         floor(extract(epoch from now() - max(r.creado_en)) / 60),
         greatest(1, round(min(extensions.st_distance(r.ubicacion, v_centro)) / 1000))
    into v_otros, v_minutos, v_km
    from public.reportes r
   where r.expira_en > now()
     and not r.oculto
     and r.usuario_id <> auth.uid()
     and extensions.st_dwithin(r.ubicacion, v_centro, 20000);

  return jsonb_build_object(
    'otros_reportes', v_otros,
    'minutos_ultimo', case when v_otros > 0 then v_minutos end,
    'km_mas_cercano', case when v_otros > 0 then v_km end);
end;
$$;

-- Contador público para la Landing (solo totales, sin ubicaciones)
create function public.actividad_publica ()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reportes_ultima_hora', count(*),
    'personas_ultima_hora', count(distinct r.usuario_id))
    from public.reportes r
   where r.creado_en > now() - interval '1 hour' and not r.oculto;
$$;

-- ---------------------------------------------------------------------
-- Consultas del panel
-- ---------------------------------------------------------------------
create function public.admin_resumen ()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.es_staff() then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'reportes_24h', (select count(*) from public.reportes where creado_en > now() - interval '24 hours'),
    'media_diaria_7d', (select round(count(*) / 7.0, 1) from public.reportes
                         where creado_en > now() - interval '8 days' and creado_en <= now() - interval '24 hours'),
    'reporteros_24h', (select count(distinct usuario_id) from public.reportes where creado_en > now() - interval '24 hours'),
    'reporteros_7d', (select count(distinct usuario_id) from public.reportes where creado_en > now() - interval '7 days'),
    'usuarios_total', (select count(*) from public.perfiles),
    'nuevos_7d', (select count(*) from public.perfiles where creado_en > now() - interval '7 days'),
    -- Embudo: de los registrados en 30 días, cuántos hicieron al menos 1 reporte
    'embudo_primer_reporte', (
      select round(100.0 * count(*) filter (where total_reportes > 0) / nullif(count(*), 0), 1)
        from public.perfiles where creado_en > now() - interval '30 days'),
    -- Retención semanal: reporteros de la semana pasada que volvieron esta semana
    'retencion_semanal', (
      with previa as (
        select distinct usuario_id from public.reportes
         where creado_en > now() - interval '14 days' and creado_en <= now() - interval '7 days'),
      actual as (
        select distinct usuario_id from public.reportes where creado_en > now() - interval '7 days')
      select round(100.0 * count(a.usuario_id) / nullif(count(*), 0), 1)
        from previa p left join actual a on a.usuario_id = p.usuario_id),
    'tickets_abiertos', (select count(*) from public.tickets where estado in ('pendiente', 'en_revision')),
    'tickets_urgentes', (select count(*) from public.tickets
                          where estado in ('pendiente', 'en_revision') and prioridad >= 3),
    'tickets_sin_respuesta_24h', (select count(*) from public.tickets
                                   where primera_respuesta_en is null and estado = 'pendiente'
                                     and creado_en < now() - interval '24 hours'),
    'horas_primera_respuesta', (
      select round((percentile_cont(0.5) within group (
               order by extract(epoch from primera_respuesta_en - creado_en) / 3600))::numeric, 1)
        from public.tickets
       where primera_respuesta_en is not null and creado_en > now() - interval '30 days'),
    'ocultos_7d', (select count(*) from public.reportes where oculto and creado_en > now() - interval '7 days'),
    'suspendidos', (select count(*) from public.perfiles where estado = 'suspendido'),
    'por_hora_30d', (
      select jsonb_agg(coalesce(c.n, 0) order by h.hora)
        from generate_series(0, 23) as h(hora)
        left join (
          select extract(hour from creado_en at time zone 'America/Bogota')::int as hora, count(*) as n
            from public.reportes where creado_en > now() - interval '30 days'
           group by 1) c on c.hora = h.hora),
    'por_tipo_24h', (
      select coalesce(jsonb_object_agg(tipo, n), '{}')
        from (select tipo, count(*) as n from public.reportes
               where creado_en > now() - interval '24 hours' group by tipo) t),
    'niveles', (
      select jsonb_build_object(
        'observador', count(*) filter (where total_reportes < 10),
        'informante', count(*) filter (where total_reportes between 10 and 49),
        'explorador', count(*) filter (where total_reportes >= 50))
        from public.perfiles),
    'top_reporteros_7d', (
      select coalesce(jsonb_agg(t order by t.reportes desc), '[]')
        from (select p.id, p.username, p.verificado, count(*) as reportes
                from public.reportes r join public.perfiles p on p.id = r.usuario_id
               where r.creado_en > now() - interval '7 days'
               group by p.id
               order by count(*) desc
               limit 10) t)
  ) into v;
  return v;
end;
$$;

-- Directorio de usuarios
create function public.admin_usuarios (
  p_busqueda text default null,
  p_estado text default null,
  p_limite integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  email text,
  creado_en timestamptz,
  ultimo_acceso timestamptz,
  xp integer,
  total_reportes integer,
  reportes_7d integer,
  ultimo_reporte_en timestamptz,
  tickets_abiertos integer,
  estado text,
  suspendido_hasta timestamptz,
  verificado boolean,
  rol text,
  zona_lat double precision,
  zona_lng double precision,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin boolean := public.es_staff('admin');
begin
  if not public.es_staff() then
    raise exception 'No autorizado';
  end if;
  return query
  select p.id,
         p.username,
         case when v_admin then u.email::text end,
         p.creado_en,
         u.last_sign_in_at,
         p.xp,
         p.total_reportes,
         (select count(*)::integer from public.reportes r
           where r.usuario_id = p.id and r.creado_en > now() - interval '7 days'),
         (select max(r.creado_en) from public.reportes r where r.usuario_id = p.id),
         (select count(*)::integer from public.tickets t
           where t.usuario_id = p.id and t.estado not in ('resuelto', 'cerrado')),
         p.estado,
         p.suspendido_hasta,
         p.verificado,
         s.rol::text,
         -- zona habitual (~1 km), solo para administradores
         case when v_admin then z.lat end,
         case when v_admin then z.lng end,
         count(*) over ()
    from public.perfiles p
    left join auth.users u on u.id = p.id
    left join public.staff s on s.usuario_id = p.id
    left join lateral (
      select round(extensions.st_y(r.ubicacion::extensions.geometry)::numeric, 2)::double precision as lat,
             round(extensions.st_x(r.ubicacion::extensions.geometry)::numeric, 2)::double precision as lng
        from public.reportes r
       where r.usuario_id = p.id
       group by 1, 2
       order by count(*) desc
       limit 1
    ) z on true
   where (p_busqueda is null or p_busqueda = ''
          or p.username ilike '%' || p_busqueda || '%'
          or (v_admin and u.email ilike '%' || p_busqueda || '%'))
     and (p_estado is null or p_estado = '' or p.estado = p_estado
          or (p_estado = 'verificado' and p.verificado))
   order by p.creado_en desc
   limit least(greatest(p_limite, 1), 200)
  offset greatest(p_offset, 0);
end;
$$;

-- Reportes para moderar
create function public.admin_reportes (
  p_horas integer default 24,
  p_solo_ocultos boolean default false,
  p_usuario uuid default null,
  p_limite integer default 200
)
returns table (
  id bigint,
  tipo public.clima_tipo,
  lat double precision,
  lng double precision,
  precision_m real,
  creado_en timestamptz,
  expira_en timestamptz,
  oculto boolean,
  oculto_motivo text,
  usuario_id uuid,
  username text,
  verificado boolean
)
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
  select r.id, r.tipo,
         round(extensions.st_y(r.ubicacion::extensions.geometry)::numeric, 3)::double precision,
         round(extensions.st_x(r.ubicacion::extensions.geometry)::numeric, 3)::double precision,
         r.precision_m, r.creado_en, r.expira_en, r.oculto, r.oculto_motivo,
         p.id, p.username, p.verificado
    from public.reportes r
    join public.perfiles p on p.id = r.usuario_id
   where r.creado_en > now() - make_interval(hours => least(greatest(p_horas, 1), 24 * 90))
     and (not p_solo_ocultos or r.oculto)
     and (p_usuario is null or r.usuario_id = p_usuario)
   order by r.creado_en desc
   limit least(greatest(p_limite, 1), 500);
end;
$$;

-- Comportamiento anómalo (últimos N días)
create function public.admin_anomalias (p_dias integer default 7)
returns table (
  usuario_id uuid,
  username text,
  tipo text,
  detalle text,
  valor real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_desde timestamptz := now() - make_interval(days => least(greatest(p_dias, 1), 30));
begin
  if not public.es_staff() then
    raise exception 'No autorizado';
  end if;
  return query
  -- 1) Velocidad imposible entre dos reportes seguidos (> 150 km/h y > 2 km)
  with seguidos as (
    select r.usuario_id, r.creado_en, r.ubicacion,
           lag(r.ubicacion) over w as ubic_ant,
           lag(r.creado_en) over w as fecha_ant
      from public.reportes r
     where r.creado_en > v_desde
    window w as (partition by r.usuario_id order by r.creado_en)
  ),
  velocidad as (
    select s.usuario_id,
           max(extensions.st_distance(s.ubicacion, s.ubic_ant) / 1000
               / greatest(extract(epoch from s.creado_en - s.fecha_ant) / 3600, 1.0 / 60)) as kmh
      from seguidos s
     where s.ubic_ant is not null
       and extensions.st_distance(s.ubicacion, s.ubic_ant) > 2000
     group by s.usuario_id
  ),
  -- 2) Desacuerdo con los vecinos (otras personas a < 1 km y ± 15 min)
  evaluados as (
    select r.usuario_id,
           r.tipo = (
             select o.tipo from public.reportes o
              where o.usuario_id <> r.usuario_id
                and o.creado_en between r.creado_en - interval '15 minutes' and r.creado_en + interval '15 minutes'
                and extensions.st_dwithin(o.ubicacion, r.ubicacion, 1000)
              group by o.tipo order by count(*) desc limit 1
           ) as coincide
      from public.reportes r
     where r.creado_en > v_desde
  ),
  acuerdo as (
    select e.usuario_id,
           count(*) filter (where e.coincide is not null) as n,
           avg(case when e.coincide then 1.0 when e.coincide = false then 0.0 end) as pct
      from evaluados e
     group by e.usuario_id
  ),
  -- 3) Precisión de GPS siempre idéntica (posible ubicación falsa)
  precision_fija as (
    select r.usuario_id, count(*) as n, min(r.precision_m) as prec
      from public.reportes r
     where r.creado_en > v_desde
     group by r.usuario_id
    having count(*) >= 10 and count(distinct r.precision_m) = 1
  )
  select v.usuario_id, p.username, 'velocidad'::text,
         format('Se movió a %s km/h entre dos reportes', round(v.kmh::numeric)), v.kmh::real
    from velocidad v join public.perfiles p on p.id = v.usuario_id
   where v.kmh > 150
  union all
  select a.usuario_id, p.username, 'desacuerdo'::text,
         format('Solo coincide con sus vecinos en %s%% de %s reportes', round(a.pct * 100), a.n),
         (a.pct * 100)::real
    from acuerdo a join public.perfiles p on p.id = a.usuario_id
   where a.n >= 10 and a.pct < 0.4
  union all
  select f.usuario_id, p.username, 'precision_fija'::text,
         format('%s reportes con precisión idéntica (%s m)', f.n, f.prec), f.n::real
    from precision_fija f join public.perfiles p on p.id = f.usuario_id;
end;
$$;

-- Auditoría: global solo admin; por usuario, todo el equipo
create function public.admin_auditoria (p_usuario uuid default null, p_limite integer default 100)
returns table (
  id bigint,
  staff_username text,
  usuario_id uuid,
  username text,
  reporte_id bigint,
  ticket_id bigint,
  accion text,
  motivo text,
  detalle jsonb,
  creado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (public.es_staff('admin') or (p_usuario is not null and public.es_staff())) then
    raise exception 'No autorizado';
  end if;
  return query
  select a.id, a.staff_username, a.usuario_id, p.username, a.reporte_id, a.ticket_id,
         a.accion, a.motivo, a.detalle, a.creado_en
    from public.acciones_moderacion a
    left join public.perfiles p on p.id = a.usuario_id
   where p_usuario is null or a.usuario_id = p_usuario
   order by a.creado_en desc
   limit least(greatest(p_limite, 1), 500);
end;
$$;

-- Lista del equipo (para asignar tickets)
create function public.admin_equipo ()
returns table (usuario_id uuid, username text, rol text)
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
  select s.usuario_id, p.username, s.rol::text
    from public.staff s join public.perfiles p on p.id = s.usuario_id
   order by p.username;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on function
  public._registrar_accion (text, text, uuid, bigint, bigint, jsonb),
  public._notificar (uuid, text, text, text, bigint),
  public._centro_permitido (double precision, double precision)
from public, anon, authenticated;

revoke execute on function
  public.es_staff (public.rol_staff),
  public.mi_rol (),
  public.marcar_notificaciones_leidas (bigint),
  public.crear_ticket (public.ticket_categoria, text, jsonb, double precision, double precision),
  public.responder_ticket (bigint, text, boolean),
  public.admin_actualizar_ticket (bigint, public.ticket_estado, smallint, uuid, boolean),
  public.admin_moderar_usuario (uuid, text, text, integer, integer),
  public.admin_ocultar_reporte (bigint, boolean, text),
  public.actividad_cercana (double precision, double precision),
  public.actividad_publica (),
  public.admin_resumen (),
  public.admin_usuarios (text, text, integer, integer),
  public.admin_reportes (integer, boolean, uuid, integer),
  public.admin_anomalias (integer),
  public.admin_auditoria (uuid, integer),
  public.admin_equipo ()
from public, anon;

grant execute on function
  public.es_staff (public.rol_staff),
  public.mi_rol (),
  public.marcar_notificaciones_leidas (bigint),
  public.crear_ticket (public.ticket_categoria, text, jsonb, double precision, double precision),
  public.responder_ticket (bigint, text, boolean),
  public.admin_actualizar_ticket (bigint, public.ticket_estado, smallint, uuid, boolean),
  public.admin_moderar_usuario (uuid, text, text, integer, integer),
  public.admin_ocultar_reporte (bigint, boolean, text),
  public.actividad_cercana (double precision, double precision),
  public.actividad_publica (),
  public.admin_resumen (),
  public.admin_usuarios (text, text, integer, integer),
  public.admin_reportes (integer, boolean, uuid, integer),
  public.admin_anomalias (integer),
  public.admin_auditoria (uuid, integer),
  public.admin_equipo ()
to authenticated;

-- El contador de la Landing lo ven también los visitantes sin sesión
grant execute on function public.actividad_publica () to anon;
