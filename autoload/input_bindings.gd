extends Node
## Регистрирует действия ввода из кода.
##
## Основное управление в игре — сенсорное (см. TouchControls): экранный
## джойстик и кнопки сами нажимают эти действия. Клавиатура — запасной
## вариант (для геймпада/клавиатуры, подключённых к телефону, или для ПК).
## Используются физические клавиши, поэтому всё работает и на русской раскладке.

const BINDINGS := {
	&"move_forward": [KEY_W, KEY_UP],
	&"move_back": [KEY_S, KEY_DOWN],
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"jump": [KEY_SPACE],
	&"sprint": [KEY_SHIFT],
	&"interact": [KEY_E],
	&"toggle_system": [KEY_TAB],
}


func _enter_tree() -> void:
	for action: StringName in BINDINGS:
		if not InputMap.has_action(action):
			InputMap.add_action(action, 0.2)
		for keycode: Key in BINDINGS[action]:
			var event := InputEventKey.new()
			event.physical_keycode = keycode
			InputMap.action_add_event(action, event)
