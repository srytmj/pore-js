# Contributor & agent guide

## Commits

- **Conventional Commits**, enforced by `commitlint` via the `.husky/commit-msg`
  hook (`pnpm exec commitlint --edit`). Config: [`commitlint.config.js`](commitlint.config.js).
- House style: `type(scope): <TASK-CODE> — <description>` — e.g.
  `feat(core): I4 — vertical-JP text`. Task code (I4, D3, P1 …) is optional but
  used for milestone work. Scopes in use: `core`, `react`, `demo`, `docs`.
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `build`, `ci`, `perf`.
- **Authorship: the repository owner only.** Never add `Co-authored-by`,
  `Signed-off-by` for anyone else, "Generated with …", or any AI/tool attribution
  trailer or line. One author per commit — the owner.
- One logical change per commit; keep the milestone plans in `docs/` in sync.

## Workspace

pnpm monorepo (`pnpm@9`, via corepack). Packages:

- `packages/reader-core` — framework-agnostic engine (image / text / PDF), sources, offline, search
- `packages/reader-react` — React 19 bindings (`<Reader>`, hooks)
- `apps/demo` — Vite demo

Scripts: `pnpm gen:fixtures` (run on a fresh clone), `pnpm dev`, `pnpm build`,
`pnpm test`, `pnpm lint`, `pnpm typecheck` (`tsc -b --force`). Demo e2e:
`pnpm --filter @pore/demo e2e:install` then `e2e`.

Rebuild `packages/*` (`pnpm build`) before running the demo against changed
engine code — the demo consumes the built `dist/`.

## Milestones

See `docs/*-plan.md`. Current: **M3** (Kavita source, offline, search, vertical
text, a11y) → then `docs/ui-foundation-plan.md`.
