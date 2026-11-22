fn main() {
    // Свої команди — з манифесту: Tauri створює дозволи allow-alert-changed, allow-open-main і allow-widget-state,
    // а capabilities/default.json віддає їх лише сторінкам оверлею й віджетів на gamecon.online.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["alert_changed", "open_main", "widget_state"])),
    )
    .expect("tauri-build");
}
