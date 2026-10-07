## Катсцена случайной встречи с монстром: на время боя ставит поле на паузу
## (как обычный боевой триггер), а после боя сообщает итог «Системе» (опыт, приручение).
class_name RandomEncounter extends Cutscene

var monster_id := ""


func _execute() -> void:
	var data: Dictionary = BestiaryData.MONSTERS[monster_id]
	HeroSystem.begin_encounter(monster_id)
	FieldEvents.combat_triggered.emit(load(data.arena))
	var did_player_win: bool = await CombatEvents.combat_finished

	# Бой заканчивается затемнённым экраном — проявляем поле обратно.
	Transition.clear.call_deferred(0.2)
	await Transition.finished
	HeroSystem.finish_encounter(did_player_win)
