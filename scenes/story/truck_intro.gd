extends Control
## Сцена 1: офисный работник, ночной переход и грузовик.
## Реплики листаются тапом; события реплик запускают эффекты.

const NEXT_SCENE := "res://scenes/story/god_room.tscn"

@onready var _background: ColorRect = %Background
@onready var _street: Control = %Street
@onready var _headlights: ColorRect = %Headlights
@onready var _flash: ColorRect = %Flash
@onready var _dialogue: DialogueBox = %DialogueBox


func _ready() -> void:
	_dialogue.line_started.connect(_on_line_started)
	await _dialogue.play(IntroDialogues.TRUCK)
	SceneManager.change_scene(NEXT_SCENE, 1.2)


func _on_line_started(_index: int, line: Dictionary) -> void:
	match line.get("event", ""):
		"headlights":
			create_tween().tween_property(_headlights, "modulate:a", 0.85, 2.5)
		"impact":
			_impact()
		"blackout":
			_background.color = Color.BLACK
			_street.hide()
			_headlights.hide()


func _impact() -> void:
	Input.vibrate_handheld(400)
	_flash.modulate.a = 1.0
	var tween := create_tween()
	for i in 8:
		var offset := Vector2(randf_range(-24, 24), randf_range(-24, 24))
		tween.tween_property(_street, "position", offset, 0.04)
	tween.tween_property(_street, "position", Vector2.ZERO, 0.04)
	tween.tween_property(_flash, "modulate:a", 0.0, 0.6)
