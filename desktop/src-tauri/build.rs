fn main() {
    // Свої команди — з манифесту: Tauri створює дозволи allow-alert-changed і allow-open-main,
    // а capabilities/default.json віддає їх лише сторінці оверлею на gamecon.online.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["alert_changed", "open_main"])),
    )
    .expect("tauri-build");
}
