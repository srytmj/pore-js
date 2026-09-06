# Static build of the Pore.js demo, served by nginx. Built from the repo root:
#   docker build -f apps/demo/Dockerfile -t porejs-demo .
# See docs/deploy.md.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app

# install deps (leverages the layer cache on lockfile-only changes)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/reader-core/package.json packages/reader-core/
COPY packages/reader-react/package.json packages/reader-react/
COPY apps/demo/package.json apps/demo/
COPY examples/host-app/package.json examples/host-app/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm gen:fixtures \
 && pnpm build \
 && pnpm --filter @pore/demo build

FROM nginx:1.27-alpine AS runtime
COPY apps/demo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/demo/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
