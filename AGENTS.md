# Pyfolio Dashboard agent guide

## Structure and responsibilities

- `src/App.tsx` contains the application shell, route handling, reference-data tables and create/edit views.
- `src/api.ts` owns optional API base URL handling, resource types, query construction and HTTP error handling. Keep network calls behind this module.
- `src/App.css` and `src/index.css` define application layout and responsive styling; use `@marvey11/codescape-ui` for shared controls and `@marvey11/codescape-react-utils` for shared hooks.
- `vite.config.ts` configures the frontend base path and Vitest. The container mount path is `/pyfolio/`; local Vite defaults to `/`.
- `Dockerfile` builds the static app and serves it with Nginx; its SPA fallback handles refreshes on nested frontend routes.

The API is maintained in the sibling `../pyfolio-backend` repository. Inspect its implementation before changing API usage; keep it read-only. The gateway is maintained separately and must not be changed from this repository.

## Development and quality commands

Use Node.js 24 and npm. Configure private GitHub Packages access with `NODE_AUTH_TOKEN` without committing a token, then run:

- `npm ci`
- `npm run dev` (`VITE_API_BASE_URL` is optional; requests use the dashboard origin when omitted)
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test:coverage`
- `npm run build` (`VITE_API_BASE_URL` is optional; requests use the dashboard origin when omitted)

## Conventions

Use TypeScript strict mode, semantic HTML, keyboard-accessible controls and British/International English. Do not invent or leak API details: keep the API base URL optional, defaulting to the public same-origin prefix `/api/v1/pyfolio`, and translate request errors into useful user-facing messages. The gateway rewrites API requests under that prefix to the backend's `/api/v1` routes. Security and country list endpoints return `{ items, pagination }`, with authoritative 1-based `page`, `pageSize`, total counts and previous/next flags. Send `page` and `pageSize`; do not infer navigation from the row count. Persist sort preferences and the validated last-used page size in browser storage, using separate keys for securities and countries. Do not persist filters or the current page.

Keep this app within the current security and country CRUD scope. Add or update mocked API tests for user-visible behaviour and request contracts. Do not weaken configured checks.
