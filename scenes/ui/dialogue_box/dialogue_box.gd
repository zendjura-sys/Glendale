class_name DialogueBox
extends Control
## Окно диалога визуальной новеллы. Занимает весь экран, чтобы тап
## в любом месте переключал реплику.
##   Тап во время печати — показать реплику целиком.
##   Тап после печати    — следующая реплика.
## Использование: await $DialogueBox.play(IntroDialogues.GOD_ROOM)

signal line_started(index: int, line: Dictionary)
signal dialogue_finished

## Скорость печати текста (символов в секунду).
@export var chars_per_second := 45.0
@export var speaker_colors: Dictionary = {"Бог": Color("ffd75e")}

@onready var _name_label: Label = %NameLabel
@onready var _text_label: RichTextLabel = %TextLabel
@onready var _next_hint: Label = %NextHint

var _lines: Array[Dictionary] = []
var _index := -1
var _typing: Tween


func _ready() -> void:
	hide()
	var blink := create_tween().set_loops()
	blink.tween_property(_next_hint, "modulate:a", 0.2, 0.6)
	blink.tween_property(_next_hint, "modulate:a", 1.0, 0.6)


## Показывает реплики по очереди и ждёт, пока игрок их пролистает.
func play(lines: Array[Dictionary]) -> void:
	_lines = lines
	_index = -1
	show()
	_show_next()
	await dialogue_finished


func is_playing() -> bool:
	return visible


func advance() -> void:
	if _typing and _typing.is_running():
		_typing.kill()
		_finish_typing()
	else:
		_show_next()


func _gui_input(event: InputEvent) -> void:
	# На Android касание приходит сюда как эмулированный клик мыши.
	if event is InputEventMouseButton and event.pressed \
			and event.button_index == MOUSE_BUTTON_LEFT:
		accept_event()
		advance()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_accept"):
		get_viewport().set_input_as_handled()
		advance()


func _show_next() -> void:
	_index += 1
	if _index >= _lines.size():
		hide()
		dialogue_finished.emit()
		return
	var line := _lines[_index]
	var speaker: String = line.get("speaker", "")
	_name_label.text = speaker
	_name_label.visible = not speaker.is_empty()
	_name_label.add_theme_color_override("font_color", speaker_colors.get(speaker, Color("8fd3ff")))
	_text_label.text = line.get("text", "")
	_text_label.visible_ratio = 0.0
	_next_hint.hide()
	line_started.emit(_index, line)
	var duration := maxf(_text_label.get_total_character_count() / chars_per_second, 0.05)
	_typing = create_tween()
	_typing.tween_property(_text_label, "visible_ratio", 1.0, duration)
	_typing.finished.connect(_finish_typing)


func _finish_typing() -> void:
	_text_label.visible_ratio = 1.0
	_next_hint.show()
