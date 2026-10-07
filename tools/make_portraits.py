#!/usr/bin/env python3
"""Генератор аниме-портретов (бюстов) для диалогов.

Все персонажи оригинальные. Портрет собирается из слоёв: задние волосы,
одежда, шея, лицо, глаза, рот, чёлка, аксессуары. Запуск:
    python3 tools/make_portraits.py
Результат: assets/portraits/<id>.svg (400x520).
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "portraits"
W, H = 400, 520
SKIN = "#fde3cf"
SKIN_SHADE = "#f2c5aa"


def shade(hex_color: str, k: float) -> str:
    """Осветлить (k>0) или затемнить (k<0) цвет."""
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    if k >= 0:
        r, g, b = (int(c + (255 - c) * k) for c in (r, g, b))
    else:
        r, g, b = (int(c * (1 + k)) for c in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


def defs(c: dict) -> str:
    hair, eye = c["hair"], c["eyes"]
    return f"""<defs>
  <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{shade(hair, 0.25)}"/><stop offset="1" stop-color="{shade(hair, -0.25)}"/>
  </linearGradient>
  <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{shade(eye, -0.55)}"/><stop offset="0.55" stop-color="{eye}"/>
    <stop offset="1" stop-color="{shade(eye, 0.55)}"/>
  </linearGradient>
  <linearGradient id="cloth" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{shade(c['cloth'], 0.15)}"/><stop offset="1" stop-color="{shade(c['cloth'], -0.3)}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6">
    <stop offset="0" stop-color="{c.get('glow', '#ffffff')}" stop-opacity="0.55"/>
    <stop offset="1" stop-color="{c.get('glow', '#ffffff')}" stop-opacity="0"/>
  </radialGradient>
</defs>"""


# --- Волосы (задний слой) ---
BACK_HAIR = {
    "short": "M98 214 C80 120 140 52 200 52 C262 52 320 118 302 214 C300 250 290 270 282 280 L118 280 C108 268 100 248 98 214 Z",
    "long": "M92 210 C78 112 140 50 200 50 C262 50 324 112 308 210 C318 300 330 380 320 460 L80 460 C70 380 82 300 92 210 Z",
    "twintails": "M100 210 C84 116 142 54 200 54 C258 54 316 116 300 210 C298 250 290 272 280 282 L120 282 C110 272 102 250 100 210 Z"
                 " M86 150 C30 190 28 330 60 430 C70 400 76 330 104 250 Z M314 150 C370 190 372 330 340 430 C330 400 324 330 296 250 Z",
    "ponytail": "M98 214 C80 120 140 52 200 52 C262 52 320 118 302 214 C300 250 290 270 282 280 L118 280 C108 268 100 248 98 214 Z"
                " M286 96 C350 120 360 230 330 330 C318 280 306 220 280 170 Z",
    "spiky": "M96 220 C78 140 110 70 150 60 L140 26 L180 52 L196 14 L222 50 L262 24 L254 64 C300 82 322 150 304 220 C300 252 292 270 282 280 L118 280 C108 268 98 250 96 220 Z",
    "bald": "",
    "hood": "",
}

# --- Чёлка (передний слой) ---
BANGS = {
    "messy": "M112 196 C108 120 150 78 200 78 C252 78 294 120 290 196 L276 160 L262 196 L246 140 L226 188 L210 132 L190 186 L172 136 L154 190 L140 150 L126 200 Z",
    "straight": "M110 200 C104 118 150 76 200 76 C250 76 296 118 290 200 C262 176 242 168 200 168 C158 168 138 176 110 200 Z",
    "side": "M110 204 C100 120 150 74 206 76 C260 78 300 124 290 200 C276 168 250 150 222 146 L188 200 L196 146 C160 150 130 170 110 204 Z",
    "spiky": "M112 200 C104 124 146 78 200 78 C254 78 296 124 288 200 L270 150 L258 196 L236 134 L218 186 L200 124 L182 186 L164 134 L142 196 L130 150 Z",
    "none": "",
}


def eyes(c: dict) -> str:
    kind = c.get("eye_shape", "normal")
    out = []
    for cx, flip in ((158, 1), (242, -1)):
        if kind == "closed":
            out.append(f'<path d="M{cx-26} 250 Q{cx} 266 {cx+26} 250" stroke="#3a2a2a" stroke-width="5" fill="none" stroke-linecap="round"/>')
            continue
        h = 34 if kind == "normal" else 26
        out.append(f'<ellipse cx="{cx}" cy="252" rx="24" ry="{h}" fill="#ffffff"/>')
        out.append(f'<ellipse cx="{cx}" cy="256" rx="19" ry="{h-6}" fill="url(#iris)"/>')
        out.append(f'<ellipse cx="{cx}" cy="260" rx="9" ry="{h-16}" fill="{shade(c["eyes"], -0.7)}"/>')
        out.append(f'<ellipse cx="{cx-7*flip}" cy="242" rx="7" ry="9" fill="#ffffff"/>')
        out.append(f'<circle cx="{cx+8*flip}" cy="270" r="3.5" fill="#ffffff" opacity="0.85"/>')
        # Верхнее веко с ресницами.
        top = 252 - h
        out.append(f'<path d="M{cx-30} {top+14} Q{cx} {top-8} {cx+30} {top+10}" stroke="#2b1d1d" stroke-width="7" fill="none" stroke-linecap="round"/>')
        out.append(f'<path d="M{cx+24*flip} {top+10} l{10*flip} -8" stroke="#2b1d1d" stroke-width="5" stroke-linecap="round"/>')
    # Брови.
    brow = shade(c["hair"], -0.35)
    tilt = {"angry": (8, -6), "sad": (-8, 6)}.get(c.get("mood", ""), (0, 0))
    out.append(f'<path d="M134 {200+tilt[1]} Q158 {190} 182 {198+tilt[0]}" stroke="{brow}" stroke-width="6" fill="none" stroke-linecap="round"/>')
    out.append(f'<path d="M266 {200+tilt[1]} Q242 {190} 218 {198+tilt[0]}" stroke="{brow}" stroke-width="6" fill="none" stroke-linecap="round"/>')
    return "\n".join(out)


def mouth(c: dict) -> str:
    m = c.get("mouth", "smile")
    return {
        "smile": '<path d="M184 326 Q200 340 216 326" stroke="#9b4a4a" stroke-width="4" fill="none" stroke-linecap="round"/>',
        "open": '<path d="M180 322 Q200 352 220 322 Z" fill="#b04a55" stroke="#7a2e36" stroke-width="3"/>',
        "flat": '<path d="M186 330 L214 330" stroke="#9b4a4a" stroke-width="4" stroke-linecap="round"/>',
        "smirk": '<path d="M184 330 Q204 334 218 320" stroke="#9b4a4a" stroke-width="4" fill="none" stroke-linecap="round"/>',
        "grin": '<path d="M176 320 Q200 350 224 320 Z" fill="#ffffff" stroke="#7a2e36" stroke-width="3"/>',
    }[m]


def clothes(c: dict) -> str:
    kind = c.get("outfit", "shirt")
    base = '<path d="M60 520 C66 430 120 396 200 392 C280 396 334 430 340 520 Z" fill="url(#cloth)"/>'
    extra = {
        "shirt": '<path d="M170 394 L200 440 L230 394" fill="#ffffff" stroke="#d0d6e6" stroke-width="3"/>'
                 '<path d="M196 440 L204 440 L210 520 L190 520 Z" fill="#33415c"/>',
        "armor": '<path d="M70 520 C76 450 120 420 160 412 L200 470 L240 412 C280 420 324 450 330 520 Z" fill="#b8c2d6" stroke="#6b7895" stroke-width="4"/>'
                 '<circle cx="200" cy="470" r="14" fill="#e6b84a" stroke="#8a6a1e" stroke-width="3"/>',
        "robe": '<path d="M150 398 L200 520 L250 398" fill="none" stroke="#e6b84a" stroke-width="8"/>',
        "gi": '<path d="M150 398 L220 520 M250 398 L180 520" stroke="#ffffff" stroke-width="14"/>',
        "hoodie": '<path d="M120 410 C150 380 250 380 280 410" fill="none" stroke="{}" stroke-width="18"/>'.format(shade(c["cloth"], -0.35)),
        "apron": '<path d="M140 420 L260 420 L270 520 L130 520 Z" fill="#8a5a3a" stroke="#5c3a24" stroke-width="3"/>',
        "ghost": "",
    }[kind]
    return base + extra


def accessories(c: dict) -> str:
    out = []
    for acc in c.get("accessories", []):
        if acc == "glasses":
            out.append('<g fill="none" stroke="#2e3440" stroke-width="5"><rect x="124" y="226" width="68" height="54" rx="12"/>'
                       '<rect x="208" y="226" width="68" height="54" rx="12"/><path d="M192 250 L208 250"/></g>'
                       '<path d="M134 236 L156 236" stroke="#ffffff" stroke-width="4" opacity="0.6"/>')
        elif acc == "elf_ears":
            out.append(f'<path d="M104 250 L44 200 L112 292 Z" fill="{SKIN}" stroke="{SKIN_SHADE}" stroke-width="3"/>'
                       f'<path d="M296 250 L356 200 L288 292 Z" fill="{SKIN}" stroke="{SKIN_SHADE}" stroke-width="3"/>')
        elif acc == "headband":
            out.append('<path d="M104 176 Q200 140 296 176 L294 196 Q200 160 106 196 Z" fill="#d94a4a"/>'
                       '<path d="M292 182 L334 168 L320 200 Z" fill="#d94a4a"/>')
        elif acc == "witch_hat":
            out.append('<path d="M70 132 Q200 96 330 132 Q200 150 70 132 Z" fill="#3b2d6b"/>'
                       '<path d="M120 126 L236 -6 L266 40 L282 124 Z" fill="#4b3a86"/>'
                       '<path d="M126 122 Q200 106 280 120 L282 134 Q200 120 124 136 Z" fill="#e6b84a"/>')
        elif acc == "hood":
            out.append('<path d="M70 300 C50 140 120 40 200 40 C280 40 350 140 330 300 C320 220 280 150 200 150 C120 150 80 220 70 300 Z" fill="#2f3542"/>')
        elif acc == "scar":
            out.append('<path d="M248 214 L262 290" stroke="#c97a6a" stroke-width="4" stroke-linecap="round"/>')
        elif acc == "blush":
            out.append('<ellipse cx="140" cy="300" rx="20" ry="8" fill="#ff8fa3" opacity="0.5"/>'
                       '<ellipse cx="260" cy="300" rx="20" ry="8" fill="#ff8fa3" opacity="0.5"/>')
        elif acc == "beard":
            out.append('<path d="M128 300 C140 380 176 420 200 420 C224 420 260 380 272 300 C250 330 230 344 200 344 C170 344 150 330 128 300 Z" fill="#eef0f4" stroke="#c9ced8" stroke-width="3"/>')
        elif acc == "freckles":
            out.append("".join(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#c98a6a"/>' for x, y in
                               ((136, 292), (148, 300), (128, 302), (252, 292), (264, 300), (272, 290))))
        elif acc == "bow":
            out.append('<path d="M232 70 L292 44 L284 100 Z M232 70 L262 120 L300 110 Z" fill="#ff6fa8" stroke="#c2477b" stroke-width="3"/>'
                       '<circle cx="236" cy="74" r="12" fill="#ff6fa8" stroke="#c2477b" stroke-width="3"/>')
        elif acc == "circuit":
            out.append('<g stroke="#5fe3ff" stroke-width="4" fill="none" opacity="0.8"><path d="M120 150 L150 150 L162 132"/>'
                       '<path d="M280 150 L250 150 L238 132"/><circle cx="166" cy="128" r="5"/><circle cx="234" cy="128" r="5"/></g>')
    return "\n".join(out)


def face() -> str:
    return (f'<path d="M184 340 L184 400 L216 400 L216 340 Z" fill="{SKIN_SHADE}"/>'
            f'<path d="M106 220 C106 140 150 104 200 104 C250 104 294 140 294 220 C294 290 254 350 200 368 C146 350 106 290 106 220 Z" fill="{SKIN}"/>'
            f'<path d="M196 292 L202 300" stroke="{SKIN_SHADE}" stroke-width="4" stroke-linecap="round"/>')


def portrait(c: dict) -> str:
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">', defs(c),
             '<ellipse cx="200" cy="260" rx="200" ry="260" fill="url(#glow)"/>']
    body = []
    if c.get("hair_back"):
        body.append(f'<path d="{BACK_HAIR[c["hair_back"]]}" fill="url(#hair)"/>')
    if "hood" in c.get("accessories", []):
        body.append(accessories({"accessories": ["hood"]}))
    body.append(clothes(c))
    body.append(face())
    body.append(eyes(c))
    body.append(mouth(c))
    if BANGS[c.get("bangs", "none")]:
        body.append(f'<path d="{BANGS[c["bangs"]]}" fill="url(#hair)"/>')
    body.append(accessories({**c, "accessories": [a for a in c.get("accessories", []) if a != "hood"]}))
    content = "\n".join(body)
    if c.get("ghost"):
        content = f'<g opacity="0.72">{content}</g>'
    parts.append(content)
    parts.append("</svg>")
    return "\n".join(parts)


CHARACTERS = {
    # Главный герой: уставший программист (так он помнит себя).
    "hero": dict(hair="#2c2f3a", eyes="#5b8bd9", cloth="#4a5568", outfit="hoodie", hair_back="short",
                 bangs="messy", mouth="flat", eye_shape="tired", accessories=["glasses"], glow="#8fd3ff"),
    # Голос Системы — голографический интерфейс.
    "system": dict(hair="#5fe3ff", eyes="#5fe3ff", cloth="#1a3a5c", outfit="shirt", hair_back="long",
                   bangs="straight", mouth="flat", accessories=["circuit"], glow="#5fe3ff", ghost=True),
    # Мими — восторженная фанатка Четвёрки Рассвета.
    "fan_of_four": dict(hair="#ff8fc8", eyes="#e0457b", cloth="#f2a7c3", outfit="shirt", hair_back="twintails",
                        bangs="straight", mouth="open", accessories=["blush", "bow"], glow="#ffd1e6"),
    # Гарет — воин Четвёрки.
    "warrior": dict(hair="#f2c94c", eyes="#3fa7d6", cloth="#5a6b8c", outfit="armor", hair_back="spiky",
                    bangs="spiky", mouth="grin", accessories=["scar"], glow="#ffe9a8"),
    # Кира — воровка Четвёрки.
    "thief": dict(hair="#d8dde6", eyes="#9b59d0", cloth="#3d3550", outfit="shirt", hair_back="ponytail",
                  bangs="side", mouth="smirk", accessories=["hood"], glow="#c9b3ff"),
    # Дзюн — монах Четвёрки.
    "monk": dict(hair="#3a2a20", eyes="#7a5230", cloth="#e08a2e", outfit="gi", hair_back="", bangs="none",
                 mouth="smile", eye_shape="closed", accessories=["headband"], glow="#ffcf8f"),
    # Сильвия — эльфийская волшебница Четвёрки.
    "wizard": dict(hair="#6fcf97", eyes="#27ae60", cloth="#4b3a86", outfit="robe", hair_back="long",
                   bangs="straight", mouth="flat", accessories=["elf_ears", "witch_hat"], glow="#c8f7dc"),
    # Тоби — непоседливый мальчишка.
    "runner": dict(hair="#c0662d", eyes="#2f9e44", cloth="#3b82c4", outfit="shirt", hair_back="short",
                   bangs="spiky", mouth="grin", accessories=["freckles"], glow="#ffe0b8"),
    # Брам — кузнец.
    "smith": dict(hair="#5b3a29", eyes="#8a5a2b", cloth="#6b4a35", outfit="apron", hair_back="short",
                  bangs="side", mouth="flat", mood="angry", accessories=["headband"], glow="#ffb38a"),
    # Баг — призрак-задира, ошибка мира.
    "enemy_ghost": dict(hair="#9b8cff", eyes="#ff4d6d", cloth="#4a3f8c", outfit="armor", hair_back="spiky",
                        bangs="spiky", mouth="grin", mood="angry", accessories=["scar"], glow="#ff4d6d", ghost=True),
    # Аурелий — дух мастера-артефактора.
    "ghost": dict(hair="#e8eaf2", eyes="#7fd4ff", cloth="#3b5b8c", outfit="robe", hair_back="long",
                  bangs="side", mouth="smile", mood="sad", eye_shape="tired", accessories=["beard"],
                  glow="#bfe8ff", ghost=True),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in CHARACTERS.items():
        (OUT / f"{name}.svg").write_text(portrait(data), encoding="utf-8")
        print("wrote", name)


if __name__ == "__main__":
    main()
