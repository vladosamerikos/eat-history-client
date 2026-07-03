# FoodCommit web client

PWA frontend: Vite + React + TS + Tailwind + i18n + PWA + Framer Motion + GSAP.

## Desarrollo

```bash
cp .env.example .env
npm install
npm run dev
```

App en `http://localhost:5173`. Las llamadas a `/v1/*` se proxean al backend (`VITE_API_PROXY_TARGET`, default `http://localhost:3000`).

## Con Docker

```bash
docker compose -f docker-compose.development.yml up --build
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — build producción
- `npm run preview` — preview del build
- `npm run lint` — ESLint con autofix
- `npm run typecheck` — TS sin emitir
- `npm run format` — Prettier

## Estructura

Ver [`plan.md`](../plan.md) sección 3.
