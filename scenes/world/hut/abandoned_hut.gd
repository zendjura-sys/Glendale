class_name AbandonedHut
extends Node3D
## Заброшенная хижина — будущая база героя.
## Геометрия собирается из примитивов в коде (заглушка до настоящей модели):
## замените узел Model на импортированный .glb, логика триггера останется.
## Когда герой заходит внутрь, задание «find_hut» выполняется.

const QUEST_ID := &"find_hut"

@export var size := Vector3(5.0, 2.6, 4.5)
@export var door_width := 1.3
@export var wall_thickness := 0.15
@export var wood_color := Color(0.42, 0.29, 0.18)
@export var roof_color := Color(0.3, 0.22, 0.16)

@onready var _model: Node3D = $Model
@onready var _inside: Area3D = $Inside


func _ready() -> void:
	_build()
	_inside.body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group(&"player") or not GameState.is_quest_active(QUEST_ID):
		return
	GameState.flags["hut_found"] = true
	GameState.notify("Пыльно, но крыша целая. Здесь можно жить.")
	GameState.complete_quest(QUEST_ID, 50)
	GameState.notify("[Система] Хижина отмечена как ваша база. Игра сохранена.")
	GameState.save_game()


func _build() -> void:
	var wood := _material(wood_color)
	var half := size / 2.0
	var t := wall_thickness
	# Пол.
	_add_box(Vector3(size.x, 0.1, size.z), Vector3(0, 0.05, 0), wood)
	# Задняя и боковые стены.
	_add_box(Vector3(size.x, size.y, t), Vector3(0, half.y, -half.z), wood)
	_add_box(Vector3(t, size.y, size.z), Vector3(-half.x, half.y, 0), wood)
	_add_box(Vector3(t, size.y, size.z), Vector3(half.x, half.y, 0), wood)
	# Передняя стена с дверным проёмом (+Z).
	var side := (size.x - door_width) / 2.0
	_add_box(Vector3(side, size.y, t), Vector3(-half.x + side / 2.0, half.y, half.z), wood)
	_add_box(Vector3(side, size.y, t), Vector3(half.x - side / 2.0, half.y, half.z), wood)
	_add_box(Vector3(door_width, 0.5, t), Vector3(0, size.y - 0.25, half.z), wood)
	# Двускатная крыша.
	var roof := PrismMesh.new()
	roof.size = Vector3(size.x + 0.8, 1.4, size.z + 0.8)
	roof.material = _material(roof_color)
	var roof_instance := MeshInstance3D.new()
	roof_instance.mesh = roof
	roof_instance.position = Vector3(0, size.y + 0.7, 0)
	_model.add_child(roof_instance)


func _add_box(box_size: Vector3, center: Vector3, material: Material) -> void:
	var body := StaticBody3D.new()
	body.position = center
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = box_size
	box.material = material
	mesh.mesh = box
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = box_size
	collision.shape = shape
	body.add_child(mesh)
	body.add_child(collision)
	_model.add_child(body)


func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.95
	return material
