---
'porejs': minor
'porejs-react': minor
---

Mobile gestures and an on-screen menu affordance. Horizontal swipe turns the
page in both engines (touch only — mouse drag stays selection); `touch-action`
is set deliberately so the browser owns scroll and drops the tap delay;
double-tapping an image toggles fit ↔ 2× at the tap point (`doubleTapZoom`).
Each engine now renders a faint bottom-centre chrome handle
(`button[data-pore-chrome-handle]`) that toggles your chrome; the new
`chromeGesture` setting (`'handle'` default · `'tap-center'` · `'long-press'` ·
`'handle+long-press'` · `'none'`) picks how the menu opens. `ChromeGesture` is
exported from `porejs`.
