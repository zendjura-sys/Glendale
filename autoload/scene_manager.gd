extends CanvasLayer
## Синглтон переходов между сценами (Autoload «SceneManager»)
## с затемнением экрана.

signal transition_finished(path: String)

var _fade := ColorRect.new()
var _busy := false


func _ready() -> void:
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS
	_fade.color = Color.BLACK
	_fade.modulate.a = 0.0
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fade)


func change_scene(path: String, fade_time := 0.5) -> void:
	if _busy:
		return
	_busy = true
	_fade.mouse_filter = Control.MOUSE_FILTER_STOP
	await fade_to_black(fade_time)
	get_tree().paused = false
	var error := get_tree().change_scene_to_file(path)
	if error != OK:
		push_error("Не удалось открыть сцену %s: %s" % [path, error_string(error)])
	# Даём новой сцене выполнить _ready() до того, как экран посветлеет.
	await get_tree().process_frame
	await get_tree().process_frame
	await fade_from_black(fade_time)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_busy = false
	transition_finished.emit(path)


func fade_to_black(duration := 0.5) -> void:
	var tween := create_tween()
	tween.tween_property(_fade, "modulate:a", 1.0, duration)
	await tween.finished


func fade_from_black(duration := 0.5) -> void:
	var tween := create_tween()
	tween.tween_property(_fade, "modulate:a", 0.0, duration)
	await tween.finished
