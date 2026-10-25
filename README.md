# Pyfolio Dashboard

Pyfolio Dashboard is the React frontend for maintaining the security and country reference data used by the Pyfolio portfolio tracker. It is designed for long-term portfolio evaluation workflows, not real-time quote tracking.

## Workspace and architecture

This repository contains the frontend. The API lives in the sibling `../pyfolio-backend` workspace, and the deployment gateway is maintained in a separate repository. `src/api.ts` is the sole HTTP client boundary; `src/App.tsx` contains the application shell, navigation, tables and resource forms. Shared controls and theme come from `@marvey11/codescape-ui`; shared browser storage comes from `@marvey11/codescape-react-utils`.

Current scope includes securities and countries list, create, edit and delete operations. Lists use API pagination and sorting, with security filters for instrument type and country. The API returns plain arrays without a total, so the interface enables Next when a page contains its full requested size. It does not display an invented total count.

## Setup

Use Node.js 24 and npm. The Codescape packages are hosted on GitHub Packages. Provide a `NODE_AUTH_TOKEN` with `read:packages` access, then install dependencies:

```sh
npm ci
```

By default, API requests use the same origin as the dashboard, with the public API base `/api/v1/pyfolio`. Leave `VITE_API_BASE_URL` unset for this behaviour. To use a different API host or prefix, set the optional variable in a local `.env` file:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Start local development with `npm run dev`. The development server runs at the configured frontend base path; `VITE_BASE_PATH=/` may be useful for a root-hosted local preview.

The same-origin default works in local development only when the dashboard is reached through a proxy that routes `/api/v1/pyfolio/*` to the backend API. Vite's development server does not proxy API requests. A direct API origin override requires that origin to allow the dashboard through CORS; the current backend does not enable CORS by default. When bypassing the gateway and calling the API directly, use its `/api/v1` base path.

## Checks

```sh
npm run format:check
npm run typecheck
npm run lint
npm run test:coverage
npm run build
```

Tests mock HTTP requests and do not require a running backend.

## Container build and deployment

Build with BuildKit because the private package token is passed as a build secret, not an image build argument:

```sh
docker build \
  --secret id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN \
  --build-arg VITE_BASE_PATH=/pyfolio/ \
  -t pyfolio-dashboard .
```

`VITE_BASE_PATH` controls asset URLs and the SPA mount path; it does not configure API proxying. `VITE_API_BASE_URL` is optional at build time: when omitted or empty, the built app calls the same origin at `/api/v1/pyfolio`. It can be passed as a Docker build argument when a different API host or path prefix is needed, for example `--build-arg VITE_API_BASE_URL=https://example.com/api/v1`. Nginx inside the container falls back to `index.html` for nested dashboard routes.

The dashboard is mounted under `/pyfolio/`; the gateway forwards those page and asset requests to this container, which serves the built files at its root. API requests use the separate public prefix `/api/v1/pyfolio` and must be rewritten by the gateway to `/api/v1` before reaching the backend. The gateway therefore handles two distinct public prefixes: `/pyfolio/` for dashboard pages/assets and `/api/v1/pyfolio/` for API resources. The SPA routes themselves remain under the dashboard mount and are served through the Nginx fallback.

With `VITE_API_BASE_URL` unset, API requests go to `/api/v1/pyfolio/securities` and `/api/v1/pyfolio/countries` on the dashboard's origin. The gateway rewrites that public prefix to the API's `/api/v1` prefix. Keep the dashboard mount at `/pyfolio/` so the SPA page and API resource URLs do not collide. An absolute API URL can also be supplied when the API is hosted separately, but that origin must allow the dashboard through CORS. No gateway configuration is included here. CI and Docker builds leave `VITE_API_BASE_URL` unset by default, so they use this same-origin API prefix; pass a build-time override only when deployment requires a different API base.
