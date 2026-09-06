# Releasing

`porejs` and `porejs-react` are versioned together (Changesets `fixed`) and
published to npm with **provenance**. `@pore/demo` is private.

## The flow

1. **Every PR that changes a published package's behaviour** adds a changeset:

   ```bash
   pnpm changeset   # pick porejs / porejs-react, a bump type, write a summary
   ```

   Commit the generated `.changeset/*.md`. (Docs / tests / CI / demo-only
   changes don't need one.)

2. **On merge to `main`**, `.github/workflows/release.yml` runs
   `changesets/action`:
   - while changesets are pending → it opens/updates a **"chore: version
     packages"** PR that bumps versions + rewrites `CHANGELOG.md`;
   - when that PR is merged (no changesets left) → it runs `pnpm release`
     (`build` → `verify-packages` → `changeset publish`), which publishes the
     bumped packages and pushes their git tags.

3. A successful publish also builds + pushes the demo image to GHCR
   (`docs/deploy.md`).

## `1.0.0`

Packages sit at `1.0.0-rc.N` through M8. When the corpus + cross-browser +
a11y work is settled, a changeset bumps `rc → 1.0.0` and the tag `v1.0.0` is
cut (M8 H10).

## Auth (one-time, owner)

`release.yml` needs to authenticate to npm. Either:

- **A repo secret `NPM_TOKEN`** — an npm *automation* token
  (npmjs.com → Access Tokens → Generate → Automation). Simple.
- **Trusted Publishing (no token)** — on npmjs.com, for each of `porejs` and
  `porejs-react`, add a trusted publisher: this repo (`srytmj/pore-js`),
  workflow `release.yml`. Provenance still works; nothing to rotate. For the
  *first* publish the package must already exist, so do the first `1.0.0-rc.1`
  publish with a token, then switch.

`publishConfig.provenance: true` is already set in both `package.json`s, and
`release.yml` has `id-token: write`.

The release job is **dormant** until the owner sets repo **variable**
`RELEASE_ENABLED=true` (Settings → Secrets and variables → Actions → Variables).
Until then it's skipped on every push — safe to have merged.

## Branch protection (owner, recommended)

On `main`: require PRs, require the `check` (node 20 + 22), `corpus`, and `e2e`
(chromium / firefox / webkit) status checks, and a linear history.
