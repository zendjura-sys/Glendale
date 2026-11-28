//! Логіка оверлею тривог GameCon (№261) — без GUI, тому перевіряється `cargo test` на будь-якій ОС.
//!
//! Сторінка оверлею на сайті (`/desktop/overlay`) щоразу повідомляє застосунку поточний стан тривоги
//! у місці людини; ядро вирішує, що зробити: показати оверлей і сповіщення (почалась), сповістити про
//! відбій чи нічого.

use serde::{Deserialize, Serialize};

/// Стан тривоги, який надсилає сторінка оверлею. `key = None` — тривоги немає.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AlertState {
    /// Унікальний ключ тривоги (типи + час початку): нова тривога — новий ключ.
    pub key: Option<String>,
    pub title: String,
    pub place: String,
    pub duration: String,
}

/// Що змінилось між двома станами.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transition {
    /// Почалась (чи змінилась) тривога: показати оверлей, сповіщення й звук.
    Started,
    /// Відбій: сховати оверлей і сповістити.
    Ended,
    /// Без змін (тривога триває чи її немає й не було).
    None,
}

pub fn transition(prev: Option<&str>, next: Option<&str>) -> Transition {
    match (prev, next) {
        (None, Some(_)) => Transition::Started,
        (Some(_), None) => Transition::Ended,
        (Some(a), Some(b)) if a != b => Transition::Started,
        _ => Transition::None,
    }
}

/// Текст системного сповіщення Windows для переходу: (заголовок, текст).
pub fn notification(change: Transition, state: &AlertState) -> Option<(String, String)> {
    match change {
        Transition::Started => {
            let title = if state.title.is_empty() { "Повітряна тривога".to_string() } else { state.title.clone() };
            let body = [state.place.as_str(), state.duration.as_str()]
                .iter()
                .filter(|s| !s.is_empty())
                .copied()
                .collect::<Vec<_>>()
                .join(" · ");
            Some((title, body))
        }
        Transition::Ended => Some(("Відбій тривоги".to_string(), "Тривогу у вашому місці скасовано.".to_string())),
        Transition::None => None,
    }
}

/// Вигляд застосунку (вибір у треї):
/// - `Widgets` — нативні міні-вікна «завжди згори», що самі є оверлеєм (головне вікно — на вимогу);
/// - `Window` — одне суцільне вікно, без віджетів;
/// - `Auto` — граєте (гра на весь екран) — віджети поверх гри; не граєте — одне вікно.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Layout {
    Widgets,
    Window,
    #[default]
    Auto,
}

impl Layout {
    pub fn key(self) -> &'static str {
        match self {
            Layout::Widgets => "widgets",
            Layout::Window => "window",
            Layout::Auto => "auto",
        }
    }

    pub fn from_key(key: &str) -> Option<Self> {
        match key {
            "widgets" => Some(Layout::Widgets),
            "window" => Some(Layout::Window),
            "auto" => Some(Layout::Auto),
            _ => None,
        }
    }

    /// Чи показувати міні-вікна зараз.
    pub fn widgets_visible(self, playing: bool) -> bool {
        match self {
            Layout::Widgets => true,
            Layout::Window => false,
            Layout::Auto => playing,
        }
    }

    /// Чи відкривати головне вікно на старті (у режимі віджетів воно — на вимогу з трею).
    pub fn main_on_start(self) -> bool {
        self != Layout::Widgets
    }
}

/// Налаштування застосунку (трей): оверлей тривог, звук, вигляд. Зберігаються в settings.json.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub overlay: bool,
    pub sound: bool,
    pub layout: Layout,
}

impl Default for Settings {
    fn default() -> Self {
        Self { overlay: true, sound: true, layout: Layout::Auto }
    }
}

impl Settings {
    /// Читання з JSON: зіпсований чи порожній файл — типові налаштування.
    pub fn parse(json: &str) -> Self {
        serde_json_lite(json).unwrap_or_default()
    }
}

// Невеликий розбір двох булевих полів без serde_json — ядро лишається легким.
fn serde_json_lite(json: &str) -> Option<Settings> {
    let compact: String = json.chars().filter(|c| !c.is_whitespace()).collect();
    if !compact.starts_with('{') {
        return None;
    }
    let field = |name: &str| -> Option<bool> {
        let rest = &compact[compact.find(&format!("\"{name}\":"))? + name.len() + 3..];
        if rest.starts_with("true") {
            Some(true)
        } else if rest.starts_with("false") {
            Some(false)
        } else {
            None
        }
    };
    let layout = compact
        .find("\"layout\":\"")
        .and_then(|at| {
            let rest = &compact[at + 10..];
            rest.find('"').map(|end| &rest[..end])
        })
        .and_then(Layout::from_key);
    let defaults = Settings::default();
    Some(Settings {
        overlay: field("overlay").unwrap_or(defaults.overlay),
        sound: field("sound").unwrap_or(defaults.sound),
        layout: layout.unwrap_or(defaults.layout),
    })
}

impl Settings {
    pub fn to_json(&self) -> String {
        format!("{{\"overlay\":{},\"sound\":{},\"layout\":\"{}\"}}", self.overlay, self.sound, self.layout.key())
    }
}

/// Чи схоже вікно на переднім плані на гру: займає весь монітор і не належить ні робочому столу,
/// ні самому GameCon. Прямокутники — (ліво, верх, право, низ) у фізичних пікселях.
pub fn looks_like_game(window: (i32, i32, i32, i32), monitor: (i32, i32, i32, i32), shell: bool, own: bool) -> bool {
    !shell && !own && window.0 <= monitor.0 && window.1 <= monitor.1 && window.2 >= monitor.2 && window.3 >= monitor.3
}

/// Версія у форматі GameCon Г.ГГММ.X.Y (як сайт і Android) із semver Tauri:
/// «1.2611.0» → «1.2611.0.0», «1.2611.0+3» → «1.2611.0.3» (номер збірки — після «+»).
pub fn display_version(semver: &str) -> String {
    let (core, build) = semver.split_once('+').unwrap_or((semver, "0"));
    let build = if build.chars().all(|c| c.is_ascii_digit()) && !build.is_empty() { build } else { "0" };
    format!("{core}.{build}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transitions() {
        assert_eq!(transition(None, Some("a|1")), Transition::Started);
        assert_eq!(transition(Some("a|1"), None), Transition::Ended);
        assert_eq!(transition(Some("a|1"), Some("b|2")), Transition::Started);
        assert_eq!(transition(Some("a|1"), Some("a|1")), Transition::None);
        assert_eq!(transition(None, None), Transition::None);
    }

    #[test]
    fn notification_texts() {
        let state = AlertState { key: Some("a".into()), title: "Повітряна тривога · червоний рівень".into(), place: "Київ".into(), duration: "Триває 12 хв".into() };
        assert_eq!(
            notification(Transition::Started, &state),
            Some(("Повітряна тривога · червоний рівень".into(), "Київ · Триває 12 хв".into()))
        );
        assert_eq!(notification(Transition::Ended, &state).unwrap().0, "Відбій тривоги");
        assert_eq!(notification(Transition::None, &state), None);
        let bare = AlertState { key: Some("a".into()), ..Default::default() };
        assert_eq!(notification(Transition::Started, &bare), Some(("Повітряна тривога".into(), String::new())));
    }

    #[test]
    fn versions() {
        assert_eq!(display_version("1.2611.0"), "1.2611.0.0");
        assert_eq!(display_version("1.2611.0+3"), "1.2611.0.3");
        assert_eq!(display_version("1.2611.1+x"), "1.2611.1.0");
    }

    #[test]
    fn settings_round_trip_and_fallback() {
        let s = Settings { overlay: false, sound: true, layout: Layout::Widgets };
        assert_eq!(Settings::parse(&s.to_json()), s);
        assert_eq!(Settings::parse(""), Settings::default());
        assert_eq!(Settings::parse("not json"), Settings::default());
        // Старий файл без «layout» — типово «Авто».
        assert_eq!(Settings::parse("{ \"sound\": false }"), Settings { overlay: true, sound: false, layout: Layout::Auto });
        assert_eq!(Settings::parse("{\"layout\":\"window\"}").layout, Layout::Window);
        assert_eq!(Settings::parse("{\"layout\":\"???\"}").layout, Layout::Auto);
    }

    #[test]
    fn layouts() {
        assert!(Layout::Widgets.widgets_visible(false));
        assert!(!Layout::Window.widgets_visible(true));
        assert!(Layout::Auto.widgets_visible(true));
        assert!(!Layout::Auto.widgets_visible(false));
        assert!(!Layout::Widgets.main_on_start());
        assert!(Layout::Auto.main_on_start());
    }

    #[test]
    fn game_detection() {
        let screen = (0, 0, 1920, 1080);
        assert!(looks_like_game((0, 0, 1920, 1080), screen, false, false));
        assert!(!looks_like_game((0, 0, 1920, 1040), screen, false, false), "звичайне розгорнуте вікно з панеллю задач");
        assert!(!looks_like_game((0, 0, 1920, 1080), screen, true, false), "робочий стіл");
        assert!(!looks_like_game((0, 0, 1920, 1080), screen, false, true), "сам GameCon");
    }
}
