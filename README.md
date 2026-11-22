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

- Un reporte dura 1 hora; máximo 1 cada 10 min por usuario (a prueba de envíos simultáneos).
- Precisión GPS obligatoria y de 500 m como máximo.
- Las zonas se calculan por celdas de ~1 km y solo se muestran si las reportaron 2+ personas
  (o si son solo tuyas). Para ver zonas hace falta tener un reporte vigente.
- Soporte: máximo 3 mensajes por hora y 10 por día por usuario.

## Producción (Vercel)

`vercel.json` define el enrutado SPA (sin tapar los 404 de `/assets`), cabeceras de
seguridad (CSP, `X-Frame-Options`, `Permissions-Policy`) y caché larga para los assets.
Si cambias de proveedor de teselas o de backend, revisa `img-src` y `connect-src` en la CSP.
