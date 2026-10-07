extends Control
## Сцена 3: окно выбора навыков перерождения.
## Тап по навыку в списке показывает описание справа,
## кнопка «Взять / Отказаться» тратит или возвращает очки.

const NEXT_SCENE := "res://scenes/world/forest/forest.tscn"
const COLOR_OWNED := Color("7dffa0")
const COLOR_LOCKED := Color(1, 1, 1, 0.45)

@onready var _points_label: Label = %PointsLabel
@onready var _tabs: TabContainer = %Tabs
@onready var _active_list: VBoxContainer = %ActiveList
@onready var _passive_list: VBoxContainer = %PassiveList
@onready var _skill_name: Label = %SkillName
@onready var _skill_info: RichTextLabel = %SkillInfo
@onready var _take_button: Button = %TakeButton
@onready var _reset_button: Button = %ResetButton
@onready var _confirm_button: Button = %ConfirmButton
@onready var _confirm_dialog: ConfirmationDialog = %ConfirmDialog

var _buttons: Dictionary[StringName, Button] = {}
var _current: StringName


func _ready() -> void:
	_tabs.set_tab_title(0, "Активные")
	_tabs.set_tab_title(1, "Пассивные")
	_build_list(_active_list, SkillData.Type.ACTIVE)
	_build_list(_passive_list, SkillData.Type.PASSIVE)
	_take_button.pressed.connect(_on_take_pressed)
	_reset_button.pressed.connect(SkillManager.reset_selection)
	_confirm_button.pressed.connect(_confirm_dialog.popup_centered)
	_confirm_dialog.confirmed.connect(_on_confirmed)
	SkillManager.selection_changed.connect(_refresh)
	_current = _buttons.keys()[0]
	_refresh()


func _build_list(container: VBoxContainer, type: SkillData.Type) -> void:
	for skill in SkillManager.get_skills_by_type(type):
		var button := Button.new()
		button.custom_minimum_size.y = 72
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.add_theme_font_size_override("font_size", 28)
		button.pressed.connect(_select_for_details.bind(skill.id))
		container.add_child(button)
		_buttons[skill.id] = button


func _select_for_details(id: StringName) -> void:
	_current = id
	_refresh()


func _refresh() -> void:
	for id in _buttons:
		var skill := SkillManager.get_skill(id)
		var button := _buttons[id]
		var owned := SkillManager.has_skill(id)
		button.text = "%s   %s%s" % [skill.display_name, _cost_text(skill), "   [взят]" if owned else ""]
		if owned:
			button.modulate = COLOR_OWNED
		elif not SkillManager.can_select(id):
			button.modulate = COLOR_LOCKED
		else:
			button.modulate = Color.WHITE
	_points_label.text = "Очки перерождения: %d / %d" % [
		SkillManager.get_remaining_points(), SkillManager.total_points]
	_show_details(_current)


func _show_details(id: StringName) -> void:
	var skill := SkillManager.get_skill(id)
	_skill_name.text = skill.display_name
	var info := "[color=#8fd3ff]%s навык[/color]   •   %s\n\n%s" % [
		skill.type_name(), _cost_text(skill), skill.description]
	if skill.mp_cost > 0:
		info += "\n\nРасход маны: [color=#8fd3ff]%d MP[/color]" % skill.mp_cost
	for stat: String in skill.stat_bonuses:
		info += "\nБонус: %s +%d" % [_stat_name(stat), skill.stat_bonuses[stat]]
	_skill_info.text = info

	_take_button.disabled = false
	if skill.innate:
		_take_button.text = "Дар Бога"
		_take_button.disabled = true
	elif SkillManager.has_skill(id):
		_take_button.text = "Отказаться (+%d)" % skill.cost
	elif SkillManager.can_select(id):
		_take_button.text = "Взять (-%d)" % skill.cost
	else:
		_take_button.text = "Не хватает очков"
		_take_button.disabled = true


func _on_take_pressed() -> void:
	SkillManager.toggle_skill(_current)


func _on_confirmed() -> void:
	if SkillManager.confirm_selection():
		SceneManager.change_scene(NEXT_SCENE, 1.0)


func _cost_text(skill: SkillData) -> String:
	return "бесплатно" if skill.innate else "%d оч." % skill.cost


func _stat_name(stat: String) -> String:
	match stat:
		"max_hp": return "Здоровье"
		"max_mp": return "Мана"
		"inventory_slots": return "Ячейки инвентаря"
	return GameState.STAT_NAMES.get(stat, stat)
