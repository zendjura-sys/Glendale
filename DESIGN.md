---
version: 1
name: GameCon
description: |
    Dark-first social network for gamers. Neon blue/indigo accents on deep void
    canvases, Montserrat Variable for UI and display, glass surfaces, one job
    per section. Product UI and real game moments carry the page — not abstract
    mesh gradients alone.
sources:
    - design-refs/awesome-design-md/playstation/DESIGN.md
    - design-refs/awesome-design-md/spotify/DESIGN.md
    - open-design:discord (voice/chat depth model)
skills:
    - design-taste-frontend
    - open-design
---

# GameCon design system

Use this file when restyling or building UI. Brand tokens live in
`resources/css/app.css` (`--color-gc-*`, `--color-void`, `--font-sans`).

## Atmosphere

- Dark-first: void `#070914` / abyss `#0a0e1c` / deep `#0f1426`.
- Primary accent: GameCon blue `#4f8bff` → indigo `#6d5dfc` → violet `#a855f7`.
- Success / live / voice: mint `#22d3a6` and cyan `#38e1ff`.
- Commerce / reward: gold `#f5c451` / amber `#f5b342`.
- Glass panels (`glass`, `glass-strong`) over the site background — not flat gray cards.
- Shape: `rounded-2xl` for panels, `rounded-control` for inputs, `rounded-chip` for badges.

## Typography

- UI + display: Montserrat Variable (self-hosted). No Inter / Roboto / system-only stacks.
- Hero display: extrabold, tight tracking, clamp ~2.6–4.8rem, line-height ~1.02.
- Body: 15–17px, white/60–75 on dark.
- One clear hierarchy per section — brand or product name must outrank any supporting headline on marketing surfaces.

## Motion

- Prefer existing `RISE` / `Reveal` / `data-enter` patterns in `@/lib/motion`.
- Hover: linked cards lift ~2px; buttons press; underlines draw. No tilt carousels.
- Respect `useReducedMotion`.

## Composition (marketing / welcome)

1. First viewport = one composition: brand, one headline, one short line, one CTA group, one dominant visual.
2. No card grid in the hero. Feature tiles start below the fold.
3. Imagery shows the product (feed mock, voice room, GameCast) — not empty gradient slabs.
4. Equal left/right content edges inside the shell (`max-w-[1240px]` guest, `--gc-shell-max` app).

## Do / don't

- Do: follow `design-taste-frontend` house rules for new landing/marketing work; run its browser gate when shipping a new public page.
- Do: when the user says «в стиле X», open `design-refs/awesome-design-md/<brand>/DESIGN.md` (apple, nike, spotify, spacex, playstation, …) and apply that palette/type/layout vocabulary without copying trademarks/logos.
- Do: for decks, prototypes, brand audits — invoke the `open-design` skill (local catalogue at `~/.open-design-skill/repo`, binding in `.open-design.json`).
- Don't: swap GameCon blue for generic purple-on-white SaaS kits, cream+serif terracotta kits, or broadsheet hairline newspaper layouts.
- Don't: invent a second parallel token set — extend `@theme` in `app.css` and document here.

## Brand references in-repo

| Brand       | Path                                         | Use when…                          |
| ----------- | -------------------------------------------- | ---------------------------------- |
| PlayStation | `design-refs/awesome-design-md/playstation/` | Console / launch / chaptered dark  |
| Spotify     | `design-refs/awesome-design-md/spotify/`     | Media-forward, bold type on dark   |
| Apple       | `design-refs/awesome-design-md/apple/`       | Quiet premium product storytelling |
| Nike        | `design-refs/awesome-design-md/nike/`        | Kinetic sport energy               |
| SpaceX      | `design-refs/awesome-design-md/spacex/`      | Technical, sparse, high-contrast   |
| Cursor      | `design-refs/awesome-design-md/cursor/`      | Dev-tool density                   |
| Full set    | `design-refs/awesome-design-md/` (84 brands) | «сделай в этом стиле»              |
