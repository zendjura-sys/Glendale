extends Node
## Снимает скриншоты ключевых экранов (нужен дисплей, например xvfb-run):
##   xvfb-run godot --rendering-driver opengl3 res://tests/screenshots.tscn -- <папка>

var _out := "user://screenshots"


func _ready() -> void:
	if not has_meta(&"runner"):
		var runner := Node.new()
		runner.set_script(get_script())
		runner.set_meta(&"runner", true)
		get_tree().root.add_child.call_deferred(runner)
		return
	var args := OS.get_cmdline_user_args()
	if not args.is_empty():
		_out = args[0]
	DirAccess.make_dir_recursive_absolute(_out)
	_run()


func _run() -> void:
	get_tree().change_scene_to_file("res://src/main.tscn")
	await _wait_until(func() -> bool: return Dialogic.current_timeline != null)
	# Листаем до первой реплики героя (там виден аниме-портрет).
	for i in 3:
		await _frames(30)
		Dialogic.Inputs.handle_input()
		await _frames(30)
		Dialogic.Inputs.handle_input()
	await _frames(90)
	await _shot("1_dialogue_hero")
	# Пролистываем до сообщений Системы.
	for i in 30:
		if Dialogic.current_timeline == null:
			break
		var labels := get_tree().root.find_children("DialogueText", "RichTextLabel", true, false)
		if not labels.is_empty() and labels[0].text.contains("Обнаружено"):
			await _frames(90)
			await _shot("2_dialogue_system")
			break
		Dialogic.Inputs.handle_input()
		await _frames(25)
	while Dialogic.current_timeline != null:
		Dialogic.Inputs.handle_input()
		await _frames(15)
	await _frames(200)
	await _shot("3_town")
	var menu: SystemMenu = get_tree().current_scene.get_node("SystemMenu")
	menu.open()
	await _frames(10)
	await _shot("4_system_menu")
	menu._tabs.current_tab = 3
	await _frames(10)
	await _shot("5_system_quests")
	menu.close()
	Dialogic.start_timeline(load("res://overworld/maps/town/fan_of_four.dtl"))
	await _frames(150)
	await _shot("6_dialogue_fan")
	while Dialogic.current_timeline != null:
		Dialogic.Inputs.handle_input()
		await _frames(15)
	FieldEvents.combat_triggered.emit(load("res://overworld/maps/town/battles/test_combat_arena.tscn"))
	await _frames(400)
	await _shot("7_combat")
	get_tree().quit()


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var path := _out.path_join(name + ".png")
	get_viewport().get_texture().get_image().save_png(path)
	print("saved ", path)


func _wait_until(condition: Callable) -> void:
	for i in 600:
		if condition.call():
			return
		await get_tree().process_frame


func _frames(count: int) -> void:
	for i in count:
		await get_tree().process_frame
