extends Node
## GameCon SDK для Godot 4: вхід кодом пристрою (RFC 8628) — гравець вводить код на
## gamecon.online/link з телефона. Публічний клієнт, без секрету. Токени — у user://gamecon.cfg.
##
##   GameCon.client_id = "CLIENT_ID"
##   var code = await GameCon.start_device_login()   # покажіть code.user_code і code.verification_uri
##   await GameCon.wait_for_login(code)
##   var friends = await GameCon.friends_online()

signal signed_in
signal signed_out
signal login_code(code: Dictionary)

@export var client_id := ""
@export var base_url := "https://gamecon.online"
@export var scope := "profile friends presence invites achievements"

const STORE := "user://gamecon.cfg"
var _access := ""
var _refresh := ""
var _expires := 0

func _ready() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(STORE) == OK:
		_access = cfg.get_value("auth", "access", "")
		_refresh = cfg.get_value("auth", "refresh", "")
		_expires = cfg.get_value("auth", "expires", 0)

func is_signed_in() -> bool:
	return _refresh != "" or _access != ""

func access_token() -> String:
	return _access

## Крок 1: код для гравця.
func start_device_login() -> Dictionary:
	var res := await _request(HTTPClient.METHOD_POST, "/oauth/device", _form({"client_id": client_id, "scope": scope}), false)
	var code: Dictionary = res.body
	login_code.emit(code)
	return code

## Крок 2: чекати підтвердження (опитування з інтервалом сервера). true — увійшли.
func wait_for_login(code: Dictionary) -> bool:
	var interval: int = max(5, int(code.get("interval", 5)))
	var deadline := Time.get_unix_time_from_system() + float(code.get("expires_in", 600))
	while Time.get_unix_time_from_system() < deadline:
		await get_tree().create_timer(interval).timeout
		var res := await _request(HTTPClient.METHOD_POST, "/oauth/token", _form({
			"grant_type": "urn:ietf:params:oauth:grant-type:device_code",
			"device_code": code.get("device_code", ""),
			"client_id": client_id,
		}), false)
		var error: String = res.body.get("error", "")
		if error == "authorization_pending":
			continue
		if error == "slow_down":
			interval += 5
			continue
		if error != "":
			push_warning("GameCon: " + str(res.body.get("error_description", error)))
			return false
		_save(res.body)
		signed_in.emit()
		return true
	return false

func sign_out() -> void:
	_access = ""
	_refresh = ""
	_expires = 0
	DirAccess.remove_absolute(ProjectSettings.globalize_path(STORE))
	signed_out.emit()

# ——— API (/api/developer/v1) ———
func me() -> Dictionary:
	return (await api(HTTPClient.METHOD_GET, "/me")).get("data", {})

func friends_online() -> Array:
	return (await api(HTTPClient.METHOD_GET, "/friends/online")).get("data", [])

## «В матчі · Dust2» — бачать друзі. Оновлюйте раз на кілька хвилин.
func set_presence(status: String, lobby := "") -> void:
	await api(HTTPClient.METHOD_PUT, "/presence", {"status": status, "lobby": lobby if lobby != "" else null})

func invite(username: String, lobby: String) -> void:
	await api(HTTPClient.METHOD_POST, "/invites", {"username": username, "lobby": lobby})

func unlock_achievement(key: String) -> void:
	await api(HTTPClient.METHOD_POST, "/achievements/%s/unlock" % key.uri_encode(), {})

func submit_score(board: String, score: int) -> void:
	await api(HTTPClient.METHOD_POST, "/leaderboards/%s/scores" % board.uri_encode(), {"score": score})

## Будь-який метод API (чат, голос, групи, музика). Повертає розібраний JSON.
func api(method: int, path: String, json = null) -> Dictionary:
	if not await _ensure_fresh():
		return {}
	var res := await _request(method, "/api/developer/v1" + path, JSON.stringify(json) if json != null else "", true)
	return res.body if res.body is Dictionary else {}

## Повний оверлей GameCon для вбудованого браузера (якщо у вашій грі є WebView/CEF).
func overlay_url(modules := "hud,party,chat,drop") -> String:
	return "%s/embed/overlay?client_id=%s&modules=%s&token=%s" % [base_url, client_id.uri_encode(), modules, _access.uri_encode()]

# ——— Внутрішнє ———
func _ensure_fresh() -> bool:
	if not is_signed_in():
		push_warning("GameCon: спершу увійдіть.")
		return false
	if Time.get_unix_time_from_system() < _expires - 60:
		return true
	var res := await _request(HTTPClient.METHOD_POST, "/oauth/token", _form({"grant_type": "refresh_token", "refresh_token": _refresh, "client_id": client_id}), false)
	if res.body.get("error", "") != "":
		sign_out()
		return false
	_save(res.body)
	return true

func _save(tokens: Dictionary) -> void:
	_access = tokens.get("access_token", "")
	_refresh = tokens.get("refresh_token", _refresh)
	_expires = int(Time.get_unix_time_from_system()) + int(tokens.get("expires_in", 3600))
	var cfg := ConfigFile.new()
	cfg.set_value("auth", "access", _access)
	cfg.set_value("auth", "refresh", _refresh)
	cfg.set_value("auth", "expires", _expires)
	cfg.save(STORE)

func _form(fields: Dictionary) -> String:
	var parts := PackedStringArray()
	for key in fields:
		parts.append("%s=%s" % [key, str(fields[key]).uri_encode()])
	return "&".join(parts)

func _request(method: int, path: String, body: String, json: bool) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)
	var headers := PackedStringArray(["Accept: application/json"])
	headers.append("Content-Type: application/json" if json else "Content-Type: application/x-www-form-urlencoded")
	if json and _access != "":
		headers.append("Authorization: Bearer " + _access)
	http.request(base_url + path, headers, method, body)
	var result: Array = await http.request_completed
	http.queue_free()
	var parsed = JSON.parse_string((result[3] as PackedByteArray).get_string_from_utf8())
	return {"status": result[1], "body": parsed if parsed is Dictionary else {}}
