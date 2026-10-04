//! Appli de bureau Poulpe : une fenêtre Tauri qui embarque l'éditeur web (`apps/editor`).
//!
//! Le côté Rust reste minimal : ouverture des fichiers `.poulpe` par double-clic,
//! liste des polices installées, et accès aux fichiers via les extensions officielles de Tauri.

use std::path::PathBuf;
use std::sync::Mutex;
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::{Emitter, Manager};

/// Fichier passé au lancement de l'appli (double-clic sur un `.poulpe`), en attente d'être ouvert.
#[derive(Default)]
struct OpenedFile(Mutex<Option<String>>);

/// Premier argument de la ligne de commande qui désigne un fichier `.poulpe` existant.
fn poulpe_file_from_args<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| {
            p.extension()
                .map(|e| e.eq_ignore_ascii_case("poulpe"))
                .unwrap_or(false)
                && p.is_file()
        })
        .map(|p| p.to_string_lossy().into_owned())
}

/// Renvoie (une seule fois) le fichier à ouvrir au démarrage.
#[tauri::command]
fn opened_file(state: tauri::State<'_, OpenedFile>) -> Option<String> {
    state.0.lock().ok()?.take()
}

/// Familles de polices installées sur l'ordinateur, triées et sans doublons.
#[tauri::command]
fn list_fonts() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    let mut families: Vec<String> = db
        .faces()
        .filter_map(|face| face.families.first().map(|(name, _)| name.clone()))
        .collect();
    families.sort_by_key(|f| f.to_lowercase());
    families.dedup();
    families
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(OpenedFile(Mutex::new(poulpe_file_from_args(std::env::args()))))
        .invoke_handler(tauri::generate_handler![opened_file, list_fonts])
        .build(tauri::generate_context!())
        .expect("impossible de démarrer Poulpe");

    app.run(|_handle, _event| {
        // macOS transmet les fichiers ouverts depuis le Finder par un événement, pas par les arguments.
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = &_event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let path = path.to_string_lossy().into_owned();
                    if let Some(window) = _handle.get_webview_window("main") {
                        let _ = window.emit("open-file", path.clone());
                    }
                    if let Some(state) = _handle.try_state::<OpenedFile>() {
                        if let Ok(mut slot) = state.0.lock() {
                            slot.get_or_insert(path);
                        }
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trouve_le_fichier_poulpe_dans_les_arguments() {
        let dir = std::env::temp_dir().join("poulpe-test-args");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("Affiche.POULPE");
        std::fs::write(&file, b"x").unwrap();
        let args = vec![
            "poulpe".to_string(),
            "--flag".to_string(),
            file.to_string_lossy().into_owned(),
        ];
        assert_eq!(poulpe_file_from_args(args), Some(file.to_string_lossy().into_owned()));
        assert_eq!(poulpe_file_from_args(vec!["poulpe".to_string(), "absent.poulpe".to_string()]), None);
    }

    #[test]
    fn liste_les_polices_sans_doublons() {
        let fonts = list_fonts();
        let mut sorted = fonts.clone();
        sorted.dedup();
        assert_eq!(fonts.len(), sorted.len());
    }
}
