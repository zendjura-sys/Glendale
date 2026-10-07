class_name SkillData
extends Resource
## Описание одного навыка. Сами навыки регистрируются в SkillManager.

enum Type { ACTIVE, PASSIVE }

@export var id: StringName
@export var display_name: String
@export_multiline var description: String
@export var type: Type = Type.ACTIVE
## Стоимость в очках перерождения.
@export_range(0, 10) var cost := 1
## Расход маны за использование (только для активных).
@export var mp_cost := 0
## Дар Бога: выдаётся бесплатно и не может быть убран.
@export var innate := false
## Бонусы к характеристикам для пассивных навыков, например {"max_mp": 30}.
@export var stat_bonuses: Dictionary = {}
@export var icon: Texture2D


func type_name() -> String:
	return "Активный" if type == Type.ACTIVE else "Пассивный"
