extends Node
## Скриншоты боёв с монстрами (нужен дисплей):
##   xvfb-run godot --rendering-driver opengl3 res://tests/monster_shots.tscn -- <папка> [id ...]


func _ready() -> void:
	if not has_meta(&"runner"):
		var runner := Node.new()
		runner.set_script(get_script())
		runner.set_meta(&"runner", true)
		get_tree().root.add_child.call_deferred(runner)
		return
	var args := OS.get_cmdline_user_args()
	var out: String = args[0] if not args.is_empty() else "user://shots"
	var monsters: Array = args.slice(1) if args.size() > 1 else ["griffin", "red_dragon"]
	DirAccess.make_dir_recursive_absolute(out)
	get_tree().change_scene_to_file("res://src/main.tscn")
	await _frames(60)
	while Dialogic.current_timeline != null:
		Dialogic.Inputs.handle_input()
		await _frames(10)
	await _frames(120)
	Encounters.enabled = false
	for monster_id: String in monsters:
		var arena: Node = load(BestiaryData.MONSTERS[monster_id].arena).instantiate()
		FieldEvents.combat_triggered.emit(load(BestiaryData.MONSTERS[monster_id].arena))
		arena.free()
		await _frames(400)
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(out.path_join("battle_%s.png" % monster_id))
		print("saved ", monster_id)
		break
	get_tree().quit()


func _frames(count: int) -> void:
	for i in count:
		await get_tree().process_frame
