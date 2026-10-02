"""Рендерить іконку застосунку з фірмового знака (public/favicon.svg).

    python3 mobile/tool/make_icon.py

Пише адаптивну іконку Android (передній план із неоновим світінням), звичайні
mipmap-и та 512×512 для Google Play у mobile/store/.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android/app/src/main/res"
SS = 4  # суперсемплінг для рівних країв

BG = (7, 11, 24)
STOPS = [(0.0, (0x6F, 0xA2, 0xFF)), (0.55, (0x8B, 0x6B, 0xFF)), (1.0, (0xF0, 0x4F, 0xD8))]


def _cubic(p0, p1, p2, p3, steps=24):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t**2, t**3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


# Трикутник «play» з favicon.svg у координатах 32×32.
PLAY = [(9, 6.8)]
PLAY += _cubic((9, 6.8), (9, 4.9), (11.1, 3.7), (12.7, 4.7))
PLAY += [(25.9, 12.9)]
PLAY += _cubic((25.9, 12.9), (27.4, 13.8), (27.4, 16.1), (25.9, 17.0))
PLAY += [(12.7, 25.3)]
PLAY += _cubic((12.7, 25.3), (11.1, 26.3), (9, 25.1), (9, 23.2))


def gradient(size, x0, y0, x1, y1):
    """Лінійний градієнт фірмових кольорів від (x0, y0) до (x1, y1)."""
    w, h = size
    small = 256
    img = Image.new("RGB", (small, small))
    px = img.load()
    dx, dy = x1 - x0, y1 - y0
    length = dx * dx + dy * dy
    for j in range(small):
        for i in range(small):
            x, y = i / (small - 1) * w, j / (small - 1) * h
            t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / length))
            for k in range(len(STOPS) - 1):
                (ta, ca), (tb, cb) = STOPS[k], STOPS[k + 1]
                if t <= tb:
                    f = (t - ta) / (tb - ta)
                    px[i, j] = tuple(round(ca[n] + (cb[n] - ca[n]) * f) for n in range(3))
                    break
    return img.resize(size, Image.BICUBIC)


def mark(size, box, *, fill_bg=True, glow=True, full_bleed_bg=False):
    """Знак у квадраті `box` = (x, y, side) на полотні `size`×`size` (пікселі після SS)."""
    W = size * SS
    bx, by, side = (v * SS for v in box)
    unit = side / 32
    canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    if full_bleed_bg:
        canvas.paste(BG + (255,), (0, 0, W, W))

    def to_px(p):
        return (bx + p[0] * unit, by + p[1] * unit)

    grad = gradient((W, W), bx + 6 * unit, by + 4 * unit, bx + 28 * unit, by + 28 * unit).convert("RGBA")

    shape = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(shape)
    ring_w = 1.5 * unit
    inset = 1.25 * unit
    d.rounded_rectangle((bx + inset, by + inset, bx + side - inset, by + side - inset), radius=7 * unit, outline=255, width=round(ring_w))
    d.polygon([to_px(p) for p in PLAY], fill=255)

    if fill_bg:
        base = Image.new("L", (W, W), 0)
        ImageDraw.Draw(base).rounded_rectangle((bx, by, bx + side, by + side), radius=8 * unit, fill=255)
        canvas.paste(BG + (255,), (0, 0), base)

    if glow:
        # Неонове світіння: розмита копія знака двох радіусів.
        for radius, strength in ((5 * unit, 0.5), (1.8 * unit, 0.45)):
            halo = shape.filter(ImageFilter.GaussianBlur(radius))
            halo = halo.point(lambda v, s=strength: round(v * s))
            layer = grad.copy()
            layer.putalpha(halo)
            canvas = Image.alpha_composite(canvas, layer)

    art = grad.copy()
    art.putalpha(shape)
    canvas = Image.alpha_composite(canvas, art)

    # Легкий відблиск зверху на трикутнику.
    shine = Image.new("L", (W, W), 0)
    ImageDraw.Draw(shine).polygon([to_px(p) for p in PLAY], fill=28)
    fade = Image.linear_gradient("L").resize((W, W)).point(lambda v: 255 - v)
    shine = ImageChops.multiply(shine, fade)
    canvas = Image.alpha_composite(canvas, Image.merge("RGBA", (*[Image.new("L", (W, W), 255)] * 3, shine)))

    return canvas.resize((size, size), Image.LANCZOS)


DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def main():
    for name, k in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        folder.mkdir(exist_ok=True)
        # Адаптивна: полотно 108dp, видима зона ~72dp, безпечне коло 66dp.
        fg = round(108 * k)
        side = 54 * k
        off = (108 * k - side) / 2
        mark(fg, (off, off, side), fill_bg=False).save(folder / "ic_launcher_foreground.png", optimize=True)
        # Звичайна (для лаунчерів без адаптивних іконок): 48dp із полями.
        legacy = round(48 * k)
        mark(legacy, (2 * k, 2 * k, 44 * k)).save(folder / "ic_launcher.png", optimize=True)
        mark(legacy, (2 * k, 2 * k, 44 * k)).save(folder / "ic_launcher_round.png", optimize=True)

    store = ROOT / "store"
    store.mkdir(exist_ok=True)
    # Google Play сам заокруглює кути — фон на весь квадрат.
    mark(512, (64, 64, 384), full_bleed_bg=True).save(store / "icon-512.png", optimize=True)
    mark(1024, (128, 128, 768), full_bleed_bg=True).save(store / "icon-1024.png", optimize=True)


if __name__ == "__main__":
    main()
