//! GameCon для Windows (№261) на Rust + Tauri 2: сайт у вікні, міні-вікна (віджети), значок у треї
//! й оверлей тривог поверх ігор.
//!
//! Вигляд обирається в треї (`gamecon_core::Layout`):
//! - «Віджети поверх ігор» — застосунок складається з маленьких вікон «завжди згори» (друзі, чати,
//!   тривога), які самі є оверлеєм; головне вікно відкривається на вимогу;
//! - «Одне вікно» — суцільне вікно сайту без віджетів;
//! - «Авто» — гра на весь екран на передньому плані → віджети поверх неї; не граєте → одне вікно.
//!
//! Кожен віджет — сторінка сайту /desktop/widget/{kind} (cookie входу): вона опитує /me/rail і
//! повідомляє застосунку, чи є що показати (`widget_state`); порожній віджет прихований. Оверлей
//! тривог — /desktop/overlay (`alert_changed`). Видно в іграх у віконному й безрамковому режимах;
//! в ексклюзивному повноекранному Windows малювати поверх гри не дає — тоді лишається сповіщення.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use gamecon_core::{display_version, notification, transition, AlertState, Layout, Settings};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_notification::NotificationExt;

const SITE: &str = "https://gamecon.online";
/// Міні-вікна: мітка вікна → вид віджета на сайті (порядок — згори вниз).
const WIDGETS: [(&str, &str); 2] = [("w-friends", "friends"), ("w-chats", "chats")];
const WIDGET_WIDTH: f64 = 300.0;
/// Відступ від краю екрана й між віджетами, логічні пікселі.
const MARGIN: f64 = 16.0;
/// Місце під оверлей тривоги згори (його висота з tauri.conf.json + проміжок).
const OVERLAY_SLOT: f64 = 148.0;

/// Стан застосунку: остання тривога, налаштування, чи йде гра, вміст віджетів, пункти «Вигляд».
struct AppState {
    alert: Mutex<Option<String>>,
    settings: Mutex<Settings>,
    playing: AtomicBool,
    /// Вид віджета → (є що показати, висота вмісту).
    widgets: Mutex<HashMap<String, (bool, f64)>>,
    layout_items: Mutex<Vec<(Layout, CheckMenuItem<Wry>)>>,
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

/// Віджет повідомляє, чи є що показати, і висоту вмісту — застосунок ховає порожній і вирівнює стовпчик.
#[tauri::command]
fn widget_state(app: AppHandle, state: tauri::State<'_, AppState>, kind: String, items: usize, height: f64) {
    if !WIDGETS.iter().any(|(_, k)| *k == kind) {
        return;
    }
    state.widgets.lock().unwrap().insert(kind, (items > 0, height.clamp(60.0, 480.0)));
    apply_layout(&app);
}

/// Кнопки віджетів і оверлею: відкрити розділ сайту в головному вікні (лише шлях цього ж сайту).
#[tauri::command]
fn open_main(app: AppHandle, route: Option<String>) {
    let route = route.filter(|r| r.starts_with('/') && !r.starts_with("//")).unwrap_or_else(|| "/alerts".to_string());
    show_main(&app, Some(&route));
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
        let margin = (MARGIN * monitor.scale_factor()) as i32;
        let _ = overlay.set_position(tauri::PhysicalPosition::new(pos.x + area.width as i32 - size.width as i32 - margin, pos.y + margin));
    }
}

/// Створити міні-вікна (приховані): прозорі, без рамок, «завжди згори», без кнопки на панелі задач.
fn create_widgets(app: &AppHandle) -> tauri::Result<()> {
    for (label, kind) in WIDGETS {
        let url = format!("{SITE}/desktop/widget/{kind}").parse().expect("адреса віджета");
        WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
            .title("GameCon")
            .inner_size(WIDGET_WIDTH, 120.0)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .focused(false)
            .shadow(false)
            .visible(false)
            .build()?;
    }
    Ok(())
}

/// Показати/сховати віджети за вибраним виглядом і грою; видимі — стовпчиком під оверлеєм тривоги.
fn apply_layout(app: &AppHandle) {
    let state = app.state::<AppState>();
    let layout = state.settings.lock().unwrap().layout;
    let visible = layout.widgets_visible(state.playing.load(Ordering::Relaxed));
    let widgets = state.widgets.lock().unwrap().clone();
    let Some(first) = app.get_webview_window(WIDGETS[0].0) else { return };
    let (right, top) = match first.primary_monitor() {
        Ok(Some(monitor)) => {
            let scale = monitor.scale_factor();
            let pos = monitor.position().to_logical::<f64>(scale);
            let size = monitor.size().to_logical::<f64>(scale);
            (pos.x + size.width - MARGIN, pos.y + MARGIN + OVERLAY_SLOT)
        }
        _ => return,
    };
    let mut y = top;
    for (label, kind) in WIDGETS {
        let Some(window) = app.get_webview_window(label) else { continue };
        let (has, height) = widgets.get(kind).copied().unwrap_or((false, 120.0));
        if visible && has {
            let _ = window.set_size(LogicalSize::new(WIDGET_WIDTH, height));
            let _ = window.set_position(LogicalPosition::new(right - WIDGET_WIDTH, y));
            let _ = window.show();
            y += height + 4.0;
        } else {
            let _ = window.hide();
        }
    }
}

/// Чи йде гра: вікно на передньому плані займає весь монітор і це не робочий стіл чи сам GameCon.
#[cfg(windows)]
fn playing_now() -> bool {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId};

    // SAFETY: лише читання стану вікон Windows; усі вказівники — на локальні змінні цієї функції.
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }
        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return false;
        }
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mut info) == 0 {
            return false;
        }
        let mut class = [0u16; 64];
        let len = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32).max(0) as usize;
        let shell = matches!(String::from_utf16_lossy(&class[..len]).as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd");
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        let m = info.rcMonitor;
        gamecon_core::looks_like_game((rect.left, rect.top, rect.right, rect.bottom), (m.left, m.top, m.right, m.bottom), shell, pid == std::process::id())
    }
}

#[cfg(not(windows))]
fn playing_now() -> bool {
    false
}

/// Раз на 3 с перевіряємо, чи йде гра; змінилось — перерахувати вигляд.
fn watch_games(app: AppHandle) {
    std::thread::spawn(move || loop {
        let playing = playing_now();
        let state = app.state::<AppState>();
        if state.playing.swap(playing, Ordering::Relaxed) != playing {
            apply_layout(&app);
        }
        std::thread::sleep(Duration::from_secs(3));
    });
}

fn set_layout(app: &AppHandle, layout: Layout) {
    let state = app.state::<AppState>();
    {
        let mut settings = state.settings.lock().unwrap();
        settings.layout = layout;
        save_settings(app, *settings);
    }
    for (item_layout, item) in state.layout_items.lock().unwrap().iter() {
        let _ = item.set_checked(*item_layout == layout);
    }
    apply_layout(app);
    if layout == Layout::Window {
        show_main(app, None);
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let settings = *app.state::<AppState>().settings.lock().unwrap();
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);
    let open = MenuItem::with_id(app, "open", "Відкрити GameCon", true, None::<&str>)?;
    let alerts = MenuItem::with_id(app, "alerts", "Мапа тривог", true, None::<&str>)?;
    let layouts = [
        (Layout::Widgets, "Віджети поверх ігор (міні-вікна)"),
        (Layout::Window, "Одне вікно"),
        (Layout::Auto, "Авто: віджети, коли граю"),
    ];
    let mut items = Vec::new();
    for (layout, label) in layouts {
        items.push((layout, CheckMenuItem::with_id(app, format!("layout-{}", layout.key()), label, true, settings.layout == layout, None::<&str>)?));
    }
    let view = Submenu::with_items(app, "Вигляд", true, &[&items[0].1, &items[1].1, &items[2].1])?;
    *app.state::<AppState>().layout_items.lock().unwrap() = items;
    let overlay = CheckMenuItem::with_id(app, "overlay", "Оверлей тривог поверх ігор", true, settings.overlay, None::<&str>)?;
    let sound = CheckMenuItem::with_id(app, "sound", "Звук на початку тривоги", true, settings.sound, None::<&str>)?;
    let start = CheckMenuItem::with_id(app, "autostart", "Запускати разом з Windows", true, autostart, None::<&str>)?;
    // Версія у форматі GameCon (як сайт і Android) · випуск GCDev Software.
    let about = MenuItem::with_id(app, "about", format!("GameCon {} · GCDev Software", display_version(&app.package_info().version.to_string())), false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Вийти", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open, &alerts, &PredefinedMenuItem::separator(app)?, &view, &overlay, &sound, &start, &PredefinedMenuItem::separator(app)?, &about, &quit],
    )?;

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
                id if id.starts_with("layout-") => {
                    if let Some(layout) = Layout::from_key(&id["layout-".len()..]) {
                        set_layout(app, layout);
                    }
                }
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
        .manage(AppState {
            alert: Mutex::new(None),
            settings: Mutex::new(Settings::default()),
            playing: AtomicBool::new(false),
            widgets: Mutex::new(HashMap::new()),
            layout_items: Mutex::new(Vec::new()),
        })
        .invoke_handler(tauri::generate_handler![alert_changed, open_main, widget_state])
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = load_settings(&handle);
            *app.state::<AppState>().settings.lock().unwrap() = settings;
            build_tray(&handle)?;
            place_overlay(&handle);
            create_widgets(&handle)?;
            watch_games(handle.clone());
            // Автозапуск з Windows чи вигляд «Віджети» — без головного вікна (воно в треї).
            if std::env::args().any(|arg| arg == "--hidden") || !settings.layout.main_on_start() {
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.hide();
                }
            }
            apply_layout(&handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Хрестик головного вікна ховає в трей — тривоги й віджети працюють далі.
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
