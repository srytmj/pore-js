# Deploying the demo (homelab)

The demo (`apps/demo`) is a static site. It's built into an `nginx` image and
served from the maintainer's homelab behind its own reverse proxy at
`https://pore.suryatmaja.dev`.

## The image

`apps/demo/Dockerfile` (multi-stage): `pnpm install` → `pnpm gen:fixtures` →
`pnpm build` (packages) → `pnpm --filter @pore/demo build` (Vite) → copy `dist`
into `nginx:1.27-alpine` with `apps/demo/nginx.conf` (SPA fallback, immutable
cache for `/assets/*`, no-cache for `index.html` + `sw.js`, `wasm` /
`webmanifest` MIME types).

Built from the **repo root** (needs the whole workspace):

```bash
docker build -f apps/demo/Dockerfile -t porejs-demo .
docker run --rm -p 8080:80 porejs-demo   # → http://localhost:8080
```

CI (`.github/workflows/release.yml`) builds and pushes it to
`ghcr.io/srytmj/porejs-demo:latest` (and `:<sha>`) **on a real npm publish** —
i.e. when a "Version Packages" PR merges.

## Running it on the homelab

```yaml
# docker-compose.yml  (on the homelab)
services:
  porejs-demo:
    image: ghcr.io/srytmj/porejs-demo:latest
    restart: unless-stopped
    ports:
      - '8081:80' # then point the reverse proxy at :8081
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost/']
      interval: 30s
      timeout: 3s
      retries: 3
```

Pull new images with `docker compose pull && docker compose up -d`, or wire
[watchtower](https://containrrr.dev/watchtower/) / a GHCR webhook.

## Owner checklist (one-time)

- [ ] GHCR package `porejs-demo` set to public (or the homelab logs in to pull).
- [ ] Reverse proxy: `pore.suryatmaja.dev` → the container, TLS via the
      existing setup (Caddy / Traefik / nginx-proxy-manager…).
- [ ] DNS `A` / `AAAA` (or a tunnel) for `pore.suryatmaja.dev`.
- [ ] A repo secret **`NPM_TOKEN`** (an npm automation token) — or configure
      npm **Trusted Publishing** for `porejs` + `porejs-react` pointing at this
      repo's `release.yml` (then no token is needed). See `docs/releasing.md`.

The demo has no backend and no runtime secrets — it fetches its own bundled
fixtures from the same origin.
