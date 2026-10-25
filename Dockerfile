# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS builder
WORKDIR /app

# Declare the build argument
ARG VITE_BASE_PATH=/

COPY package*.json ./
COPY .npmrc ./
RUN --mount=type=secret,id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN npm ci

COPY . .

# Set env var for Vite build step using the ARG
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run build

FROM nginx:alpine AS runtime

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
