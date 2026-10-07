class_name TouchControls
extends Control
## Мобильное управление от первого лица.
##   Левая часть экрана  — плавающий джойстик: появляется там, где коснулся палец.
##   Правая часть экрана — свайп вращает камеру (InputEventScreenDrag).
##   Кнопки (TouchScreenButton) — прыжок, действие, «Система».
## Поддерживается мультитач: можно идти и одновременно крутить камеру.
## Джойстик нажимает обычные действия move_*, поэтому игрок читает
## движение через Input.get_vector() одинаково для экрана и клавиатуры.

signal look_input(relative: Vector2)

## Доля ширины экрана слева, отданная под джойстик.
@export_range(0.2, 0.7) var joystick_zone := 0.45
@export var joystick_radius := 120.0
@export var knob_radius := 50.0
@export_range(0.0, 0.5) var dead_zone := 0.12
@export var base_color := Color(0.56, 0.83, 1, 0.25)
@export var knob_color := Color(0.56, 0.83, 1, 0.6)

@onready var _interact_button: TouchScreenButton = %InteractButton
@onready var _interact_label: Label = %InteractLabel

var _move_index := -1
var _look_index := -1
var _origin := Vector2.ZERO
var _knob := Vector2.ZERO


func _ready() -> void:
	set_interact_target("")


func _notification(what: int) -> void:
	# При паузе или сворачивании приложения отпускаем все «залипшие» касания.
	if what == NOTIFICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_release_all()


func _input(event: InputEvent) -> void:
	if get_tree().paused:
		_release_all()
		return
	if event is InputEventScreenTouch:
		_handle_touch(event)
	elif event is InputEventScreenDrag:
		_handle_drag(event)


func _handle_touch(event: InputEventScreenTouch) -> void:
	if event.pressed:
		if _is_over_button(event.position):
			return
		if event.position.x < size.x * joystick_zone:
			if _move_index == -1:
				_move_index = event.index
				_origin = event.position
				_knob = event.position
				queue_redraw()
		elif _look_index == -1:
			_look_index = event.index
	else:
		if event.index == _move_index:
			_reset_joystick()
		elif event.index == _look_index:
			_look_index = -1


func _handle_drag(event: InputEventScreenDrag) -> void:
	if event.index == _move_index:
		var offset := (event.position - _origin).limit_length(joystick_radius)
		_knob = _origin + offset
		_apply_move(offset / joystick_radius)
		queue_redraw()
	elif event.index == _look_index:
		look_input.emit(event.relative)


func _apply_move(vector: Vector2) -> void:
	_set_axis(&"move_left", &"move_right", vector.x)
	_set_axis(&"move_forward", &"move_back", vector.y)


func _set_axis(negative: StringName, positive: StringName, value: float) -> void:
	if value < -dead_zone:
		Input.action_press(negative, -value)
		Input.action_release(positive)
	elif value > dead_zone:
		Input.action_press(positive, value)
		Input.action_release(negative)
	else:
		Input.action_release(negative)
		Input.action_release(positive)


func _reset_joystick() -> void:
	_move_index = -1
	_apply_move(Vector2.ZERO)
	queue_redraw()


func _release_all() -> void:
	if _move_index != -1:
		_reset_joystick()
	_look_index = -1


func _is_over_button(point: Vector2) -> bool:
	for button: TouchScreenButton in get_tree().get_nodes_in_group(&"touch_buttons"):
		if button.is_visible_in_tree() and button.texture_normal:
			var rect := Rect2(Vector2.ZERO, button.texture_normal.get_size())
			if rect.has_point(button.get_global_transform_with_canvas().affine_inverse() * point):
				return true
	return false


func _draw() -> void:
	if _move_index == -1:
		# Подсказка, где находится джойстик.
		var hint := Vector2(size.x * 0.16, size.y * 0.72)
		draw_circle(hint, joystick_radius, Color(base_color, base_color.a * 0.5), false, 4.0)
		return
	draw_circle(_origin, joystick_radius, base_color)
	draw_circle(_origin, joystick_radius, knob_color, false, 4.0)
	draw_circle(_knob, knob_radius, knob_color)


## Показывает кнопку «Действие» с подписью, когда игрок смотрит на объект.
func set_interact_target(label: String) -> void:
	_interact_button.visible = not label.is_empty()
	_interact_label.text = label
