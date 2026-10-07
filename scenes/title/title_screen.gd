extends Control
## Титульный экран: новая игра / продолжить.

const FIRST_SCENE := "res://scenes/story/truck_intro.tscn"

@onready var _new_game: Button = %NewGameButton
@onready var _continue: Button = %ContinueButton
@onready var _quit: Button = %QuitButton


func _ready() -> void:
	_continue.visible = GameState.has_save()
	_new_game.pressed.connect(_on_new_game)
	_continue.pressed.connect(_on_continue)
	_quit.pressed.connect(get_tree().quit)
	(_continue if _continue.visible else _new_game).grab_focus()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		get_tree().quit()


func _on_new_game() -> void:
	SkillManager.reset_selection()
	GameState.new_game()
	SceneManager.change_scene(FIRST_SCENE)


func _on_continue() -> void:
	var scene := GameState.load_game()
	SceneManager.change_scene(scene if not scene.is_empty() else FIRST_SCENE)
