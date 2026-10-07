extends Node
## Скриншоты реплик с эмоциями (нужен дисплей):
##   xvfb-run godot --rendering-driver opengl3 res://tests/expression_shots.tscn -- <папка>

const SHOTS := [
	["town/strange_tree.dtl", 0, "ren_default"],
	["town/strange_tree.dtl", 0, "ren_debug"],
]


func _ready() -> void:
	if not has_meta(&"runner"):
		var runner := Node.new()
		runner.set_script(get_script())
		runner.set_meta(&"runner", true)
		get_tree().root.add_child.call_deferred(runner)
		return
	var out: String = OS.get_cmdline_user_args()[0] if not OS.get_cmdline_user_args().is_empty() else "user://shots"
	DirAccess.make_dir_recursive_absolute(out)
	get_tree().change_scene_to_file("res://src/main.tscn")
	await _frames(60)
	# Пропускаем вступление.
	while Dialogic.current_timeline != null:
		Dialogic.Inputs.handle_input()
		await _frames(10)
	await _frames(120)
	for shot in SHOTS:
		Dialogic.start_timeline(load("res://overworld/maps/" + shot[0]))
		await _frames(20)
		for i in shot[1] * 2:
			Dialogic.Inputs.handle_input()
			await _frames(20)
		await _frames(150)
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(out.path_join(shot[2] + ".png"))
		print("saved ", shot[2])
		while Dialogic.current_timeline != null:
			Dialogic.Inputs.handle_input()
			await _frames(10)
	get_tree().quit()


func _frames(count: int) -> void:
	for i in count:
		await get_tree().process_frame
