#!/usr/bin/env bash
# Браузерна перевірка сайту після деплою (deploy/smoke.mjs). Запускає server-deploy.sh наприкінці; можна й руками:
#   bash deploy/smoke.sh [адреса…]
#
# Chromium (headless shell) і playwright-core ставляться один раз у $SMOKE_DIR, поза кодом сайту.
# Системні бібліотеки для нього (один раз, під root):
#   apt-get install -y libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxcomposite1 libxdamage1 \
#       libxext6 libxfixes3 libxrandr2 libgbm1 libasound2t64
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SMOKE_DIR="${SMOKE_DIR:-/root/.cache/gamecon-smoke}"
PW_VERSION=1.50.1
[ $# -gt 0 ] || set -- https://gamecon.online/ https://gamecon.online/login

mkdir -p "$SMOKE_DIR"
if [ ! -d "$SMOKE_DIR/node_modules/playwright-core" ]; then
    (cd "$SMOKE_DIR" && { [ -f package.json ] || echo '{"private":true}' > package.json; } \
        && npm install --silent --no-audit --no-fund "playwright-core@$PW_VERSION" >/dev/null)
fi
SHELL_BIN=$(find "$SMOKE_DIR/browsers" -type f -name headless_shell 2>/dev/null | head -1 || true)
if [ -z "$SHELL_BIN" ]; then
    # Playwright ще не знає нових Ubuntu — збірка для 24.04 працює й на новіших.
    (cd "$SMOKE_DIR" && PLAYWRIGHT_BROWSERS_PATH="$SMOKE_DIR/browsers" PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 \
        npx playwright-core install --only-shell chromium >/dev/null 2>&1) || true
    SHELL_BIN=$(find "$SMOKE_DIR/browsers" -type f -name headless_shell 2>/dev/null | head -1 || true)
fi
if [ -z "$SHELL_BIN" ]; then
    echo "⚠ Браузерна перевірка пропущена: не вдалося завантажити Chromium" >&2
    exit 0
fi
MISSING=$(ldd "$SHELL_BIN" | grep 'not found' | awk '{print $1}' | tr '\n' ' ' || true)
if [ -n "$MISSING" ]; then
    echo "⚠ Браузерна перевірка пропущена: бракує бібліотек $MISSING(див. шапку deploy/smoke.sh)" >&2
    exit 0
fi

echo "→ Перевірка в браузері"
node "$DIR/smoke.mjs" "$SMOKE_DIR" "$SHELL_BIN" "$@"
