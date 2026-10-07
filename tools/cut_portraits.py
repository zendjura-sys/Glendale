#!/usr/bin/env python3
"""Нарезка листов эмоций (assets/portraits/sheets/*.jpg) на отдельные портреты.

Для каждой панели листа:
  1. фон убирается заливкой от краёв панели (или по «серости» для тетрадного фона);
  2. остаётся самая крупная связная фигура (подписи ANGRY/… и искры отбрасываются);
  3. фигура кадрируется по пояс/плечи и сохраняется в PNG с прозрачностью.
Листы с нарисованным фоном (keep_bg) сохраняются карточками с мягкими краями.
Запуск: python3 tools/cut_portraits.py   (нужны Pillow, numpy, scipy)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ROOT / "assets" / "portraits" / "sheets"
OUT = ROOT / "assets" / "portraits" / "expressions"

COLS3 = (0, 256, 512, 768)


def grid3(names, rows):
    """Сетка из 3 колонок: rows — список пар (y0, y1)."""
    panels = []
    for r, (y0, y1) in enumerate(rows):
        for c in range(3):
            if r * 3 + c < len(names):
                panels.append((names[r * 3 + c], COLS3[c], y0, COLS3[c + 1], y1))
    return panels


SIX = ["neutral", "angry", "surprised", "cheerful", "in_love", "sad"]

# Панели: (эмоция, x0, y0, x1, y1) в координатах листа.
# bust — доля высоты фигуры от макушки в портрете (1.0 — фигура целиком).
# head_band — по какой полосе высоты фигуры искать голову (посох/рога не сбивают центр).
SHEET_CONFIG = {
    # Верховный демон Баг: 2x3, без подписей, бюсты.
    "demon": dict(panels=[("smug", 0, 0, 384, 455), ("angry", 384, 0, 768, 455),
                          ("laugh", 0, 455, 384, 915), ("scheming", 384, 455, 768, 915),
                          ("surprised", 0, 915, 384, 1376), ("menace", 384, 915, 768, 1376)],
                  bust=1.0),
    # Сильвия: карточки с нарисованным фоном, подписи отрезаем.
    "elf": dict(panels=[("angry", 34, 60, 374, 400), ("surprised", 394, 60, 734, 400),
                        ("cheerful", 34, 478, 374, 818), ("in_love", 394, 478, 734, 818),
                        ("sad", 34, 894, 374, 1234), ("neutral", 394, 894, 734, 1234)],
                keep_bg=True),
    # Мими: лист 2x2 и отдельная «грусть».
    "twintails": dict(panels=[("angry", 0, 95, 384, 688), ("surprised", 384, 95, 768, 688),
                              ("cheerful", 0, 783, 384, 1376), ("in_love", 384, 783, 768, 1376)],
                      bust=0.62),
    "twintails_sad": dict(panels=[("sad", 0, 0, 768, 1376)], bust=0.33, out="twintails"),
    # Аурелий: 3x2, подписи снизу.
    "archmage": dict(panels=grid3(SIX, [(0, 625), (690, 1300)]), bust=0.42, tolerance=28,
                     head_band=(0.06, 0.2)),
    # Дзюн: 3x2, подписи сверху.
    "knight": dict(panels=grid3(SIX, [(105, 690), (775, 1376)]), bust=0.42),
    # Кира: 3 в первом ряду, 2 во втором, подписи снизу.
    "ranger": dict(panels=grid3(["angry", "surprised", "cheerful"], [(0, 640)]) +
                   [("in_love", 0, 690, 384, 1330), ("sad", 384, 690, 768, 1330)], bust=0.4),
    # Гарет: 3x2 с линиями сетки, подписи сверху.
    "swordsman": dict(panels=grid3(SIX, [(62, 685), (752, 1376)]), bust=0.4, inset=4),
    # Рэн: концепт-лист — фигура во весь рост слева (для боя), головы с эмоциями справа.
    "ren": dict(panels=[("calm", 388, 0, 578, 335), ("sad", 578, 0, 768, 335),
                        ("fear", 388, 375, 578, 665), ("laugh", 578, 375, 768, 665),
                        ("angry", 388, 700, 578, 990), ("embarrassed", 578, 700, 768, 990),
                        ("debug", 420, 1050, 768, 1305)], bust=1.0),
    "ren_body": dict(sheet="ren", panels=[("battle", 0, 110, 392, 1376)], bust=1.0, out="ren"),
    # Капля (слизень): тетрадный фон.
    "slime": dict(panels=[("idle", 0, 120, 384, 400), ("happy", 384, 100, 768, 420),
                          ("angry", 0, 510, 384, 840), ("hurt", 384, 590, 768, 840),
                          ("surprised", 0, 950, 384, 1340), ("sleep", 384, 1100, 768, 1340)],
                  bust=1.0, gray_background=True),
}


def remove_background(panel: Image.Image, tolerance: int, gray_background: bool = False) -> Image.Image:
    """Возвращает RGBA, где непрозрачна только крупнейшая фигура панели."""
    rgb = panel.convert("RGB")
    if gray_background:
        arr = np.array(rgb).astype(int)
        saturation = arr.max(axis=-1) - arr.min(axis=-1)
        # Блики на теле слизня тоже светлые — заполняем «дырки» внутри фигуры.
        return _keep_largest(rgb, (saturation < 28) & (arr.max(axis=-1) > 140), fill_holes=True)
    work = rgb.copy()
    w, h = work.size
    sentinel = (255, 0, 255)
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)] + \
            [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    for seed in seeds:
        if work.getpixel(seed) != sentinel:
            ImageDraw.floodfill(work, seed, sentinel, thresh=tolerance)
    background = np.all(np.array(work) == sentinel, axis=-1)
    # Фон, замкнутый внутри фигуры (между рукой и телом), заливкой не достать:
    # крупные островки цвета фона тоже считаем фоном.
    arr = np.array(rgb).astype(int)
    bg_color = np.median(arr[background], axis=0)
    close = np.abs(arr - bg_color).max(axis=-1) < 12
    islands, count = ndimage.label(close & ~background)
    if count:
        sizes = ndimage.sum(np.ones_like(islands), islands, range(1, count + 1))
        for index, size in enumerate(sizes, start=1):
            if size > 400:
                background |= islands == index
    return _keep_largest(rgb, background)


def _keep_largest(rgb: Image.Image, background: np.ndarray, fill_holes: bool = False) -> Image.Image:
    labels, count = ndimage.label(~background)
    if count == 0:
        return rgb.convert("RGBA")
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    figure = labels == (int(np.argmax(sizes)) + 1)
    if fill_holes:
        figure = ndimage.binary_fill_holes(figure)
    alpha = Image.fromarray((figure * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def bust_crop(image: Image.Image, bust: float, head_band: tuple = (0.0, 0.12)) -> Image.Image:
    alpha = np.array(image.getchannel("A")) > 20
    ys, xs = np.nonzero(alpha)
    if bust >= 1.0:
        # Фигура целиком: кадр по всей фигуре.
        return image.crop((max(0, xs.min() - 6), max(0, ys.min() - 6),
                           min(image.width, xs.max() + 7), min(image.height, ys.max() + 7)))
    top, bottom = ys.min(), ys.max()
    span = bottom - top
    height = int(span * bust)
    # Голова — самый широкий непрерывный отрезок в полосе рядов (посох тонкий, его пропускаем).
    band = alpha[top + int(span * head_band[0]):top + max(8, int(span * head_band[1]))]
    cols = np.unique(np.nonzero(band)[1])
    runs, start = [], cols[0]
    for a, b in zip(cols, np.append(cols[1:], cols[-1] + 2)):
        if b - a > 1:
            runs.append((start, a))
            start = b
    head = max(runs, key=lambda r: r[1] - r[0])
    cx = (head[0] + head[1]) // 2
    half_width = int(height * 0.45)
    box = (max(0, cx - half_width), max(0, top - 8), min(image.width, cx + half_width),
           min(image.height, top + height))
    return image.crop(box)


def fade_card(card: Image.Image) -> Image.Image:
    """Карточка с нарисованным фоном: мягко растворяем края."""
    card = card.convert("RGBA")
    w, h = card.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((10, 10, w - 10, h - 10), radius=28, fill=255)
    card.putalpha(mask.filter(ImageFilter.GaussianBlur(10)))
    return card


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for sheet, cfg in SHEET_CONFIG.items():
        image = Image.open(SHEETS / f"{cfg.get('sheet', sheet)}.jpg")
        inset = cfg.get("inset", 0)
        for emotion, x0, y0, x1, y1 in cfg["panels"]:
            panel = image.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset))
            if cfg.get("keep_bg"):
                result = fade_card(panel)
            else:
                figure = remove_background(panel, cfg.get("tolerance", 22), cfg.get("gray_background", False))
                result = bust_crop(figure, cfg.get("bust", 0.45), cfg.get("head_band", (0.0, 0.12)))
            path = OUT / f"{cfg.get('out', sheet)}_{emotion}.png"
            result.save(path, optimize=True)
            print(f"{path.name}: {result.size}")


if __name__ == "__main__":
    main()
