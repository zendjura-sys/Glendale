#!/usr/bin/env bash
# LibreTranslate — безкоштовний перекладач без ліміту символів на цьому ж сервері (запасний до DeepL).
# Запуск: INSTALL_LIBRETRANSLATE=1 під час деплою (deploy/remote.sh) або вручну: bash deploy/libretranslate.sh
# Мови — усі мови інтерфейсу GameCon (LT_LANGUAGES, через пробіл); переклад між рідкісними парами йде через англійську.
# Потрібно: ~4–6 ГБ RAM для всіх мов (лише uk/en/pl/de — ~2 ГБ), кілька ГБ диска, Python 3.10+.
# Повторний запуск безпечний: оновлює пакет і перезапускає службу.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=/opt/libretranslate
LANGS="${LT_LANGUAGES:-uk en pl de es fr it ja ko zh ru kk}"

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
# Англійська потрібна завжди: через неї перекладаються пари без прямої моделі (uk → ja тощо).
sudo -u libretranslate env HOME="$DIR" LANGS="$LANGS en" "$DIR/venv/bin/python" - <<'PY' || true
import os
import argostranslate.package as p
wanted = set(os.environ["LANGS"].split())
p.update_package_index()
installed = {(x.from_code, x.to_code) for x in p.get_installed_packages()}
for pkg in p.get_available_packages():
    if pkg.from_code in wanted and pkg.to_code in wanted and (pkg.from_code, pkg.to_code) not in installed:
        print(f"  модель {pkg.from_code} → {pkg.to_code}")
        p.install_from_path(pkg.download())
PY

# Служба вантажить лише ті мови, моделі яких справді встановились (незнайома мова в --load-only не дає їй стартувати).
LOADED=$(sudo -u libretranslate env HOME="$DIR" LANGS="$LANGS en" "$DIR/venv/bin/python" - <<'PY'
import os
import argostranslate.package as p
wanted = set(os.environ["LANGS"].split())
have = set()
for x in p.get_installed_packages():
    have.update({x.from_code, x.to_code})
print(",".join(sorted(wanted & have)) or "uk,en")
PY
)
echo "LT_LOAD_ONLY=$LOADED" | sudo tee "$DIR/languages.env" >/dev/null
echo "Мови LibreTranslate: $LOADED"

sudo cp deploy/systemd/libretranslate.service /etc/systemd/system/libretranslate.service
sudo systemctl daemon-reload
sudo systemctl enable --now libretranslate >/dev/null 2>&1
sudo systemctl restart libretranslate

# Перший старт довгий (завантаження моделей у пам'ять): чекаємо до 6 хв.
for _ in $(seq 1 72); do
    if curl -fsS http://127.0.0.1:5000/languages >/dev/null 2>&1; then
        echo "✓ LibreTranslate працює: http://127.0.0.1:5000"
        exit 0
    fi
    sleep 5
done
echo "⚠ LibreTranslate ще не відповідає — перевірте: sudo journalctl -u libretranslate -n 50" >&2
