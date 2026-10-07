extends Node2D
## Тестовая сцена: кружок плавно следует за пальцем (или мышью).

const SPEED := 900.0

@onready var player: Node2D = $Player
var target := Vector2.ZERO


func _ready() -> void:
	target = player.position


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		target = event.position
	elif event is InputEventScreenDrag:
		target = event.position


func _process(delta: float) -> void:
	player.position = player.position.move_toward(target, SPEED * delta)
