class_name Player
extends CharacterBody3D
## Контроллер от первого лица для Android.
## Движение читается через Input.get_vector(): его нажимает экранный
## джойстик (TouchControls), клавиатура или геймпад — код один.
## Вращение камеры: свайп по правой части экрана (сигнал look_input)
## или мышь на ПК. Тело поворачивается по горизонтали (yaw),
## узел Head — по вертикали (pitch), чтобы не было завала камеры.

signal focus_changed(target: Node)

@export_group("Движение")
@export var walk_speed := 3.5
@export var run_speed := 6.0
## Джойстик отклонён почти до края — герой бежит.
@export_range(0.5, 1.0) var run_threshold := 0.9
@export var ground_acceleration := 10.0
@export var air_acceleration := 2.0
@export var jump_velocity := 4.5

@export_group("Камера")
## Градусов поворота на пиксель свайпа.
@export var touch_sensitivity := 0.18
@export var mouse_sensitivity := 0.12
@export_range(30.0, 89.0) var max_pitch := 80.0
@export var head_bob_amount := 0.05
@export var head_bob_speed := 2.4

@onready var _head: Node3D = $Head
@onready var _camera: Camera3D = $Head/Camera3D
@onready var _interact_ray: RayCast3D = $Head/Camera3D/InteractRay
@onready var _touch_controls: TouchControls = $UI/TouchControls

var _gravity := float(ProjectSettings.get_setting("physics/3d/default_gravity"))
var _bob_time := 0.0
var _camera_base_y := 0.0
var _focus: Node


func _ready() -> void:
	add_to_group(&"player")
	_camera_base_y = _camera.position.y
	_touch_controls.look_input.connect(_on_touch_look)
	if not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_look(event.relative * mouse_sensitivity)
	elif event.is_action_pressed(&"interact"):
		interact()
	elif event is InputEventMouseButton and event.pressed \
			and not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


## Поворот взгляда на заданное число градусов (x — влево/вправо, y — вверх/вниз).
func rotate_look(degrees: Vector2) -> void:
	rotate_y(deg_to_rad(-degrees.x))
	_head.rotation.x = clampf(_head.rotation.x - deg_to_rad(degrees.y),
		-deg_to_rad(max_pitch), deg_to_rad(max_pitch))


func _on_touch_look(relative: Vector2) -> void:
	rotate_look(relative * touch_sensitivity)


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= _gravity * delta
	elif Input.is_action_just_pressed(&"jump"):
		velocity.y = jump_velocity

	var input := Input.get_vector(&"move_left", &"move_right", &"move_forward", &"move_back")
	var running := Input.is_action_pressed(&"sprint") or input.length() >= run_threshold
	var target := global_basis * Vector3(input.x, 0.0, input.y) * (run_speed if running else walk_speed)
	var acceleration := ground_acceleration if is_on_floor() else air_acceleration
	# Экспоненциальное сглаживание не зависит от FPS.
	var weight := 1.0 - exp(-acceleration * delta)
	velocity.x = lerpf(velocity.x, target.x, weight)
	velocity.z = lerpf(velocity.z, target.z, weight)
	move_and_slide()

	_update_head_bob(delta)
	_update_focus()


func _update_head_bob(delta: float) -> void:
	var speed := Vector2(velocity.x, velocity.z).length()
	if is_on_floor() and speed > 0.5:
		_bob_time += delta * speed * head_bob_speed
		_camera.position.y = _camera_base_y + sin(_bob_time) * head_bob_amount
	else:
		_camera.position.y = lerpf(_camera.position.y, _camera_base_y, 10.0 * delta)


## Ищет объект под прицелом, с которым можно взаимодействовать.
## Контракт объекта: get_interaction_label() -> String и interact(player).
func _update_focus() -> void:
	var target: Node = null
	if _interact_ray.is_colliding():
		var collider := _interact_ray.get_collider() as Node
		if collider and collider.has_method(&"interact"):
			target = collider
	if target == _focus:
		return
	_focus = target
	_touch_controls.set_interact_target(target.get_interaction_label() if target else "")
	focus_changed.emit(target)


func interact() -> void:
	if is_instance_valid(_focus):
		_focus.interact(self)
