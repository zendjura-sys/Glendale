extends Node
## Сквозной тест: вступление -> «Система» -> диалоги квеста -> бой с выбором цели тапом.
##   godot --headless res://tests/flow_test.tscn

const MAIN_SCENE := "res://src/main.tscn"
const TIMELINES := "res://overworld/maps/"

var _failures := 0
var _messages: Array[String] = []


func _ready() -> void:
	# Раннер вешается в корень, чтобы пережить смену сцены.
	if not has_meta(&"runner"):
		var runner := Node.new()
		runner.set_script(get_script())
		runner.set_meta(&"runner", true)
		get_tree().root.add_child.call_deferred(runner)
		return
	_run()


func _run() -> void:
	HeroSystem.message_posted.connect(func(text: String) -> void: _messages.append(text))
	get_tree().change_scene_to_file(MAIN_SCENE)

	# 1. Вступление.
	await _wait_until(func() -> bool: return Dialogic.current_timeline != null, 600)
	_check(Dialogic.current_timeline != null, "вступление запустилось")
	await _advance_dialogue()
	_check(_messages.any(func(m: String) -> bool: return m.contains("Найти голос")), "Система выдала задание после вступления")
	await _wait_frames(240)

	# 2. Меню «Система».
	var menu: SystemMenu = get_tree().current_scene.get_node("SystemMenu")
	_check(menu._open_button.visible, "кнопка «Система» видна после вступления")
	menu._open_button.pressed.emit()
	_check(menu.is_open() and get_tree().paused, "«Система» открылась и поставила игру на паузу")
	_check(menu._status_text.text.contains("Рэн Кагами"), "во вкладке «Статус» есть герой")
	_check(menu._skills_text.text.contains("Отладка"), "во вкладке «Навыки» есть Отладка")
	menu._close_button.pressed.emit()
	_check(not menu.is_open() and not get_tree().paused, "«Закрыть» снимает паузу")

	# 3. Все диалоги квеста с жетонами.
	await _play("town/fan_of_four.dtl")
	_check(int(Dialogic.VAR.get_variable("{TokenQuestStatus}")) == 1, "квест Мими начат")
	for npc in ["warrior", "thief", "monk", "wizard"]:
		await _play("town/%s.dtl" % npc)
	_check(int(Dialogic.VAR.get_variable("{TokenCount}")) == 4, "собраны 4 жетона")
	var level_before := HeroSystem.level * 1000 + HeroSystem.experience
	await _play("town/fan_of_four.dtl")
	_check(int(Dialogic.VAR.get_variable("{TokenQuestStatus}")) == 3, "квест Мими выполнен")
	_check(HeroSystem.level * 1000 + HeroSystem.experience > level_before, "за квест начислен опыт")
	for path in ["town/runner.dtl", "town/runner.dtl", "town/smith.dtl", "town/sign.dtl",
			"town/strange_tree.dtl", "town/strange_tree.dtl", "town/encounter_before_combat.dtl",
			"town/encounter_on_victory.dtl", "town/encounter_on_loss.dtl",
			"house/wand_pedestal.dtl", "house/wand_pedestal_occupied.dtl", "forest/ghost.dtl"]:
		await _play(path)
	_check(_messages.any(func(m: String) -> bool: return m.contains("Обход найден")), "Отладка нашла обход у дерева")

	# 4. Бой: выбор действия и цели тапами.
	FieldEvents.combat_triggered.emit(load("res://overworld/maps/town/battles/test_combat_arena.tscn"))
	var menu_node: UIActionMenu = null
	for i in 900:
		var found := get_tree().root.find_children("*", "UIActionMenu", true, false)
		if not found.is_empty() and found[0].get_child_count() > 0:
			menu_node = found[0]
			break
		await get_tree().process_frame
	_check(menu_node != null, "в бою появилось меню действий")
	if menu_node:
		var names: Array[String] = []
		for button in menu_node.find_children("*", "UIActionButton", true, false):
			names.append(button.action.name)
		_check("Мощный удар" in names, "приёмы переведены (%s)" % ", ".join(names))
		# Выбираем «Мощный удар» — он бьёт одного врага.
		for button in menu_node.find_children("*", "UIActionButton", true, false):
			if button.action.name == "Мощный удар":
				button.pressed.emit()
		var cursor: UIBattlerTargetingCursor = null
		for i in 300:
			var found := get_tree().root.find_children("*", "UIBattlerTargetingCursor", true, false)
			if not found.is_empty():
				cursor = found[0]
				break
			await get_tree().process_frame
		_check(cursor != null, "появился курсор выбора цели")
		if cursor:
			var picked: Array = []
			cursor.targets_selected.connect(func(t: Array[Battler]) -> void: picked.assign(t))
			var other: Battler = cursor.targets[-1]
			_check(other != cursor._current_target, "есть другая цель для тапа")
			_tap_battler(other)
			await get_tree().process_frame
			_check(cursor._current_target == other and picked.is_empty(), "первый тап выбирает цель")
			_tap_battler(other)
			await get_tree().process_frame
			_check(picked.size() == 1 and picked[0] == other, "второй тап подтверждает цель")

	print("Сквозной тест: %s" % ("OK" if _failures == 0 else "%d ошибок" % _failures))
	get_tree().quit(_failures)


func _play(path: String) -> void:
	# Шаблон использует собственный layout в main.tscn, поэтому start_timeline, а не start.
	Dialogic.start_timeline(load(TIMELINES + path))
	await _advance_dialogue()


## Листает диалог, как будто игрок тапает по экрану. В выборе жмёт последний вариант.
func _advance_dialogue() -> void:
	for i in 400:
		if Dialogic.current_timeline == null:
			return
		var choices := get_tree().root.find_children("*", "DialogicNode_ChoiceButton", true, false) \
			.filter(func(b: Button) -> bool: return b.is_visible_in_tree())
		if not choices.is_empty():
			# Настоящий тап вызывает Button._pressed(), который испускает choice_selected.
			choices[-1].choice_selected.emit()
		else:
			Dialogic.Inputs.handle_input()
		await _wait_frames(12)
	_check(false, "диалог не закончился: %s" % Dialogic.current_timeline)


func _tap_battler(battler: Battler) -> void:
	var feet := battler.get_global_transform_with_canvas().origin
	var top := battler.anim.top.get_global_transform_with_canvas().origin
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = false
	event.position = (feet + top) / 2.0
	get_viewport().push_input(event, true)


func _wait_until(condition: Callable, frames: int) -> void:
	for i in frames:
		if condition.call():
			return
		await get_tree().process_frame


func _wait_frames(frames: int) -> void:
	for i in frames:
		await get_tree().process_frame


func _check(condition: bool, message: String) -> void:
	if condition:
		print("  ok   ", message)
	else:
		_failures += 1
		printerr("  FAIL ", message)
