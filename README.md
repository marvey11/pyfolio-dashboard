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

By default, API requests use the same origin as the dashboard. To use a separate
API host, set `VITE_API_BASE_URL` in a local `.env` file:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Start local development with `npm run dev`. The development server runs at the configured frontend base path; `VITE_BASE_PATH=/` may be useful for a root-hosted local preview.

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
  --secret id=npm_token,env=NODE_AUTH_TOKEN \
  --build-arg VITE_BASE_PATH=/pyfolio/ \
  -t pyfolio-dashboard .
```

`VITE_BASE_PATH` controls asset URLs and the SPA mount path; it does not configure API proxying. Nginx inside the container falls back to `index.html` for nested routes.

The gateway example in the implementation brief strips `/pyfolio/` before forwarding to this container. The built assets therefore need to be served at the container root, which this image does, while the emitted asset URLs retain `/pyfolio/`. Configure the gateway to serve or rewrite those prefixed asset requests to the container root as required by its proxy behaviour.

The current backend does not configure CORS, so a separate API origin cannot be called directly by browsers unless CORS is added there. For same-origin deployment, add a gateway API location (for example `/api/`) that strips its prefix and forwards to the backend, whose routes are rooted at `/securities` and `/countries`; set `VITE_API_BASE_URL` to that public API prefix, such as `https://example.com/api`. Configure the gateway separately for both the `/pyfolio/` frontend and API paths. No gateway configuration is included here. GitHub Actions builds require the repository variable `VITE_API_BASE_URL` to be set to the deployment API base URL.
