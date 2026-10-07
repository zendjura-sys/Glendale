## Случайные встречи с монстрами (Autoload «Encounters»).
##
## Пока игрок ходит по карте, после нескольких безопасных клеток каждая следующая
## клетка с шансом STEP_CHANCE вызывает бой с монстром, подходящим по уровню героя.
## Встречи включаются после вступления и не случаются во время диалогов и катсцен.
extends Node

const STEP_CHANCE := 0.06
const SAFE_STEPS := 8

## Встречи можно выключить, например в городе или для тестов.
var enabled := false

var rng := RandomNumberGenerator.new()
var _steps := 0
var _gamepiece: Gamepiece
var _last_cell := Vector2i.ZERO


func _ready() -> void:
	rng.randomize()
	Player.gamepiece_changed.connect(_on_gamepiece_changed)
	_connect_dialogic.call_deferred()


func _connect_dialogic() -> void:
	Dialogic.signal_event.connect(func(argument: Variant) -> void:
		if str(argument) == "opening_finished":
			enabled = true)


## Выбирает монстра: чем ближе его уровень к уровню героя, тем чаще он встречается.
## Дракон появляется только у опытных героев.
func pick_monster() -> String:
	var hero_level: int = HeroSystem.level
	var candidates: Array[String] = []
	var weights: Array[float] = []
	for monster_id: String in BestiaryData.MONSTERS:
		var monster: Dictionary = BestiaryData.MONSTERS[monster_id]
		if monster.level > hero_level + 2:
			continue
		if monster_id == "red_dragon" and hero_level < 6:
			continue
		candidates.append(monster_id)
		weights.append(1.0 / (1.0 + absf(monster.level - hero_level)))
	return candidates[rng.rand_weighted(PackedFloat32Array(weights))]


func start_encounter(monster_id: String) -> void:
	_steps = 0
	var encounter := RandomEncounter.new()
	encounter.monster_id = monster_id
	get_tree().current_scene.add_child(encounter)
	await encounter.run()
	encounter.queue_free()


func _on_gamepiece_changed() -> void:
	if _gamepiece and _gamepiece.arrived.is_connected(_on_arrived):
		_gamepiece.arrived.disconnect(_on_arrived)
	_gamepiece = Player.gamepiece
	if _gamepiece:
		_last_cell = Gameboard.pixel_to_cell(_gamepiece.position)
		_gamepiece.arrived.connect(_on_arrived)


func _on_arrived() -> void:
	var cell := Gameboard.pixel_to_cell(_gamepiece.position)
	var walked: int = absi(cell.x - _last_cell.x) + absi(cell.y - _last_cell.y)
	_last_cell = cell
	if not enabled or walked == 0 or Cutscene.is_cutscene_in_progress() \
			or Dialogic.current_timeline != null or get_tree().paused:
		return
	for i in walked:
		_steps += 1
		if _steps > SAFE_STEPS and rng.randf() < STEP_CHANCE:
			start_encounter.call_deferred(pick_monster())
			return
