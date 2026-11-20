#!/usr/bin/env bash
# Install / refresh Cursor + Claude design skills used by GameCon agents.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> taste-skill (design-taste-frontend)"
npx --yes skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend -a cursor -a claude-code -y

echo "==> open-design-skill"
npx --yes skills add sugarforever/open-design-skill -a cursor -a claude-code -y

OD_ROOT="${OPEN_DESIGN_ROOT:-$HOME/.open-design-skill/repo}"
if [[ ! -d "$OD_ROOT/.git" ]]; then
  echo "==> cloning Open Design catalogue → $OD_ROOT"
  mkdir -p "$(dirname "$OD_ROOT")"
  git clone --depth 1 https://github.com/nexu-io/open-design.git "$OD_ROOT"
else
  echo "==> Open Design catalogue present at $OD_ROOT"
fi

if [[ ! -d "$ROOT/design-refs/awesome-design-md/apple" ]]; then
  echo "==> vendoring awesome-design-md"
  tmp="$(mktemp -d)"
  git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git "$tmp/adm"
  mkdir -p "$ROOT/design-refs/awesome-design-md"
  rsync -a "$tmp/adm/design-md/" "$ROOT/design-refs/awesome-design-md/"
  rm -rf "$tmp"
fi

echo "OK — see DESIGN.md, .open-design.json, .cursor/rules/design-skills.mdc"
