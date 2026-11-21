extends CanvasLayer
## Готовий HUD GameCon для Godot: «Увійти через GameCon» з кодом, капсула «друзі онлайн»
## і список друзів за F9. Додайте сцену з цим скриптом (CanvasLayer) у гру.

@export var presence := "У грі"
@export var toggle_action := "ui_gamecon"  ## або F9, якщо дії немає

var _panel: PanelContainer
var _label: Label
var _list: VBoxContainer
var _button: Button

func _ready() -> void:
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	box.position = Vector2(-300, 16)
	add_child(box)
	_button = Button.new()
	_button.text = "Увійти через GameCon"
	_button.pressed.connect(_on_button)
	box.add_child(_button)
	_label = Label.new()
	box.add_child(_label)
	_panel = PanelContainer.new()
	_panel.visible = false
	_list = VBoxContainer.new()
	_panel.add_child(_list)
	box.add_child(_panel)
	GameCon.signed_in.connect(_refresh)
	GameCon.login_code.connect(func(code): _label.text = "Відкрийте %s і введіть код: %s" % [code.get("verification_uri", ""), code.get("user_code", "")])
	var timer := Timer.new()
	timer.wait_time = 60
	timer.autostart = true
	timer.timeout.connect(_refresh)
	add_child(timer)
	_refresh()

func _unhandled_input(event: InputEvent) -> void:
	var toggle := InputMap.has_action(toggle_action) and event.is_action_pressed(toggle_action)
	if toggle or (event is InputEventKey and event.pressed and event.keycode == KEY_F9):
		_panel.visible = not _panel.visible

func _on_button() -> void:
	if GameCon.is_signed_in():
		_panel.visible = not _panel.visible
		return
	var code := await GameCon.start_device_login()
	OS.shell_open(code.get("verification_uri_complete", ""))
	if await GameCon.wait_for_login(code):
		_label.text = ""

func _refresh() -> void:
	if not GameCon.is_signed_in():
		return
	await GameCon.set_presence(presence)
	var friends := await GameCon.friends_online()
	var online := friends.filter(func(f): return f.get("online", false)).size()
	_button.text = "GameCon · друзі онлайн: %d" % online
	for child in _list.get_children():
		child.queue_free()
	for f in friends:
		var line := Label.new()
		var status: String = (f.get("presence") if f.get("presence") is Dictionary else {}).get("status", "")
		line.text = ("● " if f.get("online", false) else "○ ") + str(f.get("name", "")) + (" — " + status if status != "" else "")
		_list.add_child(line)
