## Меню «Система»: статус героя, навыки отряда, инвентарь и задания.
## Открывается кнопкой «Система» (тап) или клавишей Tab, ставит игру на паузу.
## На Android системная кнопка «Назад» тоже открывает и закрывает меню.
class_name SystemMenu extends CanvasLayer

## Характеристики бойцов отряда для вкладки «Статус».
const PARTY := [
	{name = "Рэн", role = "Голем «Болванчик-01»", stats = preload("res://combat/battlers/bear/bear_stats.tres"),
		skills = [["Отладка", "Уникальный. Видит ошибки мира как строки кода и находит обходы."],
			["Железный кулак", "Удар корпусом голема. Много урона, легко промахнуться."],
			["Концентрация", "Повышает атаку и точность."]]},
	{name = "Орешек", role = "Лесной фамильяр", stats = preload("res://combat/battlers/squirrel/squirrel_stats.tres"),
		skills = [["Град орехов", "Обстрел всех врагов."], ["Лечение", "Восстанавливает здоровье союзнику."]]},
]

const ITEM_NAMES := {
	Inventory.ItemTypes.KEY: "Ключ",
	Inventory.ItemTypes.COIN: "Жетон гильдии",
	Inventory.ItemTypes.BOMB: "Бомба",
	Inventory.ItemTypes.RED_WAND: "Красный жезл",
	Inventory.ItemTypes.BLUE_WAND: "Синий жезл",
	Inventory.ItemTypes.GREEN_WAND: "Зелёный жезл",
}

@onready var _open_button: Button = %OpenButton
@onready var _window: Control = %Window
@onready var _tabs: TabContainer = %Tabs
@onready var _status_text: RichTextLabel = %StatusText
@onready var _skills_text: RichTextLabel = %SkillsText
@onready var _inventory_text: RichTextLabel = %InventoryText
@onready var _quests_text: RichTextLabel = %QuestsText
@onready var _close_button: Button = %CloseButton

# Кнопка скрыта во время диалогов, катсцен и боёв.
var _blockers := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_window.hide()
	for i in _tabs.get_tab_count():
		_tabs.set_tab_title(i, ["Статус", "Навыки", "Инвентарь", "Задания"][i])
	_open_button.pressed.connect(open)
	_close_button.pressed.connect(close)
	Dialogic.timeline_started.connect(_set_blocked.bind(&"dialogue", true))
	Dialogic.timeline_ended.connect(_set_blocked.bind(&"dialogue", false))
	# combat_initiated объявлен с аргументом, но шаблон испускает его без аргументов —
	# лямбды с аргументом по умолчанию принимают оба варианта.
	CombatEvents.combat_initiated.connect(func(_arena = null) -> void: _set_blocked(&"combat", true))
	CombatEvents.combat_finished.connect(func(_victory = false) -> void: _set_blocked(&"combat", false))
	FieldEvents.cutscene_began.connect(_set_blocked.bind(&"cutscene", true))
	FieldEvents.cutscene_ended.connect(_set_blocked.bind(&"cutscene", false))


func is_open() -> bool:
	return _window.visible


func open() -> void:
	if is_open() or not _blockers.is_empty():
		return
	_refresh()
	_window.show()
	_open_button.hide()
	get_tree().paused = true
	_close_button.grab_focus()


func close() -> void:
	if not is_open():
		return
	_window.hide()
	get_tree().paused = false
	_update_button()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_TAB:
		get_viewport().set_input_as_handled()
		close() if is_open() else open()
	elif is_open() and event.is_action_pressed("back"):
		get_viewport().set_input_as_handled()
		close()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		close() if is_open() else open()


func _set_blocked(reason: StringName, blocked: bool) -> void:
	if blocked:
		_blockers[reason] = true
	else:
		_blockers.erase(reason)
	_update_button()


func _update_button() -> void:
	_open_button.visible = _blockers.is_empty() and not is_open()


func _refresh() -> void:
	_status_text.text = _build_status()
	_skills_text.text = _build_skills()
	_inventory_text.text = _build_inventory()
	_quests_text.text = _build_quests()


func _build_status() -> String:
	var text := "[b]%s[/b]   [color=#8fd3ff]Отладчик из другого мира[/color]\n" % HeroSystem.HERO_NAME
	text += "Уровень [color=gold]%d[/color]   Опыт %d / %d\n" % [
		HeroSystem.level, HeroSystem.experience, HeroSystem.experience_to_next_level()]
	for member: Dictionary in PARTY:
		var stats: BattlerStats = member.stats
		text += "\n[b]%s[/b] — %s\n" % [member.name, member.role]
		text += "HP %d   Атака %d   Защита %d   Скорость %d   Точность %d%%\n" % [
			stats.base_max_health, stats.base_attack, stats.base_defense, stats.base_speed,
			stats.base_hit_chance]
	return text


func _build_skills() -> String:
	var text := ""
	for member: Dictionary in PARTY:
		text += "[b]%s[/b]\n" % member.name
		for skill: Array in member.skills:
			text += "  [color=#8fd3ff]%s[/color] — %s\n" % skill
		text += "\n"
	return text


func _build_inventory() -> String:
	var inventory := Inventory.restore()
	var text := ""
	for type: Inventory.ItemTypes in ITEM_NAMES:
		var count := inventory.get_item_count(type)
		if count > 0:
			text += "%s  x%d\n" % [ITEM_NAMES[type], count]
	return text if not text.is_empty() else "Пусто."


func _build_quests() -> String:
	var text := "[b]Голос из леса[/b]  [color=gold](активно)[/color]\n"
	text += "Кто-то зовёт голема в лес. Похоже, он знает, почему я здесь.\n\n"
	var status := int(_dialogic_var("TokenQuestStatus"))
	if status >= 1:
		var done := status >= 3
		text += "[b]Автографы для Мими[/b]  %s\n" % (
			"[color=#7dffa0](выполнено)[/color]" if done else "[color=gold](активно)[/color]")
		if not done:
			text += "Попросить у Четвёрки Рассвета автографы. Жетоны: %d / 4\n" % int(_dialogic_var("TokenCount"))
		text += "\n"
	if int(_dialogic_var("StrangeTreeExamined")) > 0:
		text += "[b]Странное дерево[/b]\nДерево перегородило проход. Может, есть обход?\n"
	return text


func _dialogic_var(variable: String) -> Variant:
	return Dialogic.VAR.get_variable("{%s}" % variable, 0)
