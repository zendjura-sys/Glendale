class_name HUD
extends Control
## Интерфейс поверх игры: полоски HP/MP, текущее задание,
## прицел и лента сообщений Системы.

@export var message_lifetime := 4.0
@export var max_messages := 4

@onready var _hp_bar: ProgressBar = %HPBar
@onready var _mp_bar: ProgressBar = %MPBar
@onready var _quest_label: Label = %QuestLabel
@onready var _messages: VBoxContainer = %Messages


func _ready() -> void:
	GameState.stats_changed.connect(_update_bars)
	GameState.quest_changed.connect(_update_quest.unbind(1))
	GameState.notification_posted.connect(show_message)
	_update_bars()
	_update_quest()


func _process(_delta: float) -> void:
	# HP/MP меняются часто (реген), дешевле обновлять значения напрямую.
	_hp_bar.value = GameState.hp
	_mp_bar.value = GameState.mp


func _update_bars() -> void:
	_hp_bar.max_value = GameState.stats.max_hp
	_mp_bar.max_value = GameState.stats.max_mp


func _update_quest() -> void:
	var active: Array[String] = []
	for id in GameState.quests:
		if GameState.quests[id] == "active":
			active.append(GameState.QUESTS[id].title)
	_quest_label.text = "Задание: " + ", ".join(active) if not active.is_empty() else ""


func show_message(text: String) -> void:
	while _messages.get_child_count() >= max_messages:
		_messages.get_child(0).free()
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 26)
	label.add_theme_color_override("font_color", Color("cfeaff"))
	label.add_theme_color_override("font_outline_color", Color(0, 0.05, 0.15))
	label.add_theme_constant_override("outline_size", 8)
	_messages.add_child(label)
	var tween := label.create_tween()
	tween.tween_interval(message_lifetime)
	tween.tween_property(label, "modulate:a", 0.0, 0.6)
	tween.tween_callback(label.queue_free)
