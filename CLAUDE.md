# Glendale — notes for contributors and AI assistants

VK-like social network. Stack: **React** (ReactJS 19, TypeScript, Vite, React Router, TanStack Query) on the client, Node.js server (`server/`, Express + built-in SQLite + WebSocket) and React + Vite client (`client/`). See README.md for running and structure.

## Design direction (keep to it in every UI change)

Premium but **minimal and flat**. The layout stays familiar to VK users (header, left menu, feed, right column), but it must never copy VK's look.

- **No 3D**: no tilt, perspective, floating 3D shapes, glossy/sphere highlights or hover lifts. Depth comes only from translucency and hairline borders.
- **Transitions stay**: smooth fades on route change (`.route-view`), items easing in, hover color/shadow transitions, theme cross-fade (`html.theme-switching`), Uiverse micro-animations. Keep them flat (opacity, color, small 2D offsets); honor `prefers-reduced-motion`.
- **Minimalism**: flat solid accent buttons (no glow, no gloss), few shadows, plenty of whitespace, one accent color.
- **Aurora UI**: a calm, slow aurora backdrop (`<Aurora />`, `.aurora` in `client/src/glass.css`) behind every screen.
- **Light glassmorphism**: surfaces are translucent (`--card`) with `backdrop-filter`, a faint top sheen and hairline rim (`.card::before/::after`). New panels should reuse `.card`. Use `--card-solid` only where something must be opaque (rings around avatars).
- **Typography**: Montserrat (`@fontsource-variable/montserrat`, self-hosted, no external font requests).
- **Palette**: indigo accent (`--btn-primary`, `--accent`); light and dark themes are both first-class. All colors come from tokens in `client/src/styles.css`.
- **Icons**: Lucide only (`lucide-react`).
- **UI elements**: adapted from Uiverse.io (MIT) in `client/src/uiverse.css` / `components/uiverse.tsx`, prefixed `uv-` and wired to theme tokens; credit the original author in a comment.

## Checks

- `npm run typecheck` and `npm run build` (client), `npm test -w server` (API tests).
