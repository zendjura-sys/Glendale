//! GameCon для Windows (№261) на Rust + Tauri 2: сайт у власному вікні, значок у треї й
//! оверлей тривог поверх ігор.
//!
//! Оверлей — маленьке прозоре вікно «завжди згори» в правому верхньому куті. Усередині — сторінка
//! сайту /desktop/overlay: вона з cookie входу сама опитує /alerts/state, малює картку з кнопками
//! «Я в укритті» й «Мапа» і повідомляє застосунку стан (`alert_changed`). Застосунок за логікою
//! з `gamecon-core` показує/ховає вікно й надсилає сповіщення Windows.
//! Видно в іграх у віконному й безрамковому режимах; в ексклюзивному повноекранному Windows
//! малювати поверх гри не дає — тоді лишається сповіщення.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use gamecon_core::{display_version, notification, transition, AlertState, Settings};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_notification::NotificationExt;

const SITE: &str = "https://gamecon.online";

/// Стан застосунку: остання тривога й налаштування з трею.
struct AppState {
    alert: Mutex<Option<String>>,
    settings: Mutex<Settings>,
}

fn settings_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("settings.json"))
}

fn load_settings(app: &AppHandle) -> Settings {
    settings_path(app).and_then(|path| std::fs::read_to_string(path).ok()).map(|json| Settings::parse(&json)).unwrap_or_default()
}

fn save_settings(app: &AppHandle, settings: Settings) {
    if let Some(path) = settings_path(app) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(path, settings.to_json());
    }
}

/// Сторінка оверлею повідомляє поточний стан тривоги (раз на опитування).
#[tauri::command]
fn alert_changed(app: AppHandle, state: tauri::State<'_, AppState>, alert: AlertState) -> bool {
    let settings = *state.settings.lock().unwrap();
    let change = {
        let mut current = state.alert.lock().unwrap();
        let change = transition(current.as_deref(), alert.key.as_deref());
        *current = alert.key.clone();
        change
    };
    if let Some((title, body)) = notification(change, &alert) {
        let _ = app.notification().builder().title(title).body(body).show();
    }
    if let Some(overlay) = app.get_webview_window("overlay") {
        if alert.key.is_some() && settings.overlay {
            let _ = overlay.show();
        } else {
            let _ = overlay.hide();
        }
    }
    // Звук — лише на початку тривоги й лише якщо ввімкнено (грає сама сторінка).
    matches!(change, gamecon_core::Transition::Started) && settings.sound
}

/// Кнопка «Мапа» в оверлеї: відкрити мапу тривог у головному вікні.
#[tauri::command]
fn open_main(app: AppHandle) {
    show_main(&app, Some("/alerts"));
}

fn show_main(app: &AppHandle, route: Option<&str>) {
    if let Some(main) = app.get_webview_window("main") {
        if let Some(route) = route {
            if let Ok(url) = format!("{SITE}{route}").parse() {
                let _ = main.navigate(url);
            }
        }
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
}

/// Оверлей — у правий верхній кут робочої області основного монітора.
fn place_overlay(app: &AppHandle) {
    let Some(overlay) = app.get_webview_window("overlay") else { return };
    if let (Ok(Some(monitor)), Ok(size)) = (overlay.primary_monitor(), overlay.outer_size()) {
        let area = monitor.size();
        let pos = monitor.position();
        let margin = (16.0 * monitor.scale_factor()) as i32;
        let _ = overlay.set_position(PhysicalPosition::new(pos.x + area.width as i32 - size.width as i32 - margin, pos.y + margin));
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let settings = *app.state::<AppState>().settings.lock().unwrap();
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);
    let open = MenuItem::with_id(app, "open", "Відкрити GameCon", true, None::<&str>)?;
    let alerts = MenuItem::with_id(app, "alerts", "Мапа тривог", true, None::<&str>)?;
    let overlay = CheckMenuItem::with_id(app, "overlay", "Оверлей тривог поверх ігор", true, settings.overlay, None::<&str>)?;
    let sound = CheckMenuItem::with_id(app, "sound", "Звук на початку тривоги", true, settings.sound, None::<&str>)?;
    let start = CheckMenuItem::with_id(app, "autostart", "Запускати разом з Windows", true, autostart, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Вийти", true, None::<&str>)?;
    // Версія у форматі GameCon (як сайт і Android) · випуск GCDev Software.
    let about = MenuItem::with_id(app, "about", format!("GameCon {} · GCDev Software", display_version(&app.package_info().version.to_string())), false, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &alerts, &PredefinedMenuItem::separator(app)?, &overlay, &sound, &start, &PredefinedMenuItem::separator(app)?, &about, &quit])?;

    TrayIconBuilder::with_id("gamecon")
        .icon(app.default_window_icon().cloned().expect("іконка застосунку"))
        .tooltip("GameCon")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let state = app.state::<AppState>();
            match event.id.as_ref() {
                "open" => show_main(app, None),
                "alerts" => show_main(app, Some("/alerts")),
                "overlay" | "sound" => {
                    let mut settings = state.settings.lock().unwrap();
                    if event.id.as_ref() == "overlay" {
                        settings.overlay = !settings.overlay;
                        if !settings.overlay {
                            if let Some(window) = app.get_webview_window("overlay") {
                                let _ = window.hide();
                            }
                        }
                    } else {
                        settings.sound = !settings.sound;
                    }
                    save_settings(app, *settings);
                }
                "autostart" => {
                    let launcher = app.autolaunch();
                    let _ = if launcher.is_enabled().unwrap_or(false) { launcher.disable() } else { launcher.enable() };
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle(), None);
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        // Другий запуск — просто показати вже відкрите вікно.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app, None)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .manage(AppState { alert: Mutex::new(None), settings: Mutex::new(Settings::default()) })
        .invoke_handler(tauri::generate_handler![alert_changed, open_main])
        .setup(|app| {
            let handle = app.handle().clone();
            *app.state::<AppState>().settings.lock().unwrap() = load_settings(&handle);
            build_tray(&handle)?;
            place_overlay(&handle);
            // Автозапуск з Windows — у трей, без вікна.
            if std::env::args().any(|arg| arg == "--hidden") {
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Хрестик головного вікна ховає в трей — тривоги стежаться далі.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("не вдалося запустити GameCon");
}
