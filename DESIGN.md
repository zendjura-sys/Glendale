---
version: 3
name: GameCon
direction: Arena Black
description: |
    Radical premium social look. Spotify content-first darkness (#121212 theater)
    + Linear quiet luxury + singular GameCon electric blue. Display = Unbounded
    (expressive), UI = Manrope. Pills, heavy elevation, one accent — no neon rainbow.
sources:
    - design-refs/awesome-design-md/spotify/DESIGN.md
    - design-refs/awesome-design-md/linear.app/DESIGN.md
    - design-refs/awesome-design-md/apple/DESIGN.md
    - 21st: classy-hero / floating glass navbar
skills:
    - design-taste-frontend
    - open-design
    - frontend-design
---

# GameCon — Arena Black

## Why this direction

A gaming social network should feel like a **night venue**: UI recedes into
charcoal so people, clips, and rooms glow. Spotify’s theater + Linear’s craft
beat generic “neon SaaS purple.”

## Palette (singular accent)

| Role    | Hex       | Use                          |
| ------- | --------- | ---------------------------- |
| Void    | `#0a0a0a` | Page canvas                  |
| Surface | `#121212` | Cards / posts (L1)           |
| Raised  | `#181818` | Dock / menus (L2)            |
| Hover   | `#222222` | L3                           |
| Ink     | `#ffffff` | Primary text                 |
| Mute    | `#a7a7a7` | Secondary                    |
| Accent  | `#3d8bff` | CTA, active, links only      |
| Live    | `#1ed760` | Online / voice (Spotify cue) |

No decorative purple/pink gradients on chrome.

## Typography

- **Display:** Unbounded Variable — marketing heroes, page titles
- **UI:** Manrope Variable — app chrome, body, forms
- Display tracking tight (`-0.04em`), weight 600–700
- Buttons: semibold, optional slight tracking (not ALL CAPS spam)

## Shape

- Floating chrome: **full pills** (9999px) — header island, CTAs
- Content cards: 16–20px radius, elevated shadow `0 8px 24px rgb(0 0 0 / 0.45)`
- Inputs: soft pills / 14px radius

## Layout lock

Keep `gc-vk-shell` columns, dock · main · rail, floating topbar/tabbar/player,
guest island header placement. Change materials and type only.

## Brand refs

Put `design-refs/awesome-design-md/<brand>/DESIGN.md` in context for «в этом стиле».
