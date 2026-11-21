@tool
extends EditorPlugin

# Додає автозавантаження GameCon (res://addons/gamecon/gamecon.gd) при ввімкненні плагіна.
func _enter_tree() -> void:
	add_autoload_singleton("GameCon", "res://addons/gamecon/gamecon.gd")

func _exit_tree() -> void:
	remove_autoload_singleton("GameCon")
