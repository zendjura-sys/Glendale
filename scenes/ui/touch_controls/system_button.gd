extends TouchScreenButton
## Кнопка «Система» (прикреплена к узлу TouchControls/SystemAnchor/SystemButton).
## Открывает системное окно: пауза + статы, навыки, инвентарь.
## TouchScreenButton, а не Button: работает при мультитаче,
## даже если другой палец держит джойстик.

## Можно назначить в инспекторе; если пусто — окно ищется по группе
## "system_window" (так кнопка работает и внутри вложенной сцены).
@export var system_window: SystemWindow


func _ready() -> void:
	add_to_group(&"touch_buttons")
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	if system_window == null:
		system_window = get_tree().get_first_node_in_group(&"system_window") as SystemWindow
	if system_window:
		system_window.open()
	else:
		push_error("SystemButton: на сцене нет SystemWindow")
