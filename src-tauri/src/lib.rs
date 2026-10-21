// Die Desktop-Hülle enthält bewusst keine Fachlogik: Sie öffnet das Fenster und
// erlaubt dem Frontend den Dateizugriff im App-Datenordner (siehe capabilities/default.json).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
    .expect("Fehler beim Starten von Finanz-Cockpit");
}
