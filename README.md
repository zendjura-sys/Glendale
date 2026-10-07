# Glendale

Isekai LitRPG на Godot 4.5 для Android: офисный работник попадает под грузовик,
Бог по ошибке даёт ему новую жизнь, и он перерождается в фэнтези-лесу.
Полу-3D: мир в 3D, персонажи — 2D-спрайты в режиме Billboard (как в Doom).

## Как открыть на телефоне

1. Скачать архив ветки с GitHub (кнопка **Code → Download ZIP**) и распаковать.
2. Godot → **Import** → выбрать `project.godot` → **Run** (▶).

Сюжетная цепочка: титульный экран → грузовик → Белая комната → выбор навыков → лес → хижина.

## Архитектура

```
res://
├─ project.godot              настройки (Android, автозагрузки)
├─ autoload/                  синглтоны, живут всю игру
│  ├─ input_bindings.gd       InputBindings — действия ввода из кода
│  ├─ skill_manager.gd        SkillManager — навыки, очки перерождения
│  ├─ game_state.gd           GameState — статы, инвентарь, задания, сохранение
│  └─ scene_manager.gd        SceneManager — смена сцен с затемнением
├─ data/
│  ├─ skill_data.gd           SkillData (Resource) — описание навыка
│  └─ dialogues/
│     └─ intro_dialogues.gd   тексты сцен 1–2
├─ scenes/
│  ├─ title/                  титульный экран
│  ├─ story/                  сцены 1–2 (визуальная новелла)
│  ├─ skill_select/           сцена 3 (выбор навыков)
│  ├─ world/forest/           сцена 4 (3D-лес)
│  ├─ world/hut/              заброшенная хижина (будущая база)
│  ├─ player/                 игрок от первого лица + его UI
│  ├─ enemies/                существа-спрайты (слизь)
│  └─ ui/
│     ├─ dialogue_box/        окно диалога (тап — дальше)
│     ├─ touch_controls/      джойстик, свайп-камера, экранные кнопки
│     ├─ hud/                 HP/MP, задание, сообщения Системы
│     └─ system_window/       «Системное окно» (пауза, статы, навыки)
├─ assets/sprites, assets/ui  SVG-заглушки (заменить на арт)
└─ tests/                     автотесты (headless)
```

Правила:
- Сцена и её скрипт лежат в одной папке.
- Сцены не ссылаются друг на друга напрямую: общие данные — только через синглтоны,
  связь — через сигналы (`GameState.notification_posted`, `SkillManager.selection_changed`).
- Тексты диалогов — в `.gd`-константах, а не в JSON: JSON не попадает в APK
  без настройки фильтра экспорта.

## Настройки Android (уже выставлены в `project.godot`)

| Раздел | Параметр | Значение | Зачем |
|---|---|---|---|
| Display → Window | Viewport Width × Height | 1280 × 720 | базовое разрешение UI |
| Display → Window | Stretch → Mode | `canvas_items` | UI масштабируется под любой экран |
| Display → Window | Stretch → Aspect | `expand` | на вытянутых экранах (20:9) нет чёрных полос |
| Display → Window | Handheld → Orientation | `Sensor Landscape` | горизонтально, с поворотом на 180° |
| Rendering → Renderer | Rendering Method (+ `.mobile`) | `gl_compatibility` | OpenGL ES 3 — работает на любых телефонах |
| Rendering → Textures | VRAM Compression → Import ETC2 ASTC | вкл. | сжатие текстур для мобильных GPU |
| Rendering → Anti Aliasing | MSAA 3D | выкл. | экономия GPU |
| Input Devices → Pointing | Emulate Mouse From Touch | вкл. | обычные `Button` работают от тапа |
| Application → Config | Quit On Go Back | выкл. | «Назад» открывает Систему, а не закрывает игру |

Сборка APK: **Project → Export → Add… → Android**. Нужны шаблоны экспорта
(**Editor → Manage Export Templates → Download**) и ключ подписи (debug keystore
для теста). Включите архитектуру `arm64-v8a`.

## Сцены и узлы

### Сцены 1–2 — `story/truck_intro.tscn`, `story/god_room.tscn`

```
GodRoom (Control, full rect)          god_room.gd
├─ Background (TextureRect)           белый градиент
├─ God (TextureRect)                  спрайт Бога, анимируется твинами
└─ DialogueBox (instance)             ui/dialogue_box/dialogue_box.tscn
   └─ Panel (PanelContainer, снизу) → VBox → NameLabel, TextLabel (RichTextLabel), NextHint
```
`DialogueBox` растянут на весь экран, поэтому тап в любом месте листает реплику.
Реплика с полем `event` вызывает сигнал `line_started` — сцена запускает эффект
(фары, удар, появление Бога).

### Сцена 3 — `skill_select/skill_select.tscn`

```
SkillSelect (Control)                          skill_select.gd
├─ Background (TextureRect)
├─ SafeArea (MarginContainer, отступы под вырез камеры)
│  └─ Window (PanelContainer, синий стиль Системы)
│     └─ VBox
│        ├─ Header → Title, %PointsLabel
│        ├─ Body (HBox)
│        │  ├─ %Tabs (TabContainer)
│        │  │  ├─ ActiveTab (ScrollContainer) → %ActiveList (VBox, кнопки навыков)
│        │  │  └─ PassiveTab (ScrollContainer) → %PassiveList
│        │  └─ Details (PanelContainer) → %SkillName, %SkillInfo, %TakeButton
│        └─ Footer → %ResetButton, %ConfirmButton
└─ %ConfirmDialog (ConfirmationDialog)
```
Тап по навыку показывает описание, «Взять» тратит очки. Кнопки высотой 72–80 px — под палец.

### Сцена 4 — `world/forest/forest.tscn` и игрок

```
Forest (Node3D)                         forest.gd
├─ WorldEnvironment, Sun (DirectionalLight3D)
├─ Ground (StaticBody3D)
├─ Trees → Trunks, Crowns (MultiMeshInstance3D), Colliders (StaticBody3D)
├─ Path (тропа к хижине), AbandonedHut (instance)
├─ Creatures → Slime1..4 (instance enemies/slime.tscn)
└─ Player (instance player/player.tscn)

Player (CharacterBody3D)                player.gd
├─ CollisionShape3D (Capsule r=0.35 h=1.75)
├─ Head (Node3D, y=1.6)                 наклон вверх/вниз
│  └─ Camera3D                          FOV 75
│     └─ InteractRay (RayCast3D, 3 м)   на что смотрит игрок
└─ UI (CanvasLayer)
   ├─ HUD                               ui/hud/hud.tscn
   ├─ TouchControls (process: Always)   ui/touch_controls/touch_controls.tscn
   │  ├─ ActionAnchor (низ-право) → JumpButton, InteractButton (TouchScreenButton)
   │  └─ SystemAnchor (верх-право) → SystemButton (TouchScreenButton)
   └─ SystemWindow (process: Always)    ui/system_window/system_window.tscn
```

Слизь (`enemies/slime.tscn`): `CharacterBody3D` → `CollisionShape3D` + `Sprite3D`
с `billboard = Fixed Y` (смотрит на камеру, но не заваливается), `alpha_cut = Discard`
(без проблем сортировки прозрачности), `shaded = false` (плоский аниме-цвет).
Для пиксель-арта поставьте `texture_filter = Nearest`.

## Какой скрипт к какому узлу

| Файл | Узел |
|---|---|
| `autoload/*.gd` | Project Settings → Globals → Autoload (уже подключены) |
| `scenes/title/title_screen.gd` | корень `TitleScreen` |
| `scenes/story/truck_intro.gd` | корень `TruckIntro` |
| `scenes/story/god_room.gd` | корень `GodRoom` |
| `scenes/ui/dialogue_box/dialogue_box.gd` | корень `DialogueBox` |
| `scenes/skill_select/skill_select.gd` | корень `SkillSelect` |
| `scenes/world/forest/forest.gd` | корень `Forest` |
| `scenes/world/hut/abandoned_hut.gd` | корень `AbandonedHut` |
| `scenes/player/player.gd` | корень `Player` |
| `scenes/enemies/billboard_creature.gd` | корень `Slime` (и любых спрайт-NPC) |
| `scenes/ui/touch_controls/touch_controls.gd` | корень `TouchControls` |
| `scenes/ui/touch_controls/action_button.gd` | `JumpButton`, `InteractButton` |
| `scenes/ui/touch_controls/system_button.gd` | `SystemButton` |
| `scenes/ui/system_window/system_window.gd` | корень `SystemWindow` |
| `scenes/ui/hud/hud.gd` | корень `HUD` |

## Как расширять

- **Новый навык** — строка `_add(...)` в `SkillManager._register_skills()`.
  Пассивные бонусы — через `stat_bonuses`, они автоматически попадут в статы.
- **Новый диалог** — массив в `data/dialogues/`, затем `await $DialogueBox.play(МАССИВ)`.
- **Новый объект для взаимодействия** — методы `get_interaction_label()` и `interact(player)`:
  игрок сам покажет кнопку «Действие», когда посмотрит на объект.
- **Многоракурсный спрайт** (8 сторон, как в Doom) — лист с `hframes = 8`
  и `direction_count = 8` в инспекторе существа.

## Тесты

```
godot --headless --script res://tests/test_skill_manager.gd   # логика навыков
godot --headless res://tests/flow_test.tscn                   # весь сюжет от грузовика до хижины
```
