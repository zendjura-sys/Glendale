#!/usr/bin/env python3
"""Нарезка листов эмоций (assets/portraits/sheets/*.jpg) на отдельные портреты.

Для каждой панели листа:
  1. фон убирается заливкой от краёв панели (для однотонного фона);
  2. остаётся самая крупная связная фигура (подписи ANGRY/… и искры отбрасываются);
  3. фигура кадрируется по пояс/плечи и сохраняется в PNG с прозрачностью.
Запуск: python3 tools/cut_portraits.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ROOT / "assets" / "portraits" / "sheets"
OUT = ROOT / "assets" / "portraits" / "expressions"

# Панели: (имя эмоции, x0, y0, x1, y1). bust — какая доля высоты фигуры от макушки
# попадает в портрет (1.0 — вся фигура). keep_bg — фон нарисован, не вырезать.
GRID_2X2_LABEL_TOP = [("angry", 0, 95, 384, 688), ("surprised", 384, 95, 768, 688),
                      ("cheerful", 0, 783, 384, 1376), ("in_love", 384, 783, 768, 1376)]
GRID_2X2 = [("angry", 0, 0, 384, 688), ("surprised", 384, 0, 768, 688),
            ("cheerful", 0, 688, 384, 1376), ("in_love", 384, 688, 768, 1376)]
GRID_2X2_LABEL_BOTTOM = [("angry", 0, 0, 384, 650), ("surprised", 384, 0, 768, 650),
                         ("cheerful", 0, 688, 384, 1325), ("in_love", 384, 688, 768, 1325)]

SHEET_CONFIG = {
    # Эльфийка в рамках с нарисованным фоном: берём внутренность рамки как карточку.
    "elf": dict(panels=[("angry", 34, 36, 374, 600), ("surprised", 394, 36, 734, 600),
                        ("cheerful", 34, 708, 374, 1272), ("in_love", 394, 708, 734, 1272)],
                keep_bg=True),
    "twintails": dict(panels=GRID_2X2_LABEL_TOP, bust=0.62),
    "ranger": dict(panels=GRID_2X2, bust=0.42),
    # Посох выше головы сбивает автокадрирование — рамка задана вручную (координаты панели).
    "archmage": dict(panels=GRID_2X2_LABEL_BOTTOM, tolerance=28, box=(70, 10, 384, 360)),
    "swordsman": dict(panels=GRID_2X2_LABEL_TOP, bust=0.42),
    "knight": dict(panels=GRID_2X2_LABEL_TOP, bust=0.45),
    "slime": dict(panels=[("idle", 0, 120, 384, 400), ("happy", 384, 120, 768, 420),
                          ("angry", 0, 510, 384, 840), ("hurt", 384, 590, 768, 840),
                          ("surprised", 0, 950, 384, 1340), ("sleep", 384, 1100, 768, 1340)],
                  bust=1.0, gray_background=True),
}


def remove_background(panel: Image.Image, tolerance: int, gray_background: bool = False) -> Image.Image:
    """Заливка фона от краёв; возвращает RGBA только с крупнейшей фигурой.
    gray_background — фон «тетрадный лист»: фоном считается всё светлое и серое."""
    rgb = panel.convert("RGB")
    if gray_background:
        arr = np.array(rgb).astype(int)
        saturation = arr.max(axis=-1) - arr.min(axis=-1)
        return _keep_largest(rgb, (saturation < 28) & (arr.max(axis=-1) > 140))
    work = rgb.copy()
    w, h = work.size
    sentinel = (255, 0, 255)
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)] + \
            [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    for seed in seeds:
        if work.getpixel(seed) != sentinel:
            ImageDraw.floodfill(work, seed, sentinel, thresh=tolerance)
    arr = np.array(work)
    return _keep_largest(rgb, np.all(arr == sentinel, axis=-1))


def _keep_largest(rgb: Image.Image, background: np.ndarray) -> Image.Image:
    labels, count = ndimage.label(~background)
    if count == 0:
        return rgb.convert("RGBA")
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    figure = labels == (int(np.argmax(sizes)) + 1)
    figure = ndimage.binary_fill_holes(figure)
    alpha = Image.fromarray((figure * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def bust_crop(image: Image.Image, bust: float, center: float | None = None) -> Image.Image:
    alpha = np.array(image.getchannel("A")) > 20
    ys, xs = np.nonzero(alpha)
    top, bottom = ys.min(), ys.max()
    height = int((bottom - top) * bust)
    # Центр по голове: средний x непрозрачных пикселей в верхних 12% фигуры.
    head_rows = alpha[top:top + max(8, int((bottom - top) * 0.12))]
    cx = int(np.nonzero(head_rows)[1].mean())
    half_width = int(max(height * 0.45, (xs.max() - xs.min()) / 2 if bust >= 1.0 else 0))
    box = (max(0, cx - half_width), max(0, top - 8), min(image.width, cx + half_width), min(image.height, top + height))
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
        image = Image.open(SHEETS / f"{sheet}.jpg")
        for emotion, x0, y0, x1, y1 in cfg["panels"]:
            panel = image.crop((x0, y0, x1, y1))
            if cfg.get("keep_bg"):
                result = fade_card(panel)
            elif cfg.get("box"):
                result = remove_background(panel, cfg.get("tolerance", 22)).crop(cfg["box"])
            else:
                result = bust_crop(remove_background(panel, cfg.get("tolerance", 22), cfg.get("gray_background", False)), cfg.get("bust", 0.45),
				                   cfg.get("center"))
            path = OUT / f"{sheet}_{emotion}.png"
            result.save(path, optimize=True)
            print(f"{path.name}: {result.size}")


if __name__ == "__main__":
    main()
