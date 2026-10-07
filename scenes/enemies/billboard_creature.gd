class_name BillboardCreature
extends CharacterBody3D
## Существо-спрайт в 3D-мире (как в Doom): монстры, NPC, аниме-персонажи.
## Узел Sprite3D работает в режиме Billboard Fixed Y — всегда повёрнут
## к камере, но не наклоняется, когда игрок смотрит вверх/вниз.
## Поддерживает «многоракурсные» спрайты: в листе hframes = direction_count
## кадров (0 — лицом к камере, далее по часовой стрелке).
## Пока бродит вокруг точки появления; бой и приручение — следующий шаг.

@export var display_name := "Слизь"
@export var level := 1
@export var max_hp := 15
@export_multiline var appraisal_note := ""

@export_group("Поведение")
@export var move_speed := 1.0
@export var wander_radius := 5.0
@export var idle_time_range := Vector2(1.5, 4.0)

@export_group("Спрайт")
## 1 — один кадр для всех ракурсов; 4 или 8 — Doom-стиль.
@export_range(1, 8) var direction_count := 1
@export var bounce_height := 0.12
@export var bounce_speed := 9.0

@onready var _sprite: Sprite3D = $Sprite3D

var hp := 0
var _gravity := float(ProjectSettings.get_setting("physics/3d/default_gravity"))
var _home := Vector3.ZERO
var _target := Vector3.ZERO
var _idle_left := 0.0
var _facing := Vector3.FORWARD
var _anim_time := 0.0
var _sprite_base_y := 0.0


func _ready() -> void:
	hp = max_hp
	_home = global_position
	_target = _home
	_idle_left = randf_range(idle_time_range.x, idle_time_range.y)
	_sprite_base_y = _sprite.position.y
	_anim_time = randf() * TAU


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= _gravity * delta
	_update_wander(delta)
	move_and_slide()
	_animate(delta)
	_update_direction_frame()


func _update_wander(delta: float) -> void:
	var to_target := _target - global_position
	to_target.y = 0.0
	if _idle_left > 0.0:
		_idle_left -= delta
		velocity.x = move_toward(velocity.x, 0.0, move_speed * 4.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, move_speed * 4.0 * delta)
		if _idle_left <= 0.0:
			var angle := randf() * TAU
			_target = _home + Vector3(cos(angle), 0.0, sin(angle)) * randf_range(1.0, wander_radius)
		return
	if to_target.length() < 0.3 or (is_on_wall() and get_real_velocity().length() < 0.1):
		_idle_left = randf_range(idle_time_range.x, idle_time_range.y)
		return
	_facing = to_target.normalized()
	velocity.x = _facing.x * move_speed
	velocity.z = _facing.z * move_speed


func _animate(delta: float) -> void:
	var moving := Vector2(velocity.x, velocity.z).length() > 0.1
	_anim_time += delta * (bounce_speed if moving else bounce_speed * 0.3)
	var wave := absf(sin(_anim_time))
	var height := bounce_height if moving else bounce_height * 0.2
	_sprite.position.y = _sprite_base_y + wave * height
	# Сплющивание у земли — «желейный» эффект.
	_sprite.scale = Vector3(1.0 + (1.0 - wave) * 0.08, 1.0 - (1.0 - wave) * 0.08, 1.0)


func _update_direction_frame() -> void:
	if direction_count <= 1:
		return
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		return
	var to_camera := camera.global_position - global_position
	to_camera.y = 0.0
	var angle := _facing.signed_angle_to(to_camera, Vector3.UP)
	_sprite.frame = wrapi(roundi(angle / TAU * direction_count), 0, direction_count)


# --- Взаимодействие (контракт для Player) ---

func get_interaction_label() -> String:
	return "Оценка" if SkillManager.has_skill(&"appraisal") else "Осмотреть"


func interact(_player: Node) -> void:
	if not SkillManager.has_skill(&"appraisal"):
		GameState.notify("Полупрозрачное существо. Кажется, это %s. Подробнее не понять." % display_name.to_lower())
		return
	var cost := SkillManager.get_skill(&"appraisal").mp_cost
	if not GameState.use_mp(cost):
		GameState.notify("[Система] Недостаточно маны для «Оценки».")
		return
	GameState.notify("[Оценка] %s   Ур. %d   HP %d/%d\n%s" % [display_name, level, hp, max_hp, appraisal_note])
