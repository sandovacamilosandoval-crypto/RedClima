# RedClima

Mapa del clima **colaborativo y en tiempo real**: cada persona reporta el clima que ve
en su ubicación (soleado, nublado, lluvia, tormenta) y el mapa se colorea por zonas.
Para ver el mapa, primero debes aportar un reporte.

## Stack

- React 19 + Vite
- Ant Design (UI)
- Leaflet / react-leaflet (mapa, teselas de CARTO/OpenStreetMap)
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

## Estado actual

Prototipo de frontend: el login con Google es simulado y los reportes viven solo en el
navegador (no se comparten entre usuarios todavía). Ver la sección de pendientes.
