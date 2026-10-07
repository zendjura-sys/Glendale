extends Node
## Синглтон навыков (Autoload «SkillManager»).
##
## Хранит словарь всех навыков игры, выбор игрока на экране перерождения
## и список навыков, которыми герой владеет в игровом мире.
## Сцены только вызывают методы и слушают сигналы — сама логика здесь.

signal selection_changed
signal selection_confirmed(skill_ids: Array[StringName])
signal skill_learned(skill: SkillData)

const REINCARNATION_POINTS := 10

## Все навыки игры: id -> SkillData.
var skills: Dictionary[StringName, SkillData] = {}
var total_points := REINCARNATION_POINTS
## true после подтверждения выбора: дальше навыки только изучаются в игре.
var is_confirmed := false

var _owned: Array[StringName] = []


func _ready() -> void:
	_register_skills()
	reset_selection()


func _register_skills() -> void:
	# --- Активные ---
	_add(&"appraisal", "Оценка", SkillData.Type.ACTIVE, 1,
		"Показывает имя, уровень и состояние существа или предмета, на который вы смотрите.",
		{mp_cost = 1})
	_add(&"item_box", "Хранилище", SkillData.Type.ACTIVE, 2,
		"Подпространственное хранилище для вещей. Расширяет инвентарь.",
		{stat_bonuses = {inventory_slots = 20}})
	_add(&"taming", "Приручение", SkillData.Type.ACTIVE, 3,
		"Позволяет заключить контракт со слабым монстром, например со слизью.",
		{mp_cost = 10})
	_add(&"fire_magic", "Магия огня", SkillData.Type.ACTIVE, 3,
		"Огненный шар. Наносит урон и поджигает цель.",
		{mp_cost = 8})
	_add(&"healing_magic", "Магия исцеления", SkillData.Type.ACTIVE, 3,
		"Восстанавливает здоровье себе или союзнику.",
		{mp_cost = 6})
	# --- Пассивные ---
	_add(&"language", "Понимание языков", SkillData.Type.PASSIVE, 0,
		"Дар Бога: вы понимаете речь и письменность нового мира.",
		{innate = true})
	_add(&"pain_resistance", "Сопротивление боли", SkillData.Type.PASSIVE, 2,
		"Боль почти не мешает действовать. Повышает запас здоровья.",
		{stat_bonuses = {max_hp = 30}})
	_add(&"poison_resistance", "Сопротивление ядам", SkillData.Type.PASSIVE, 1,
		"Защищает от ядов слабых монстров и несвежей еды.",
		{stat_bonuses = {vitality = 2}})
	_add(&"mana_boost", "Увеличение маны", SkillData.Type.PASSIVE, 2,
		"Запас маны заметно больше, чем у обычных людей.",
		{stat_bonuses = {max_mp = 40}})
	_add(&"stamina", "Выносливость", SkillData.Type.PASSIVE, 2,
		"Вы быстрее бегаете и дольше не устаёте.",
		{stat_bonuses = {agility = 3}})


func _add(id: StringName, display_name: String, type: SkillData.Type, cost: int,
		description: String, extra: Dictionary = {}) -> void:
	var skill := SkillData.new()
	skill.id = id
	skill.display_name = display_name
	skill.type = type
	skill.cost = cost
	skill.description = description
	for key: String in extra:
		skill.set(key, extra[key])
	skills[id] = skill


# --- Запросы ---

func get_skill(id: StringName) -> SkillData:
	return skills.get(id)


## Навыки одного типа: сначала дары Бога, затем по стоимости и названию.
func get_skills_by_type(type: SkillData.Type) -> Array[SkillData]:
	var result: Array[SkillData] = []
	for skill: SkillData in skills.values():
		if skill.type == type:
			result.append(skill)
	result.sort_custom(func(a: SkillData, b: SkillData) -> bool:
		if a.innate != b.innate:
			return a.innate
		if a.cost != b.cost:
			return a.cost < b.cost
		return a.display_name < b.display_name)
	return result


func get_owned_skills() -> Array[SkillData]:
	var result: Array[SkillData] = []
	for id in _owned:
		result.append(skills[id])
	return result


func has_skill(id: StringName) -> bool:
	return id in _owned


func is_selected(id: StringName) -> bool:
	return has_skill(id)


func get_spent_points() -> int:
	var spent := 0
	for id in _owned:
		if not skills[id].innate:
			spent += skills[id].cost
	return spent


func get_remaining_points() -> int:
	return total_points - get_spent_points()


func can_select(id: StringName) -> bool:
	var skill := get_skill(id)
	return skill != null and not is_confirmed and not has_skill(id) \
		and skill.cost <= get_remaining_points()


func can_deselect(id: StringName) -> bool:
	var skill := get_skill(id)
	return skill != null and not is_confirmed and has_skill(id) and not skill.innate


# --- Выбор при перерождении ---

func select_skill(id: StringName) -> bool:
	if not can_select(id):
		return false
	_owned.append(id)
	selection_changed.emit()
	return true


func deselect_skill(id: StringName) -> bool:
	if not can_deselect(id):
		return false
	_owned.erase(id)
	selection_changed.emit()
	return true


func toggle_skill(id: StringName) -> bool:
	return deselect_skill(id) if has_skill(id) else select_skill(id)


## Оставляет только дары Бога и возвращает все очки.
func reset_selection() -> void:
	is_confirmed = false
	_owned.clear()
	for skill: SkillData in skills.values():
		if skill.innate:
			_owned.append(skill.id)
	selection_changed.emit()


## Фиксирует выбор. После этого навыки нельзя вернуть за очки.
func confirm_selection() -> bool:
	if is_confirmed:
		return false
	is_confirmed = true
	selection_confirmed.emit(_owned.duplicate())
	return true


# --- Игровой мир ---

## Навык, полученный в игре (за квест, книгу, уровень). Очки не тратятся.
func learn_skill(id: StringName) -> bool:
	if not skills.has(id) or has_skill(id):
		return false
	_owned.append(id)
	skill_learned.emit(skills[id])
	return true


## Сумма бонусов всех пассивных навыков, например {"max_hp": 30, "max_mp": 40}.
func get_total_bonuses() -> Dictionary:
	var total := {}
	for id in _owned:
		var bonuses: Dictionary = skills[id].stat_bonuses
		for stat: String in bonuses:
			total[stat] = total.get(stat, 0) + bonuses[stat]
	return total


# --- Сохранение ---

func get_save_data() -> Dictionary:
	return {owned = Array(_owned).map(func(id: StringName) -> String: return String(id)),
		confirmed = is_confirmed}


func load_save_data(data: Dictionary) -> void:
	_owned.clear()
	for id: String in data.get("owned", []):
		if skills.has(StringName(id)):
			_owned.append(StringName(id))
	is_confirmed = data.get("confirmed", false)
	selection_changed.emit()
