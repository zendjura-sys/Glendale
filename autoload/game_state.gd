extends Node
## Синглтон состояния героя (Autoload «GameState»): характеристики,
## инвентарь, задания и сообщения Системы. Сохраняется в user://,
## что на Android — внутренняя папка приложения.

signal stats_changed
signal inventory_changed
signal quest_changed(quest_id: StringName)
signal notification_posted(text: String)

const SAVE_PATH := "user://save.json"
## Секунд на восстановление 1 MP (в игровом мире, не на паузе).
const MP_REGEN_INTERVAL := 2.0

const BASE_STATS := {
	max_hp = 100, max_mp = 50,
	strength = 5, agility = 5, intelligence = 5, vitality = 5,
	inventory_slots = 10,
}
const STAT_NAMES := {
	strength = "Сила", agility = "Ловкость", intelligence = "Интеллект", vitality = "Живучесть",
}
const ITEM_NAMES := {
	&"bread": "Хлеб",
	&"water_flask": "Фляга с водой",
	&"silver_coin": "Серебряная монета",
	&"slime_jelly": "Желе слизи",
	&"healing_herb": "Лечебная трава",
}
const QUESTS := {
	&"find_hut": {
		title = "Убежище в лесу",
		description = "Найти в лесу место, где можно переночевать. Говорят, где-то здесь стоит заброшенная хижина.",
	},
}

var hero_name := "Ямада Таро"
var level := 1
var experience := 0
var hp := 100
var mp := 50
## Итоговые характеристики = BASE_STATS + бонусы пассивных навыков.
var stats: Dictionary = {}
var inventory: Dictionary[StringName, int] = {}
## quest_id -> "active" | "completed"
var quests: Dictionary[StringName, String] = {}
## Произвольные сюжетные флаги: {"met_god": true}.
var flags: Dictionary = {}

var _mp_regen := 0.0


func _ready() -> void:
	SkillManager.selection_confirmed.connect(_on_skills_confirmed.unbind(1))
	SkillManager.skill_learned.connect(_on_skill_learned)
	new_game()


func _process(delta: float) -> void:
	if not SkillManager.is_confirmed or mp >= stats.max_mp:
		_mp_regen = 0.0
		return
	_mp_regen += delta
	if _mp_regen >= MP_REGEN_INTERVAL:
		_mp_regen -= MP_REGEN_INTERVAL
		mp += 1


func use_mp(amount: int) -> bool:
	if mp < amount:
		return false
	mp -= amount
	return true


func new_game() -> void:
	level = 1
	experience = 0
	inventory = {&"bread": 3, &"water_flask": 1, &"silver_coin": 10}
	quests.clear()
	flags.clear()
	recalculate_stats()
	hp = stats.max_hp
	mp = stats.max_mp


func recalculate_stats() -> void:
	stats = BASE_STATS.duplicate()
	var bonuses := SkillManager.get_total_bonuses()
	for stat: String in bonuses:
		stats[stat] = stats.get(stat, 0) + bonuses[stat]
	hp = mini(hp, stats.max_hp)
	mp = mini(mp, stats.max_mp)
	stats_changed.emit()


func exp_to_next_level() -> int:
	return 100 * level


func add_experience(amount: int) -> void:
	experience += amount
	while experience >= exp_to_next_level():
		experience -= exp_to_next_level()
		level += 1
		notify("[Система] Уровень повышен! Текущий уровень: %d" % level)
	stats_changed.emit()


# --- Инвентарь ---

func add_item(id: StringName, count := 1) -> void:
	inventory[id] = inventory.get(id, 0) + count
	notify("Получено: %s x%d" % [item_name(id), count])
	inventory_changed.emit()


func remove_item(id: StringName, count := 1) -> bool:
	if inventory.get(id, 0) < count:
		return false
	inventory[id] -= count
	if inventory[id] == 0:
		inventory.erase(id)
	inventory_changed.emit()
	return true


func item_name(id: StringName) -> String:
	return ITEM_NAMES.get(id, String(id))


# --- Задания ---

func start_quest(id: StringName) -> void:
	if quests.has(id):
		return
	quests[id] = "active"
	notify("[Новое задание] %s" % QUESTS[id].title)
	quest_changed.emit(id)


func complete_quest(id: StringName, exp_reward := 0) -> void:
	if quests.get(id) != "active":
		return
	quests[id] = "completed"
	notify("[Задание выполнено] %s" % QUESTS[id].title)
	quest_changed.emit(id)
	if exp_reward > 0:
		add_experience(exp_reward)


func is_quest_active(id: StringName) -> bool:
	return quests.get(id) == "active"


# --- Сообщения Системы ---

func notify(text: String) -> void:
	notification_posted.emit(text)


# --- Сохранение ---

func save_game() -> bool:
	var data := {
		hero_name = hero_name, level = level, experience = experience, hp = hp, mp = mp,
		inventory = _keys_to_strings(inventory), quests = _keys_to_strings(quests),
		flags = flags, skills = SkillManager.get_save_data(),
		scene = get_tree().current_scene.scene_file_path,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_error("Не удалось сохранить игру: %s" % error_string(FileAccess.get_open_error()))
		return false
	file.store_string(JSON.stringify(data, "\t"))
	return true


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


## Загружает данные и возвращает путь сцены, в которой сохранились (или "").
func load_game() -> String:
	if not has_save():
		return ""
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if not data is Dictionary:
		push_error("Файл сохранения повреждён")
		return ""
	SkillManager.load_save_data(data.get("skills", {}))
	hero_name = data.get("hero_name", hero_name)
	level = int(data.get("level", 1))
	experience = int(data.get("experience", 0))
	inventory.clear()
	for id: String in data.get("inventory", {}):
		inventory[StringName(id)] = int(data.inventory[id])
	quests.clear()
	for id: String in data.get("quests", {}):
		quests[StringName(id)] = data.quests[id]
	flags = data.get("flags", {})
	recalculate_stats()
	hp = int(data.get("hp", stats.max_hp))
	mp = int(data.get("mp", stats.max_mp))
	inventory_changed.emit()
	return data.get("scene", "")


func _keys_to_strings(source: Dictionary) -> Dictionary:
	var result := {}
	for key: Variant in source:
		result[String(key)] = source[key]
	return result


func _on_skills_confirmed() -> void:
	recalculate_stats()
	hp = stats.max_hp
	mp = stats.max_mp


func _on_skill_learned(skill: SkillData) -> void:
	notify("[Система] Получен навык: %s" % skill.display_name)
	recalculate_stats()
