#!/usr/bin/env bash
# Викладка поточного коміту на VDS: ./deploy/deploy.sh [git-ref]
# Потрібні змінні VDS_HOST, VDS_PORT, VDS_USER і SSH-ключ (VDS_KEY_FILE, за замовчуванням ~/.ssh/vds).
set -euo pipefail

REF="${1:-HEAD}"
KEY="${VDS_KEY_FILE:-$HOME/.ssh/vds}"
SSH=(ssh -i "$KEY" -p "${VDS_PORT:-22}" -o StrictHostKeyChecking=accept-new "$VDS_USER@$VDS_HOST")

cd "$(git rev-parse --show-toplevel)"
REVISION="$(git rev-parse --short "$REF") $(git log -1 --format=%s "$REF")"

echo "→ Синхронізація $REVISION"
TMP="$(mktemp -d)"
git archive "$REF" | tar -x -C "$TMP"
echo "$REVISION" > "$TMP/REVISION"

rsync -az --delete \
    --exclude='/.env' --exclude='/storage/' --exclude='/vendor/' --exclude='/node_modules/' \
    --exclude='/public/build/' --exclude='/public/storage' --exclude='/bootstrap/cache/*.php' \
    -e "ssh -i $KEY -p ${VDS_PORT:-22}" "$TMP/" "$VDS_USER@$VDS_HOST:/var/www/gamecon/"
rm -rf "$TMP"

"${SSH[@]}" 'mkdir -p /var/www/gamecon/storage/{app/public,framework/{cache,sessions,views},logs} && bash /var/www/gamecon/deploy/remote.sh'
