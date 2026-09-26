# Glendale — notes for contributors and AI assistants

VK-like social network: Node.js server (`server/`, Express + built-in SQLite + WebSocket) and React + Vite client (`client/`). See README.md for running and structure.

## Design direction (keep to it in every UI change)

The app must look premium ("на все деньги"). The layout stays familiar to VK users (header, left menu, feed, right column), but it must never copy VK's look.

- **Aurora UI**: animated aurora backdrop (`<Aurora />`, `.aurora` in `client/src/glass.css`) behind every screen.
- **Glassmorphism / Liquid Glass**: surfaces are translucent (`--card`) with `backdrop-filter`, a top specular sheen and a refractive gradient rim (`.card::before/::after`). New panels should reuse `.card` rather than inventing opaque boxes. Use `--card-solid` only where something must be opaque (rings around avatars, borders over images).
- **3D / depth**: glossy sphere avatars, lift-on-hover, `useTilt()` for pointer-driven 3D tilt, floating 3D shapes (`.shape3d`). Respect `prefers-reduced-motion`.
- **Typography**: Montserrat (`@fontsource-variable/montserrat`, self-hosted, no external font requests).
- **Palette**: indigo → violet → magenta gradient (`--gradient`); light and dark themes are both first-class. All colors come from tokens in `client/src/styles.css`.
- **Icons**: Lucide only (`lucide-react`).
- **UI elements**: adapted from Uiverse.io (MIT) in `client/src/uiverse.css` / `components/uiverse.tsx`, prefixed `uv-` and wired to theme tokens; credit the original author in a comment.

## Checks

- `npm run typecheck` and `npm run build` (client), `npm test -w server` (API tests).
