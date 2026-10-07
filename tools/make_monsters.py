#!/usr/bin/env python3
"""Генератор монстров из одной таблицы MONSTERS.

Для каждого монстра создаёт:
  combat/battlers/monsters/<id>/  — характеристики (.tres), приём (.tres), спрайт и сцену анимации;
  combat/arenas/monsters/<id>.tscn — арену: монстры против Рэна и Капли;
  src/common/bestiary/bestiary_data.gd — данные бестиария для игры.
Спрайты берутся из assets/portraits/expressions/monster_<id>.png (см. cut_portraits.py).
Запуск: python3 tools/make_monsters.py
"""
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent

# id: имя, уровень, HP, атака, защита, скорость, приём (название, описание, урон, на всех?),
#     шанс приручения (0 — не приручается), сколько в бою, высота спрайта, описание.
MONSTERS = {
    "slime": dict(name="Лесной слизень", level=1, hp=55, attack=4, defense=6, speed=40,
                  action=("Липкий прыжок", "Слизень плюхается на цель.", 14, False),
                  tame=0.6, count=2, height=200,
                  info="Безобидный лесной слизень. Любит блестящее и тёплые руки."),
    "shadow_imp": dict(name="Теневой бесёнок", level=2, hp=65, attack=7, defense=6, speed=75,
                       action=("Теневой коготь", "Быстрый удар из тени.", 16, False),
                       tame=0.4, count=2, height=240,
                       info="Мелкий слуга Бага. Пакостит и прячется в тенях."),
    "stone_golem": dict(name="Каменный голем", level=3, hp=150, attack=8, defense=22, speed=20,
                        action=("Каменный кулак", "Тяжёлый, но медленный удар.", 30, False),
                        tame=0.25, count=1, height=340,
                        info="Страж древних руин. Руны на теле светятся, когда он злится."),
    "griffin": dict(name="Грифон", level=4, hp=120, attack=10, defense=10, speed=80,
                    action=("Пикирование", "Удар с высоты острыми когтями.", 24, False),
                    tame=0.2, count=1, height=330,
                    info="Гордый страж небес. Подчиняется только сильным."),
    "basilisk": dict(name="Василиск", level=5, hp=130, attack=10, defense=12, speed=45,
                     action=("Ядовитое дыхание", "Облако яда накрывает весь отряд.", 14, True),
                     tame=0.0, count=1, height=300,
                     info="Змей с ядовитым дыханием. Приручить невозможно."),
    "cerberus": dict(name="Цербер", level=5, hp=150, attack=11, defense=12, speed=55,
                     action=("Тройной укус", "Три пасти рвут одну цель.", 28, False),
                     tame=0.15, count=1, height=320,
                     info="Трёхглавый пёс в цепях. Верен до последнего, если признает хозяина."),
    "chimera": dict(name="Химера", level=6, hp=170, attack=12, defense=12, speed=50,
                    action=("Тройная ярость", "Лев, козёл и змея атакуют всех сразу.", 16, True),
                    tame=0.0, count=1, height=330,
                    info="Порождение Разлома. Три головы — три характера, и все злые."),
    "phoenix": dict(name="Феникс", level=7, hp=120, attack=13, defense=8, speed=90,
                    action=("Пламя возрождения", "Огненные крылья обжигают весь отряд.", 15, True),
                    tame=0.05, count=1, height=330,
                    info="Огненная птица. Возрождается из пепла. Приручить почти невозможно."),
    "red_dragon": dict(name="Красный дракон", level=8, hp=220, attack=14, defense=18, speed=40,
                       action=("Огненное дыхание", "Пламя накрывает весь отряд.", 20, True),
                       tame=0.0, count=1, height=380,
                       info="Древний дракон, заражённый Разломом. Самый опасный враг леса."),
}

ENEMY_POSITIONS = [(465, 722), (284, 896), (606, 992)]
STATS_SCRIPT = "res://src/combat/battlers/battler_stats.gd"
ATTACK_SCRIPT = "res://src/combat/actions/battler_action_attack.gd"
TEMPLATE_ANIM = ROOT / "combat/battlers/bugcat/bugcat_anim.tscn"
TEMPLATE_ARENA = ROOT / "overworld/maps/town/battles/test_combat_arena.tscn"
LETTERS = "АБВ"


def write_stats(path: Path, m: dict) -> None:
    path.write_text(f'''[gd_resource type="Resource" script_class="BattlerStats" format=3]

[ext_resource type="Script" path="{STATS_SCRIPT}" id="1"]

[resource]
script = ExtResource("1")
affinity = 0
base_max_health = {m["hp"]}
base_max_energy = 6
base_attack = {m["attack"]}
base_defense = {m["defense"]}
base_speed = {m["speed"]}
base_hit_chance = 100
base_evasion = 0
''')


def write_action(path: Path, m: dict) -> None:
    label, description, damage, everyone = m["action"]
    path.write_text(f'''[gd_resource type="Resource" script_class="AttackBattlerAction" format=3]

[ext_resource type="Script" path="{ATTACK_SCRIPT}" id="1"]

[resource]
script = ExtResource("1")
hit_chance = 80.0
base_damage = {damage}
label = "{label}"
description = "{description}"
target_scope = {2 if everyone else 1}
targets_friendlies = false
targets_enemies = true
element = 0
energy_cost = 0
readiness_saved = 30.0
''')


def write_anim(folder: Path, monster_id: str, m: dict) -> None:
    sprite = Image.open(ROOT / f"assets/portraits/expressions/monster_{monster_id}.png")
    sprite = ImageOps.mirror(sprite)  # враги стоят слева и смотрят направо
    sprite.thumbnail((m["height"] * 1.3, m["height"]))
    sprite.save(folder / "sprite.png")
    w, h = sprite.size
    s = TEMPLATE_ANIM.read_text()
    first = s.splitlines()[0]
    s = s.replace(first, re.sub(r' uid="[^"]*"', "", first), 1)
    tex = [l for l in s.splitlines() if "bugcat.png" in l][0]
    s = s.replace(tex, f'[ext_resource type="Texture2D" path="res://combat/battlers/monsters/{monster_id}/sprite.png" id="2_jiam4"]')
    s = s.replace('[node name="BugcatAnim"', '[node name="MonsterAnim"')
    s = s.replace("offset = Vector2(0, -163)", f"offset = Vector2(0, -{h // 2})")
    s = re.sub(r'(\[node name="FrontAnchor" parent="." index="1"\]\nposition = )Vector2\([^)]*\)', rf"\1Vector2({w // 2}, -{h // 2})", s)
    s = re.sub(r'(\[node name="TopAnchor" parent="." index="2"\]\nposition = )Vector2\([^)]*\)', rf"\1Vector2(0, -{h + 10})", s)
    (folder / "anim.tscn").write_text(s)


def write_arena(path: Path, monster_id: str, m: dict) -> None:
    s = TEMPLATE_ARENA.read_text()
    # Убираем врагов шаблона (бесы), оставляя отряд Рэна.
    nodes = re.split(r"(?=\n\[node )", s)
    kept = [n for n in nodes if not re.match(r'\n\[node name="Бес', n)]
    s = "".join(kept)
    s = re.sub(r'\[ext_resource type="PackedScene" path="res://combat/battlers/imp/[^\n]*\n', "", s)
    s = s.replace('[node name="TestCombatArena"', '[node name="MonsterArena"')
    first = s.splitlines()[0]
    s = s.replace(first, "[gd_scene format=3]", 1)
    base = f"res://combat/battlers/monsters/{monster_id}"
    ext = (f'[ext_resource type="Resource" path="{base}/stats.tres" id="m_stats"]\n'
           f'[ext_resource type="Resource" path="{base}/action.tres" id="m_action"]\n'
           f'[ext_resource type="PackedScene" path="{base}/anim.tscn" id="m_anim"]\n')
    first_node = s.index("\n[node ")
    s = s[:first_node + 1] + ext + s[first_node + 1:]
    battler_id = re.search(r'path="res://src/combat/battlers/battler.gd" id="([^"]+)"', s).group(1)
    action_id = re.search(r'path="res://src/combat/actions/battler_action.gd" id="([^"]+)"', s).group(1)
    ai_id = re.search(r'path="res://src/combat/CombatAI.tscn" id="([^"]+)"', s).group(1)
    enemies = ""
    for i in range(m["count"]):
        name = m["name"] if m["count"] == 1 else f'{m["name"]} {LETTERS[i]}'
        x, y = ENEMY_POSITIONS[i]
        enemies += f'''
[node name="{name}" type="Node2D" parent="Battlers" index="{i}"]
position = Vector2({x}, {y})
script = ExtResource("{battler_id}")
stats = ExtResource("m_stats")
actions = Array[ExtResource("{action_id}")]([ExtResource("m_action")])
battler_anim_scene = ExtResource("m_anim")
ai_scene = ExtResource("{ai_id}")
metadata/_edit_group_ = true
'''
    # Враги вставляются перед отрядом, индексы отряда сдвигаем.
    party_start = s.index('\n[node name="Рэн"')
    party = s[party_start:]
    party = re.sub(r'index="\d+"', lambda mm, c=iter(range(m["count"], 10)): f'index="{next(c)}"', party)
    s = s[:party_start] + enemies + party
    path.write_text(s)


def write_bestiary_data() -> None:
    lines = ['## Сгенерировано tools/make_monsters.py — не редактировать вручную.',
             'class_name BestiaryData', '', 'const MONSTERS := {']
    for monster_id, m in MONSTERS.items():
        lines.append(f'\t"{monster_id}": {{name = "{m["name"]}", level = {m["level"]}, tame = {m["tame"]}, '
                     f'info = "{m["info"]}", arena = "res://combat/arenas/monsters/{monster_id}.tscn"}},')
    lines.append('}')
    out = ROOT / "src/common/bestiary/bestiary_data.gd"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n")


def main() -> None:
    arenas = ROOT / "combat/arenas/monsters"
    arenas.mkdir(parents=True, exist_ok=True)
    for monster_id, m in MONSTERS.items():
        folder = ROOT / "combat/battlers/monsters" / monster_id
        folder.mkdir(parents=True, exist_ok=True)
        write_stats(folder / "stats.tres", m)
        write_action(folder / "action.tres", m)
        write_anim(folder, monster_id, m)
        write_arena(arenas / f"{monster_id}.tscn", monster_id, m)
        print("monster", monster_id)
    write_bestiary_data()


if __name__ == "__main__":
    main()
