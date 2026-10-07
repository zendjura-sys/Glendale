extends Node
## Сквозной тест сюжета: грузовик -> Бог -> навыки -> лес -> хижина.
## Симулирует тапы и сенсорный джойстик.
##   godot --headless res://tests/flow_test.tscn

var _failures := 0


func _ready() -> void:
	# Узел-раннер вешаем в корень, чтобы он пережил смену сцен.
	var runner := Node.new()
	runner.set_script(get_script())
	runner.set_meta(&"runner", true)
	if not has_meta(&"runner"):
		get_tree().root.add_child.call_deferred(runner)
		return
	_run()


func _run() -> void:
	Engine.time_scale = 4.0
	if FileAccess.file_exists(GameState.SAVE_PATH):
		DirAccess.remove_absolute(GameState.SAVE_PATH)

	SceneManager.change_scene("res://scenes/story/truck_intro.tscn")
	await _wait_scene("TruckIntro")
	await _tap_through_dialogue()
	await _wait_scene("GodRoom")
	_check(GameState.flags.is_empty(), "флаги пусты до встречи с Богом")
	await _tap_through_dialogue()
	await _wait_scene("SkillSelect")
	_check(GameState.flags.get("met_god", false), "флаг встречи с Богом")

	var select := get_tree().current_scene
	_check(SkillManager.select_skill(&"appraisal"), "выбрана Оценка")
	_check(SkillManager.select_skill(&"mana_boost"), "выбрано Увеличение маны")
	select._confirm_dialog.confirmed.emit()
	await _wait_scene("Forest")
	_check(SkillManager.is_confirmed, "выбор навыков подтверждён")
	_check(GameState.stats.max_mp == 90, "бонус маны применён (90)")

	await get_tree().create_timer(6.0).timeout
	_check(GameState.is_quest_active(&"find_hut"), "задание «Найти хижину» выдано")

	var forest := get_tree().current_scene
	var player: Player = forest.get_node("Player")

	# Сенсорный джойстик: касание слева и тянем вверх.
	var start := player.global_position
	_touch(0, Vector2(200, 500), true)
	_drag(0, Vector2(200, 380), Vector2(0, -120))
	await get_tree().create_timer(1.5).timeout
	_check(Input.get_action_strength(&"move_forward") > 0.5, "джойстик нажимает move_forward")
	_check(player.global_position.distance_to(start) > 1.0, "игрок идёт от джойстика")
	_touch(0, Vector2(200, 380), false)
	await get_tree().physics_frame
	_check(Input.get_action_strength(&"move_forward") == 0.0, "отпускание джойстика останавливает")

	# Свайп справа вращает камеру.
	var yaw := player.rotation.y
	_touch(1, Vector2(900, 400), true)
	_drag(1, Vector2(800, 400), Vector2(-100, 0))
	_touch(1, Vector2(800, 400), false)
	_check(not is_equal_approx(player.rotation.y, yaw), "свайп вращает камеру")

	# Оценка слизи.
	var messages: Array[String] = []
	GameState.notification_posted.connect(func(t: String) -> void: messages.append(t))
	var slime := forest.get_node("Creatures/Slime1")
	slime.interact(player)
	_check(messages.size() > 0 and messages[-1].begins_with("[Оценка]"), "Оценка показывает статы слизи")

	# Кнопка «Система»: пауза и навыки.
	var system_button := player.get_node("UI/TouchControls/SystemAnchor/SystemButton")
	var window: SystemWindow = player.get_node("UI/SystemWindow")
	system_button.pressed.emit()
	_check(get_tree().paused and window.visible, "«Система» ставит на паузу и открывается")
	_check(window._skills_text.text.contains("Оценка"), "в окне видны выбранные навыки")
	_check(window._inventory_text.text.contains("Хлеб"), "в окне виден инвентарь")
	var action := InputEventAction.new()
	action.action = &"toggle_system"
	action.pressed = true
	get_viewport().push_input(action)
	await get_tree().process_frame
	_check(not get_tree().paused and not window.visible, "TAB закрывает окно и снимает паузу")

	# Дойти до хижины.
	var hut: Node3D = forest.get_node("AbandonedHut")
	player.global_position = hut.global_position + Vector3(0, 0.3, 0)
	await get_tree().create_timer(0.5).timeout
	_check(GameState.quests.get(&"find_hut") == "completed", "хижина найдена, задание выполнено")
	_check(GameState.has_save(), "игра сохранена в хижине")

	# Загрузка сохранения.
	SkillManager.reset_selection()
	var scene := GameState.load_game()
	_check(scene == "res://scenes/world/forest/forest.tscn", "сохранение помнит сцену")
	_check(SkillManager.has_skill(&"appraisal") and SkillManager.is_confirmed, "сохранение помнит навыки")

	print("Сквозной тест: %s" % ("OK" if _failures == 0 else "%d ошибок" % _failures))
	get_tree().quit(_failures)


func _wait_scene(scene_name: String) -> void:
	for i in 600:
		var current := get_tree().current_scene
		if current and current.name == scene_name and SceneManager._fade.modulate.a < 0.01:
			return
		await get_tree().process_frame
	_check(false, "не дождались сцены " + scene_name)


func _tap_through_dialogue() -> void:
	var box: DialogueBox = get_tree().current_scene.get_node("%DialogueBox")
	var taps := 0
	while box.visible and taps < 100:
		var click := InputEventMouseButton.new()
		click.button_index = MOUSE_BUTTON_LEFT
		click.pressed = true
		box._gui_input(click)
		taps += 1
		await get_tree().create_timer(0.05).timeout
	_check(taps < 100, "диалог пролистывается тапами")


func _touch(index: int, position: Vector2, pressed: bool) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = position
	event.pressed = pressed
	# true = координаты уже во viewport (в headless окно крошечное).
	get_viewport().push_input(event, true)


func _drag(index: int, position: Vector2, relative: Vector2) -> void:
	var event := InputEventScreenDrag.new()
	event.index = index
	event.position = position
	event.relative = relative
	get_viewport().push_input(event, true)


func _check(condition: bool, message: String) -> void:
	if condition:
		print("  ok   ", message)
	else:
		_failures += 1
		printerr("  FAIL ", message)
