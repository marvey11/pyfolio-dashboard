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

By default, API requests use the same origin as the dashboard. Leave `VITE_API_BASE_URL` unset for this behaviour. To use a separate API host or an API path prefix, set the optional variable in a local `.env` file:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Start local development with `npm run dev`. The development server runs at the configured frontend base path; `VITE_BASE_PATH=/` may be useful for a root-hosted local preview.

The same-origin default works in local development only when the dashboard is reached through a proxy that also routes the API paths. Vite's development server does not proxy API requests. A direct API origin override requires that origin to allow the dashboard through CORS; the current backend does not enable CORS by default.

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

`VITE_BASE_PATH` controls asset URLs and the SPA mount path; it does not configure API proxying. `VITE_API_BASE_URL` is optional at build time: when omitted or empty, the built app makes requests to the current browser origin. It can be passed as a Docker build argument when a separate API host or path prefix is needed, for example `--build-arg VITE_API_BASE_URL=/api`. Nginx inside the container falls back to `index.html` for nested routes.

The gateway example in the implementation brief strips `/pyfolio/` before forwarding to this container. The built assets therefore need to be served at the container root, which this image does, while the emitted asset URLs retain `/pyfolio/`. Configure the gateway to serve or rewrite those prefixed asset requests to the container root as required by its proxy behaviour.

With the variable unset, browser requests go to `/securities` and `/countries` on the dashboard's origin. The gateway must route those API paths to the backend and `/pyfolio/` to the frontend. If the gateway exposes the API below a prefix such as `/api/`, set `VITE_API_BASE_URL=/api`; the gateway must strip that prefix before forwarding because backend routes are rooted at `/securities` and `/countries`. An absolute API URL can also be supplied when the API is hosted separately, but that origin must allow the dashboard through CORS. No gateway configuration is included here. CI and Docker builds leave `VITE_API_BASE_URL` unset by default, so they use same-origin requests; pass a build-time override only when deployment requires a different API base.
