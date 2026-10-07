extends SceneTree
## Тесты логики SkillManager без запуска игры:
##   godot --headless --script res://tests/test_skill_manager.gd

var _failures := 0


func _init() -> void:
	var sm: Node = load("res://autoload/skill_manager.gd").new()
	sm._ready()

	_check(sm.has_skill(&"language"), "дар Бога выдан сразу")
	_check(sm.get_remaining_points() == 10, "в начале 10 очков")
	_check(not sm.deselect_skill(&"language"), "дар Бога нельзя убрать")

	_check(sm.select_skill(&"appraisal"), "можно взять Оценку")
	_check(sm.get_remaining_points() == 9, "Оценка списала 1 очко")
	_check(not sm.select_skill(&"appraisal"), "нельзя взять навык дважды")

	sm.select_skill(&"fire_magic")
	sm.select_skill(&"taming")
	_check(sm.get_remaining_points() == 3, "осталось 3 очка")
	_check(not sm.select_skill(&"healing_magic") or sm.get_remaining_points() == 0,
		"нельзя уйти в минус")
	_check(sm.get_remaining_points() >= 0, "очки не отрицательные")

	_check(sm.toggle_skill(&"taming"), "toggle снимает навык")
	_check(not sm.has_skill(&"taming"), "Приручение снято")

	sm.select_skill(&"mana_boost")
	_check(sm.get_total_bonuses().get("max_mp") == 40, "бонус маны посчитан")

	var save: Dictionary = sm.get_save_data()
	_check(sm.confirm_selection(), "выбор подтверждён")
	_check(not sm.select_skill(&"stamina"), "после подтверждения выбирать нельзя")
	_check(sm.learn_skill(&"stamina"), "в игре навык можно изучить")

	sm.reset_selection()
	sm.load_save_data(save)
	_check(sm.has_skill(&"mana_boost") and sm.has_skill(&"appraisal"), "загрузка восстановила навыки")

	sm.free()
	print("SkillManager: %s" % ("OK" if _failures == 0 else "%d ошибок" % _failures))
	quit(_failures)


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures += 1
		printerr("FAIL: ", message)
