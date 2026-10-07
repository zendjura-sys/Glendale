extends Node2D
## Игрок пока просто рисуется кружком.

@export var radius := 40.0
@export var color := Color("f6e05e")


func _draw() -> void:
	draw_circle(Vector2.ZERO, radius, color)
