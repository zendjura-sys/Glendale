#!/usr/bin/env bash
# LibreTranslate — безкоштовний перекладач без ліміту символів на цьому ж сервері (запасний до DeepL).
# Запуск: INSTALL_LIBRETRANSLATE=1 під час деплою (deploy/remote.sh) або вручну: bash deploy/libretranslate.sh
# Потрібно: ~2–4 ГБ RAM (моделі uk, en, pl, de), кілька ГБ диска, Python 3.10+.
# Повторний запуск безпечний: оновлює пакет і перезапускає службу.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=/opt/libretranslate

# Python з venv.
command -v python3 >/dev/null 2>&1 && python3 -c 'import venv, ensurepip' 2>/dev/null \
    || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 python3-venv python3-pip >/dev/null

# Окремий системний користувач без входу.
id libretranslate >/dev/null 2>&1 || sudo useradd --system --home-dir "$DIR" --shell /usr/sbin/nologin libretranslate
sudo mkdir -p "$DIR"
sudo chown libretranslate:libretranslate "$DIR"

[ -x "$DIR/venv/bin/python" ] || sudo -u libretranslate python3 -m venv "$DIR/venv"
sudo -u libretranslate "$DIR/venv/bin/pip" install -q --upgrade pip
sudo -u libretranslate "$DIR/venv/bin/pip" install -q --upgrade libretranslate

# Моделі мов завантажуються один раз (кілька сотень МБ на пару мов).
sudo -u libretranslate env HOME="$DIR" "$DIR/venv/bin/python" - <<'PY' || true
import argostranslate.package as p
wanted = {"uk", "en", "pl", "de"}
p.update_package_index()
installed = {(x.from_code, x.to_code) for x in p.get_installed_packages()}
for pkg in p.get_available_packages():
    if pkg.from_code in wanted and pkg.to_code in wanted and (pkg.from_code, pkg.to_code) not in installed:
        p.install_from_path(pkg.download())
PY

sudo cp deploy/systemd/libretranslate.service /etc/systemd/system/libretranslate.service
sudo systemctl daemon-reload
sudo systemctl enable --now libretranslate >/dev/null 2>&1
sudo systemctl restart libretranslate

# Перший старт довгий (завантаження моделей у пам'ять): чекаємо до 3 хв.
for _ in $(seq 1 36); do
    if curl -fsS http://127.0.0.1:5000/languages >/dev/null 2>&1; then
        echo "✓ LibreTranslate працює: http://127.0.0.1:5000"
        exit 0
    fi
    sleep 5
done
echo "⚠ LibreTranslate ще не відповідає — перевірте: sudo journalctl -u libretranslate -n 50" >&2
