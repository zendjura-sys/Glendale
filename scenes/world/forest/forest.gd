extends Node3D
## Сцена 4: лес, где появляется герой.
## Деревья рисуются через MultiMeshInstance3D: сотни деревьев за 2 вызова
## отрисовки. Это критично для производительности на телефонах.
## Коллизия стволов — один StaticBody3D со множеством CollisionShape3D.

@export var tree_count := 140
@export var area_half_size := 45.0
@export var forest_seed := 20261007
## Свободные от деревьев зоны: Vector4(x, z, радиус, 0).
@export var clearings: Array[Vector4] = [Vector4(0, 0, 5, 0), Vector4(20, -30, 8, 0)]

@onready var _player: Player = $Player
@onready var _hut: Node3D = $AbandonedHut
@onready var _trunks: MultiMeshInstance3D = $Trees/Trunks
@onready var _crowns: MultiMeshInstance3D = $Trees/Crowns
@onready var _tree_colliders: StaticBody3D = $Trees/Colliders
@onready var _path: Node3D = $Path


func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = forest_seed
	_spawn_trees(rng)
	_build_path(rng)
	_build_bounds()
	_intro()


func _intro() -> void:
	if GameState.flags.get("arrived_forest", false):
		return
	GameState.flags["arrived_forest"] = true
	await get_tree().create_timer(1.0).timeout
	GameState.notify("[Система] Перерождение завершено. Добро пожаловать, %s." % GameState.hero_name)
	await get_tree().create_timer(1.5).timeout
	GameState.notify("[Система] Системное окно активировано. Кнопка «Система» — справа вверху.")
	await get_tree().create_timer(2.0).timeout
	GameState.start_quest(&"find_hut")


func _is_in_clearing(x: float, z: float) -> bool:
	for c in clearings:
		if Vector2(x - c.x, z - c.y).length() < c.z:
			return true
	# Тропа к хижине тоже свободна.
	var start := Vector2.ZERO
	var end := Vector2(_hut.position.x, _hut.position.z)
	var closest := Geometry2D.get_closest_point_to_segment(Vector2(x, z), start, end)
	return closest.distance_to(Vector2(x, z)) < 2.0


func _spawn_trees(rng: RandomNumberGenerator) -> void:
	var transforms: Array[Transform3D] = []
	var attempts := 0
	while transforms.size() < tree_count and attempts < tree_count * 20:
		attempts += 1
		var x := rng.randf_range(-area_half_size, area_half_size)
		var z := rng.randf_range(-area_half_size, area_half_size)
		if _is_in_clearing(x, z):
			continue
		var tree_scale := rng.randf_range(0.8, 1.4)
		var tree_basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * tree_scale)
		transforms.append(Transform3D(tree_basis, Vector3(x, 0, z)))

	_trunks.multimesh.instance_count = transforms.size()
	_crowns.multimesh.instance_count = transforms.size()
	for i in transforms.size():
		var t := transforms[i]
		var height := t.basis.get_scale().y
		# Меши отцентрованы, поэтому поднимаем ствол и крону над землёй.
		_trunks.multimesh.set_instance_transform(i, t.translated(Vector3(0, 1.5 * height, 0)))
		_crowns.multimesh.set_instance_transform(i, t.translated(Vector3(0, 4.5 * height, 0)))
		var collision := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = 0.25 * t.basis.get_scale().x
		shape.height = 3.0
		collision.shape = shape
		collision.position = t.origin + Vector3(0, 1.5, 0)
		_tree_colliders.add_child(collision)


## Светлая тропинка от точки появления к хижине — подсказка, куда идти.
func _build_path(rng: RandomNumberGenerator) -> void:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(1.6, 1.6)
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.45, 0.38, 0.25)
	mesh.material = material
	var end := Vector3(_hut.position.x, 0, _hut.position.z + 3.0)
	var steps := int(end.length() / 1.2)
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = mesh
	multimesh.instance_count = steps
	for i in steps:
		var point := end * (float(i) / steps)
		point += Vector3(rng.randf_range(-0.3, 0.3), 0.01, rng.randf_range(-0.3, 0.3))
		multimesh.set_instance_transform(i, Transform3D(Basis(Vector3.UP, rng.randf() * TAU), point))
	var instance := MultiMeshInstance3D.new()
	instance.multimesh = multimesh
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_path.add_child(instance)


## Невидимые стены по краю карты.
func _build_bounds() -> void:
	var limit := area_half_size + 2.0
	for side in [Vector3(limit, 0, 0), Vector3(-limit, 0, 0), Vector3(0, 0, limit), Vector3(0, 0, -limit)]:
		var collision := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(1, 10, limit * 2) if side.x != 0 else Vector3(limit * 2, 10, 1)
		collision.shape = shape
		collision.position = side + Vector3(0, 5, 0)
		_tree_colliders.add_child(collision)
