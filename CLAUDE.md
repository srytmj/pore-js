# Contributor & agent guide

## Agents: start here

If you are an AI agent, read **[`docs/ai-agent-guide.md`](docs/ai-agent-guide.md)**
first — the repo map, how to run/build/test/verify, the invariants, and the
current milestone. It points to [`docs/architecture.md`](docs/architecture.md)
(engine internals) and [`docs/integration.md`](docs/integration.md) (consuming
the packages).

Then, if you did **not** continue directly from the original chat session, read
[`docs/agent-worklog.md`](docs/agent-worklog.md) — the append-only journal of
what recent sessions did, why, and what is committed vs in-flight vs blocked.
**Append an entry** there whenever you finish a meaningful unit of work (a
commit, a decision, a blocker). It is the narrative layer above git history and
the changelog.

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

See `docs/*-plan.md`. M0–M3 done (`v0.5.0-m3`); UI foundation done (`v0.6.0-ui`,
plus scrubber/loading-error/PDF-search/RTL/end-page follow-ups on `main`);
**M4 done** (`v0.7.0-annotate`) — CFI-precise anchors, text highlights,
fixed-layout EPUB, `OpdsSource`, TTS (`docs/m4-plan.md`). **M5 done**
(`v0.8.0-comfort`) — menu-bar placement/auto-hide, highlight notes +
`<HighlightsPanel>`, PDF Shift-drag highlights (`docs/m5-plan.md`); F3b
(fixed-layout spreads) deferred. **M6 done** (`v0.9.0-editorial`) — editorial
UI redesign of the demo: warm accent-less palette, bundled fonts, one
collapsible menu rail with an inline settings accordion, new landing
(`docs/m6-plan.md`, `docs/design-language.md`). Next milestone not yet scoped.
See `docs/agent-worklog.md` for live status.
