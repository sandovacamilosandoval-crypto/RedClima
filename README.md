# RedClima

Mapa del clima **colaborativo y en tiempo real**: cada persona reporta el clima que ve
en su ubicación (soleado, nublado, lluvia, tormenta) y el mapa se colorea por zonas.
Para ver el mapa, primero debes aportar un reporte.

## Stack

- React 19 + Vite
- Ant Design (UI)
- Leaflet / react-leaflet (mapa; teselas configurables con `VITE_TILES_URL`, por defecto OpenStreetMap)
- Supabase (Auth con Google, Postgres + PostGIS, funciones RPC)
- React Router

## Flujo

`/` Landing → `/login` → `/registro` (nombre de usuario) → `/tutorial` → `/mapa`

## Scripts

```bash
npm install
npm run dev      # servidor de desarrollo
npm run lint     # ESLint
npm run build    # build de producción
```

## Estructura

- `src/pages/` — pantallas (una por ruta)
- `src/components/` — piezas reutilizables del mapa y menús
- `src/constants/clima.js` — tipos de clima, reglas de reportes y de usuario (fuente única)

## Base de datos

Las migraciones están en `supabase/migrations/` y se aplican en orden
(`supabase db push`). Las reglas de negocio viven en la base de datos:

- Un reporte dura 30 minutos y desbloquea el mapa ese tiempo; máximo 1 cada 10 min por usuario
  (a prueba de envíos simultáneos).
- Precisión GPS obligatoria y de 500 m como máximo.
- Las zonas se calculan por celdas de ~1 km y solo se muestran si las reportaron 2+ personas
  (o si son solo tuyas). Para ver zonas hace falta tener un reporte vigente.
- Niveles por XP (10 XP por reporte), con costo progresivo y barra que reinicia en cada nivel:
  Observador → Informante 100 XP → Explorador +300 → Guardián +700 → Centinela +1500.
  Fuente única: `public.nivel_de_xp()` y `src/constants/niveles.js` (deben coincidir).
- Soporte con casos (tickets), conversación y notificaciones: máximo 3 casos por hora y 10 por día.

## Panel de administración (`/admin`)

Roles `moderador` y `admin` en la tabla `staff`. La seguridad está en la base de datos (RLS y
funciones `admin_*`); la ruta solo es la interfaz y se descarga aparte. Para crear el primer admin,
ejecuta en el SQL Editor de Supabase:

```sql
insert into public.staff (usuario_id, rol)
select id, 'admin' from public.perfiles where username = 'TU_USUARIO';
```

Secciones: Resumen (filtro 1 h / 12 h / 1 día / 1 semana / 1 mes y búsqueda de reportes),
Soporte, Reportes (mapa), Usuarios, Calidad del dato (anomalías) y Auditoría (solo admin).
Tocar cualquier reporte o usuario abre su ficha con sus reportes, casos y moderación.

## Versiones

- `v1`: lo que estaba publicado antes de la auditoría (rama `v1`).
- `v2`: auditoría QA + mejoras de producto + panel de administración.

## Producción (Vercel)

`vercel.json` define el enrutado SPA (sin tapar los 404 de `/assets`), cabeceras de
seguridad (CSP, `X-Frame-Options`, `Permissions-Policy`) y caché larga para los assets.
Si cambias de proveedor de teselas o de backend, revisa `img-src` y `connect-src` en la CSP.
