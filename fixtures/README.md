# fixtures/

Content that powers the demo and tests. **No copyrighted material.**

## Image fixtures (M0) — generated

`apps/demo/public/fixtures/` holds procedurally generated SVG "pages" so the demo
and `DemoSource` tests need no network and no third-party art:

| id | shape | notes |
|---|---|---|
| `demo-manga` | 12 pages, 840×1200, RTL, `paged-double` | page 6 is a wide 1680×1200 spread (`isWide`) |
| `demo-webtoon` | 8 strips, 800×2200, vertical, `continuous-vertical` | — |

Regenerate with:

```bash
pnpm gen:fixtures
```

Source: [`scripts/gen-fixtures.mjs`](../scripts/gen-fixtures.mjs). CC0.

## Text fixtures (M1) — to add

| Path | Content | License |
|---|---|---|
| `gutenberg-*.epub` | Project Gutenberg texts | Public domain |
| `sample.pdf` | Public-domain PDF | Public domain |

Each carries its own `LICENSE` / `SOURCE.md`.
