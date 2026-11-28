//! Нативне ядро GameCon для ПК (Rust → Electron Main через NAPI-RS).
//!
//! - `Store` — єдине сховище стану: налаштування, режим (одне вікно / віджети), геометрія кожного
//!   вікна й віджета (x, y, розмір, «поверх усіх», видимість). Пишеться атомарно (tmp + rename),
//!   тож збій посеред запису не псує файл.
//! - `snap` — магнітне прилипання вікна до країв робочої області й сусідніх віджетів.
//! - `foreground_game` — гра на весь екран на передньому плані (Windows): ігровий оверлей і статус «Граю».

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

/// Геометрія й стан вікна чи віджета.
#[napi(object)]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    /// «Закріпити поверх усіх вікон».
    pub always_on_top: bool,
    /// Віджет відкритий у режимі віджетів.
    pub visible: bool,
}

/// Прямокутник для прилипання.
#[napi(object)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Default, Serialize, Deserialize)]
struct State {
    #[serde(default = "default_mode")]
    mode: String,
    #[serde(default)]
    windows: BTreeMap<String, WindowState>,
    #[serde(default)]
    values: BTreeMap<String, serde_json::Value>,
}

fn default_mode() -> String {
    "unified".into()
}

/// Сховище стану програми (один екземпляр у Main-процесі).
#[napi]
pub struct Store {
    path: PathBuf,
    state: Mutex<State>,
}

#[napi]
impl Store {
    /// Відкрити сховище в теці даних програми (створюється за потреби). Зіпсований файл — чистий стан.
    #[napi(constructor)]
    pub fn new(dir: String) -> Result<Self> {
        let dir = PathBuf::from(dir);
        fs::create_dir_all(&dir).map_err(|e| Error::from_reason(format!("Не вдалося створити теку стану: {e}")))?;
        let path = dir.join("state.json");
        let state = fs::read_to_string(&path).ok().and_then(|raw| serde_json::from_str::<State>(&raw).ok()).unwrap_or_else(|| State { mode: default_mode(), ..Default::default() });
        Ok(Self { path, state: Mutex::new(state) })
    }

    fn persist(&self, state: &State) -> Result<()> {
        let raw = serde_json::to_string_pretty(state).map_err(|e| Error::from_reason(e.to_string()))?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, raw).and_then(|_| fs::rename(&tmp, &self.path)).map_err(|e| Error::from_reason(format!("Не вдалося зберегти стан: {e}")))
    }

    /// Режим: "unified" (одне вікно) чи "widgets" (рій віджетів).
    #[napi(getter)]
    pub fn mode(&self) -> String {
        self.state.lock().unwrap().mode.clone()
    }

    #[napi]
    pub fn set_mode(&self, mode: String) -> Result<()> {
        if mode != "unified" && mode != "widgets" {
            return Err(Error::from_reason(format!("Невідомий режим: {mode}")));
        }
        let mut state = self.state.lock().unwrap();
        state.mode = mode;
        self.persist(&state)
    }

    /// Збережена геометрія вікна (null — ще не відкривалось).
    #[napi]
    pub fn window(&self, id: String) -> Option<WindowState> {
        self.state.lock().unwrap().windows.get(&id).cloned()
    }

    /// Усі збережені вікна й віджети.
    #[napi]
    pub fn windows(&self) -> BTreeMap<String, WindowState> {
        self.state.lock().unwrap().windows.clone()
    }

    #[napi]
    pub fn save_window(&self, id: String, window: WindowState) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        if state.windows.get(&id) == Some(&window) {
            return Ok(());
        }
        state.windows.insert(id, window);
        self.persist(&state)
    }

    /// Скинути розклад віджетів (наступне відкриття — типові місця).
    #[napi]
    pub fn reset_windows(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        state.windows.retain(|id, _| id == "main");
        self.persist(&state)
    }

    /// Довільне значення (налаштування, сесія тощо) — JSON.
    #[napi]
    pub fn get(&self, key: String) -> Option<serde_json::Value> {
        self.state.lock().unwrap().values.get(&key).cloned()
    }

    #[napi]
    pub fn set(&self, key: String, value: serde_json::Value) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        if value.is_null() {
            state.values.remove(&key);
        } else {
            state.values.insert(key, value);
        }
        self.persist(&state)
    }
}

/// Магнітне прилипання: якщо край вікна ближче за `threshold` px до краю робочої області чи сусіда —
/// притягуємо впритул (до сусіда — з проміжком `gap`). Повертає нове положення.
#[napi]
pub fn snap(rect: Rect, areas: Vec<Rect>, neighbors: Vec<Rect>, threshold: i32, gap: i32) -> Rect {
    let mut out = rect;
    let (mut best_x, mut best_y) = (threshold + 1, threshold + 1);
    let mut try_x = |target: i32, out: &mut Rect| {
        let d = (out.x - target).abs();
        if d <= threshold && d < best_x {
            best_x = d;
            out.x = target;
        }
    };
    let candidates_x = |r: &Rect, area: bool| -> Vec<i32> {
        if area {
            vec![r.x, r.x + r.width - rect.width]
        } else {
            vec![r.x + r.width + gap, r.x - rect.width - gap, r.x, r.x + r.width - rect.width]
        }
    };
    for a in &areas {
        for t in candidates_x(a, true) {
            try_x(t, &mut out);
        }
    }
    for n in &neighbors {
        // Лише якщо віджети перекриваються по вертикалі — інакше прилипання було б дивним.
        if rect.y < n.y + n.height + threshold && rect.y + rect.height > n.y - threshold {
            for t in candidates_x(n, false) {
                try_x(t, &mut out);
            }
        }
    }
    let mut try_y = |target: i32, out: &mut Rect| {
        let d = (out.y - target).abs();
        if d <= threshold && d < best_y {
            best_y = d;
            out.y = target;
        }
    };
    for a in &areas {
        for t in [a.y, a.y + a.height - rect.height] {
            try_y(t, &mut out);
        }
    }
    for n in &neighbors {
        if rect.x < n.x + n.width + threshold && rect.x + rect.width > n.x - threshold {
            for t in [n.y + n.height + gap, n.y - rect.height - gap, n.y, n.y + n.height - rect.height] {
                try_y(t, &mut out);
            }
        }
    }
    out
}

/// Назва вікна гри на весь екран на передньому плані (не робочий стіл і не сам GameCon); інакше null.
#[napi]
pub fn foreground_game(own_pid: u32) -> Option<String> {
    imp::foreground_game(own_pid)
}

#[cfg(windows)]
mod imp {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId};

    pub fn foreground_game(own_pid: u32) -> Option<String> {
        // SAFETY: лише читання стану вікон; усі вказівники — на локальні змінні.
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let mut rect: RECT = std::mem::zeroed();
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return None;
            }
            let mut info: MONITORINFO = std::mem::zeroed();
            info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
            if GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mut info) == 0 {
                return None;
            }
            let mut class = [0u16; 64];
            let len = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32).max(0) as usize;
            if matches!(String::from_utf16_lossy(&class[..len]).as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd") {
                return None;
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let m = info.rcMonitor;
            let full = rect.left <= m.left && rect.top <= m.top && rect.right >= m.right && rect.bottom >= m.bottom;
            if pid == own_pid || !full {
                return None;
            }
            let mut title = [0u16; 256];
            let n = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32).max(0) as usize;
            let title = String::from_utf16_lossy(&title[..n]).trim().to_string();
            (!title.is_empty()).then_some(title)
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn foreground_game(_own_pid: u32) -> Option<String> {
        None
    }
}
