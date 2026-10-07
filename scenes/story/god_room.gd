extends Control
## Сцена 2: Белая комната. Бог извиняется и предлагает перерождение.

const NEXT_SCENE := "res://scenes/skill_select/skill_select.tscn"

@onready var _god: TextureRect = %God
@onready var _dialogue: DialogueBox = %DialogueBox

var _god_base_y := 0.0


func _ready() -> void:
	_god.modulate.a = 0.0
	_god_base_y = _god.position.y
	_dialogue.line_started.connect(_on_line_started)
	await _dialogue.play(IntroDialogues.GOD_ROOM)
	GameState.flags["met_god"] = true
	SceneManager.change_scene(NEXT_SCENE)


func _on_line_started(_index: int, line: Dictionary) -> void:
	match line.get("event", ""):
		"god_appear":
			create_tween().tween_property(_god, "modulate:a", 1.0, 1.5)
			_start_floating()
		"god_bow":
			var tween := create_tween()
			tween.tween_property(_god, "rotation_degrees", 6.0, 0.4)
			tween.tween_interval(0.5)
			tween.tween_property(_god, "rotation_degrees", 0.0, 0.4)
		"open_skills":
			var tween := create_tween()
			tween.tween_property(_god, "modulate", Color(0.6, 0.85, 1, 1), 0.8)


func _start_floating() -> void:
	var tween := create_tween().set_loops().set_trans(Tween.TRANS_SINE)
	tween.tween_property(_god, "position:y", _god_base_y - 12.0, 1.6)
	tween.tween_property(_god, "position:y", _god_base_y, 1.6)
