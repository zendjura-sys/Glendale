---
version: 2
name: GameCon
direction: Quiet Arena
description: |
    Premium dark-first social network for gamers. One refined blue accent on
    near-black canvases, Montserrat Variable, hairline glass, product UI as
    the hero. Quiet luxury (Linear + Apple) meets gaming social depth (Discord),
    without neon rainbow decoration.
sources:
    - design-refs/awesome-design-md/linear.app/DESIGN.md
    - design-refs/awesome-design-md/apple/DESIGN.md
    - design-refs/awesome-design-md/playstation/DESIGN.md
    - design-refs/awesome-design-md/spotify/DESIGN.md
    - open-design:discord (chat depth)
    - 21st: floating glassmorphic navbar (header craft)
skills:
    - design-taste-frontend
    - open-design
    - frontend-design
---

# GameCon — Quiet Arena

Tokens live in `resources/css/app.css` (`--color-gc-*`, `--glass`, skin
`gamecon`). Do not invent a parallel palette.

## Atmosphere

- Canvas: near-black `#03050a` → abyss `#070b14` → deep `#0c1220`.
- Surfaces: charcoal glass with **hairline** rims (`rgb(255 255 255 / 0.08–0.12)`),
  soft depth shadow — not neon frames, not rainbow gradients on chrome.
- Single accent: GameCon blue `#2f7bff` (hover brighter). Mint/cyan only for
  live / online / success. Gold only for rewards.
- Product UI and real game moments carry marketing pages; atmospheric orbs stay
  quiet (one soft wash, not multi-color mesh).

## Typography

- Family: Montserrat Variable (self-hosted).
- Display: semibold–bold (600–700), tracking `-0.03em` to `-0.04em`, not
  extrabold-by-default.
- Brand wordmark in the first viewport outranks any supporting headline.
- Body 15–17px at `white/55–70`.

## Shape & chrome

- Controls: `rounded-control` / pills for floating bars.
- Cards/panels: `rounded-2xl` with hairline + optional inset top highlight.
- Primary CTA: solid `--primary`, inset highlight only — no glow bloom.
- Floating header: liquid/ios glass island with top-edge specular line; denser
  when scrolled (21st floating-navbar craft).

## Motion

- One hero entrance; section `Reveal` on scroll.
- Hover: 2px lift on linked panels, button press, underline draw.
- Respect `useReducedMotion` / data-saver.

## Composition (welcome / marketing)

1. First viewport: brand · one headline · one line · CTA group · one product visual.
2. No card grid and no stat strip in the hero.
3. Feature chapters below the fold — one job per section.
4. Equal left/right edges (`max-w-[1240px]` guest, `--gc-shell-max` app).

## Layout lock

Keep the existing GameCon window format: guest island header, social
`gc-vk-shell` columns (dock · main · side rail), floating ios glass topbar /
tabbar / player capsules, and current breakpoint column rules. Visual polish
changes materials and type — **not** panel placement or shell structure.

## Do / don't

- Do: taste-skill house rules on new public pages; open-design for decks/audits;
  brand `DESIGN.md` under `design-refs/awesome-design-md/<slug>/` when asked
  «в этом стиле».
- Don't: purple-on-white SaaS kits, cream+serif terracotta, broadsheet hairlines,
  multi-accent neon chrome, Inter/Roboto stacks.
