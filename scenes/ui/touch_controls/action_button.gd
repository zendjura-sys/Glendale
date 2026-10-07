extends TouchScreenButton
## Экранная кнопка, нажимающая действие ввода (поле Action в инспекторе).
## Регистрируется в группе, чтобы касание по ней не вращало камеру.


func _ready() -> void:
	add_to_group(&"touch_buttons")
