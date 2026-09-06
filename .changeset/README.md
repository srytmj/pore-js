# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): one
markdown file per pending change, each declaring which packages bump and by how
much (`patch` / `minor` / `major`).

- Add one with `pnpm changeset` — pick `porejs` / `porejs-react` (they are
  **fixed** together, so one entry bumps both), a bump type, and a summary.
- CI's release workflow runs `changeset version` (updates versions +
  `CHANGELOG.md`) on a "Version Packages" PR, then `changeset publish` on merge.

Not every commit needs a changeset — docs, tests, CI, and demo-only changes
don't. `@pore/demo` is ignored (it's private, never published).
