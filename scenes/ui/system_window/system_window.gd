class_name SystemWindow
extends Control
## «Системное окно» LitRPG, видимое только герою.
## open() ставит игру на паузу (get_tree().paused = true) и показывает
## статус, выбранные навыки, инвентарь и задания.
## Узел работает с process_mode = ALWAYS, чтобы реагировать во время паузы.
## Также открывается системной кнопкой «Назад» Android и при сворачивании игры.

signal opened
signal closed

const TITLE_SCENE := "res://scenes/title/title_screen.tscn"

@onready var _window: PanelContainer = %Window
@onready var _tabs: TabContainer = %Tabs
@onready var _status_text: RichTextLabel = %StatusText
@onready var _skills_text: RichTextLabel = %SkillsText
@onready var _inventory_text: RichTextLabel = %InventoryText
@onready var _quests_text: RichTextLabel = %QuestsText
@onready var _save_button: Button = %SaveButton
@onready var _menu_button: Button = %MenuButton
@onready var _close_button: Button = %CloseButton


func _ready() -> void:
	add_to_group(&"system_window")
	hide()
	for i in _tabs.get_tab_count():
		_tabs.set_tab_title(i, ["Статус", "Навыки", "Инвентарь", "Задания"][i])
	_close_button.pressed.connect(close)
	_save_button.pressed.connect(_on_save_pressed)
	_menu_button.pressed.connect(_on_menu_pressed)


func is_open() -> bool:
	return visible


func open() -> void:
	if visible:
		return
	_refresh()
	show()
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_window.pivot_offset = _window.size / 2.0
	_window.scale = Vector2(0.9, 0.9)
	_window.modulate.a = 0.0
	var tween := create_tween().set_parallel().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_window, "scale", Vector2.ONE, 0.2)
	tween.tween_property(_window, "modulate:a", 1.0, 0.15)
	opened.emit()


func close() -> void:
	if not visible:
		return
	hide()
	get_tree().paused = false
	if not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	closed.emit()


func toggle() -> void:
	if visible:
		close()
	else:
		open()


func _input(event: InputEvent) -> void:
	# _input, а не _unhandled_input: иначе Tab перехватит навигация GUI.
	if event.is_action_pressed(&"toggle_system"):
		get_viewport().set_input_as_handled()
		toggle()
	elif visible and event.is_action_pressed(&"ui_cancel"):
		get_viewport().set_input_as_handled()
		close()


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_GO_BACK_REQUEST:
			toggle()
		NOTIFICATION_APPLICATION_PAUSED:
			# Игрок свернул игру: ставим на паузу и сохраняемся.
			open()
			GameState.save_game()


func _refresh() -> void:
	_status_text.text = _build_status()
	_skills_text.text = _build_skills()
	_inventory_text.text = _build_inventory()
	_quests_text.text = _build_quests()


func _build_status() -> String:
	var s := GameState.stats
	var text := "[b]%s[/b]    Раса: Человек    Титул: Перерождённый\n\n" % GameState.hero_name
	text += "Уровень: [color=gold]%d[/color]    Опыт: %d / %d\n" % [
		GameState.level, GameState.experience, GameState.exp_to_next_level()]
	text += "[color=#ff7a7a]HP[/color] %d / %d      [color=#7ab8ff]MP[/color] %d / %d\n\n" % [
		GameState.hp, s.max_hp, GameState.mp, s.max_mp]
	for stat: String in GameState.STAT_NAMES:
		text += "%s: %d\n" % [GameState.STAT_NAMES[stat], s[stat]]
	return text


func _build_skills() -> String:
	var text := ""
	for skill in SkillManager.get_owned_skills():
		var color := "#8fd3ff" if skill.type == SkillData.Type.ACTIVE else "#7dffa0"
		text += "[color=%s][b]%s[/b][/color]  [i](%s)[/i]\n%s\n\n" % [
			color, skill.display_name, skill.type_name(), skill.description]
	return text if not text.is_empty() else "Навыков нет."


func _build_inventory() -> String:
	var text := "Занято ячеек: %d / %d\n\n" % [GameState.inventory.size(), GameState.stats.inventory_slots]
	for id in GameState.inventory:
		text += "%s  x%d\n" % [GameState.item_name(id), GameState.inventory[id]]
	return text


func _build_quests() -> String:
	if GameState.quests.is_empty():
		return "Активных заданий нет."
	var text := ""
	for id in GameState.quests:
		var quest: Dictionary = GameState.QUESTS[id]
		var done := GameState.quests[id] == "completed"
		text += "[b]%s[/b]  %s\n%s\n\n" % [quest.title,
			"[color=#7dffa0](выполнено)[/color]" if done else "[color=gold](активно)[/color]",
			quest.description]
	return text


func _on_save_pressed() -> void:
	_save_button.text = "Сохранено" if GameState.save_game() else "Ошибка"
	await get_tree().create_timer(1.5).timeout
	_save_button.text = "Сохранить"


func _on_menu_pressed() -> void:
	GameState.save_game()
	SceneManager.change_scene(TITLE_SCENE)
