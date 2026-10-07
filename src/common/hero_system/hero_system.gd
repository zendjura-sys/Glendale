## «Система» LitRPG (Autoload HeroSystem): уровень и опыт героя, задания
## и всплывающие системные сообщения в духе исекая.
##
## Слушает сигналы Dialogic ([signal arg="..."] в таймлайнах) и итоги боёв,
## поэтому сюжетные события сами превращаются в уведомления и опыт.
extends CanvasLayer

signal experience_changed
signal message_posted(text: String)

const HERO_NAME := "Рэн Кагами"
const MESSAGE_LIFETIME := 4.0
const MAX_MESSAGES := 4

## Опыт за события сюжета, по аргументу сигнала Dialogic.
const STORY_EXPERIENCE := {
	"ClearPath": 10,
	"bug_fixed": 30,
	"quest_tokens_finished": 50,
}

var level := 1
var experience := 0
## Бестиарий: id монстра -> {seen, defeated, tamed}.
var bestiary := {}
## Фамильяры героя. Капля присоединяется во вступлении.
var familiars: Array[String] = ["Капля"]
## Монстр текущей случайной встречи ("" — обычный бой).
var current_encounter := ""
var rng := RandomNumberGenerator.new()

var _messages: VBoxContainer


func _ready() -> void:
	layer = 90
	process_mode = Node.PROCESS_MODE_ALWAYS
	rng.randomize()
	_build_message_feed()
	# Dialogic — автозагрузка, объявленная раньше, но подключаемся отложенно,
	# чтобы не зависеть от порядка инициализации.
	_connect_signals.call_deferred()


func _connect_signals() -> void:
	Dialogic.signal_event.connect(_on_dialogic_signal)
	CombatEvents.combat_finished.connect(_on_combat_finished)


func experience_to_next_level() -> int:
	return 100 * level


func add_experience(amount: int) -> void:
	if amount <= 0:
		return
	experience += amount
	notify("Получено опыта: %d" % amount)
	while experience >= experience_to_next_level():
		experience -= experience_to_next_level()
		level += 1
		notify("[Система] Уровень повышен! Текущий уровень: %d" % level)
	experience_changed.emit()


## Показывает системное сообщение в верхней части экрана.
func notify(text: String) -> void:
	while _messages.get_child_count() >= MAX_MESSAGES:
		_messages.get_child(0).free()
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", 44)
	label.add_theme_color_override("font_color", Color("cfeaff"))
	label.add_theme_color_override("font_outline_color", Color("0b1630"))
	label.add_theme_constant_override("outline_size", 16)
	_messages.add_child(label)
	var tween := label.create_tween()
	tween.tween_interval(MESSAGE_LIFETIME)
	tween.tween_property(label, "modulate:a", 0.0, 0.6)
	tween.tween_callback(label.queue_free)
	message_posted.emit(text)


func _build_message_feed() -> void:
	_messages = VBoxContainer.new()
	_messages.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_messages.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_messages.offset_left = -700
	_messages.offset_right = 700
	_messages.offset_top = 40
	_messages.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_messages.add_theme_constant_override("separation", 8)
	add_child(_messages)


func _on_dialogic_signal(argument: Variant) -> void:
	match str(argument):
		"opening_finished":
			notify("[Новое задание] Найти голос, зовущий из леса")
		"coin_received":
			notify("Получено: Жетон гильдии")
		"quest_tokens_started":
			notify("[Новое задание] Автографы для Мими: собрать жетоны Четвёрки (0/4)")
		"quest_tokens_finished":
			notify("[Задание выполнено] Автографы для Мими")
		"GiveWand":
			notify("Получено: Волшебный жезл")
		"ClearPath":
			notify("[Отладка] Обход найден!")
		"bug_fixed":
			notify("[Система] Баг исправлен!")
	add_experience(STORY_EXPERIENCE.get(str(argument), 0))


func _on_combat_finished(is_player_victory: bool) -> void:
	# Опыт за случайные встречи начисляет finish_encounter().
	if is_player_victory and current_encounter.is_empty():
		add_experience(40)


# --- Бестиарий и приручение ---

func monster_record(monster_id: String) -> Dictionary:
	if not bestiary.has(monster_id):
		bestiary[monster_id] = {seen = false, defeated = 0, tamed = false}
	return bestiary[monster_id]


func begin_encounter(monster_id: String) -> void:
	current_encounter = monster_id
	var data: Dictionary = BestiaryData.MONSTERS[monster_id]
	var record := monster_record(monster_id)
	if not record.seen:
		record.seen = true
		notify("[Бестиарий] Новый монстр: %s" % data.name)
	notify("[Система] На вас напал: %s (ур. %d)" % [data.name, data.level])


## Итог встречи. roll — для тестов: готовое значение броска приручения (0..1).
func finish_encounter(is_player_victory: bool, roll := -1.0) -> bool:
	var monster_id := current_encounter
	current_encounter = ""
	if monster_id.is_empty():
		return false
	var data: Dictionary = BestiaryData.MONSTERS[monster_id]
	if not is_player_victory:
		notify("[Система] Отряд отступил и восстановил силы.")
		return false
	var record := monster_record(monster_id)
	record.defeated += 1
	add_experience(20 * data.level)
	return _try_tame(monster_id, roll)


func _try_tame(monster_id: String, roll: float) -> bool:
	var data: Dictionary = BestiaryData.MONSTERS[monster_id]
	var record := monster_record(monster_id)
	if data.tame <= 0.0 or record.tamed:
		return false
	if roll < 0.0:
		roll = rng.randf()
	if roll < data.tame:
		record.tamed = true
		familiars.append(data.name)
		notify("[Приручение] %s признал вас хозяином! Новый фамильяр." % data.name)
		return true
	notify("%s не захотел идти с вами. Шанс приручения: %d%%" % [data.name, roundi(data.tame * 100)])
	return false
