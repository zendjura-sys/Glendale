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

/// Налаштування застосунку (трей): оверлей, звук. Зберігаються в settings.json.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub overlay: bool,
    pub sound: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self { overlay: true, sound: true }
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
    let defaults = Settings::default();
    Some(Settings { overlay: field("overlay").unwrap_or(defaults.overlay), sound: field("sound").unwrap_or(defaults.sound) })
}

impl Settings {
    pub fn to_json(&self) -> String {
        format!("{{\"overlay\":{},\"sound\":{}}}", self.overlay, self.sound)
    }
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
        let s = Settings { overlay: false, sound: true };
        assert_eq!(Settings::parse(&s.to_json()), s);
        assert_eq!(Settings::parse(""), Settings::default());
        assert_eq!(Settings::parse("not json"), Settings::default());
        assert_eq!(Settings::parse("{ \"sound\": false }"), Settings { overlay: true, sound: false });
    }
}
