use std::fs;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity};

const DISCORD_CLIENT_ID: &str = "1250551199862624349";
const DISCORD_LOGO_URL: &str = "https://i.imgur.com/tuaWADI.png";
const REPOSITORY_URL: &str = "https://github.com/bobjoerules/AMLL-TTML-TOOL";

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct DiscordActivityPayload {
    details: Option<String>,
    state: Option<String>,
    playing: bool,
    activity_type: Option<String>,
    show_repository_button: bool,
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
    large_image: Option<String>,
    large_image_text: Option<String>,
    small_image: Option<String>,
    small_image_text: Option<String>,
}

struct DiscordConnection {
    client: Option<DiscordIpcClient>,
    retry_after: Option<Instant>,
}

impl Default for DiscordConnection {
    fn default() -> Self {
        Self {
            client: None,
            retry_after: None,
        }
    }
}

#[derive(Default)]
struct DiscordState(Mutex<DiscordConnection>);

fn connect_discord() -> Result<DiscordIpcClient, String> {
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
    client.connect().map_err(|e| e.to_string())?;
    Ok(client)
}

#[tauri::command]
fn set_discord_activity(
    payload: DiscordActivityPayload,
    discord: tauri::State<'_, DiscordState>,
) -> Result<(), String> {
    let mut connection = discord.0.lock().map_err(|e| e.to_string())?;
    if connection.client.is_none() {
        if connection
            .retry_after
            .is_some_and(|retry_after| retry_after > Instant::now())
        {
            return Ok(());
        }
        match connect_discord() {
            Ok(client) => {
                connection.client = Some(client);
                connection.retry_after = None;
            }
            Err(error) => {
                log::debug!("Discord RPC is unavailable: {error}");
                connection.retry_after = Some(Instant::now() + Duration::from_secs(15));
                return Ok(());
            }
        }
    }

    let mut assets = activity::Assets::new();

    if let Some(large_image) = payload.large_image.as_deref() {
        if large_image.starts_with("http://") || large_image.starts_with("https://") {
            assets = assets.large_image(large_image);
        } else {
            assets = assets.large_image(DISCORD_LOGO_URL);
        }
    } else {
        assets = assets.large_image(DISCORD_LOGO_URL);
    }

    if let Some(large_image_text) = payload.large_image_text.as_deref() {
        assets = assets.large_text(large_image_text);
    } else {
        assets = assets.large_text("AMLL TTML Tool");
    }

    if let Some(small_image) = payload.small_image.as_deref() {
        if small_image.starts_with("http://") || small_image.starts_with("https://") {
            assets = assets.small_image(small_image);
        }
    }
    if let Some(small_image_text) = payload.small_image_text.as_deref() {
        assets = assets.small_text(small_image_text);
    }

    let activity_type = match payload.activity_type.as_deref() {
        Some("playing") => activity::ActivityType::Playing,
        Some("watching") => activity::ActivityType::Watching,
        Some("competing") => activity::ActivityType::Competing,
        _ => activity::ActivityType::Listening,
    };

    let mut rich_presence = activity::Activity::new()
        .activity_type(activity_type)
        .assets(assets);

    if let Some(details) = payload.details.as_deref() {
        rich_presence = rich_presence.details(details);
    }
    if let Some(state) = payload.state.as_deref() {
        rich_presence = rich_presence.state(state);
    }

    if payload.show_repository_button {
        rich_presence = rich_presence.buttons(vec![activity::Button::new(
            "View repository",
            REPOSITORY_URL,
        )]);
    }

    if let Some(start) = payload.start_timestamp {
        let mut timestamps = activity::Timestamps::new().start(start);
        if let Some(end) = payload.end_timestamp {
            timestamps = timestamps.end(end);
        }
        rich_presence = rich_presence.timestamps(timestamps);
    }

    let result = connection
        .client
        .as_mut()
        .expect("Discord client was initialized")
        .set_activity(rich_presence)
        .map_err(|e| e.to_string());
    if result.is_err() {
        connection.client = None;
        connection.retry_after = Some(Instant::now() + Duration::from_secs(15));
    }
    result
}

#[tauri::command]
fn clear_discord_activity(discord: tauri::State<'_, DiscordState>) -> Result<(), String> {
    let mut connection = discord.0.lock().map_err(|e| e.to_string())?;
    if let Some(client) = connection.client.as_mut() {
        let result = client.clear_activity().map_err(|e| e.to_string());
        if result.is_err() {
            connection.client = None;
        }
        return result;
    }
    connection.retry_after = None;
    Ok(())
}

#[derive(serde::Serialize)]
struct OpenFileData {
    pub filename: String,
    pub data: String,
    pub ext: String,
}

#[tauri::command]
fn convert_audio_mp3_to_flac(input_data: Vec<u8>, filename: String) -> Result<Vec<u8>, String> {
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("ttml_tool_input_{}", filename));
    let output_path = temp_dir.join("ttml_tool_output.flac");

    if let Err(e) = fs::write(&input_path, &input_data) {
        return Err(format!("Failed to write temp input file: {}", e));
    }

    let ffmpeg_result = std::process::Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            input_path.to_str().unwrap(),
            "-codec:a",
            "flac",
            "-sample-rate",
            "44100",
            output_path.to_str().unwrap(),
        ])
        .output();

    let _ = fs::remove_file(&input_path);

    match ffmpeg_result {
        Ok(result) => {
            if result.status.success() {
                match fs::read(&output_path) {
                    Ok(converted_data) => {
                        let _ = fs::remove_file(&output_path);
                        Ok(converted_data)
                    }
                    Err(e) => Err(format!("Failed to read converted file: {}", e))
                }
            } else {
                let stderr_output = String::from_utf8_lossy(&result.stderr);
                let stdout_output = String::from_utf8_lossy(&result.stdout);
                if stderr_output.contains("not found") || stderr_output.is_empty() && stdout_output.is_empty() {
                    Err("ffmpeg not found. Please install ffmpeg and ensure it's in your PATH.".to_string())
                } else {
                    Err(format!("FFmpeg conversion failed: {}\nStdout: {}", stderr_output, stdout_output))
                }
            }
        }
        Err(e) => {
            let error_msg = if e.kind() == std::io::ErrorKind::NotFound {
                "ffmpeg not found. Please install ffmpeg and ensure it's in your PATH.".to_string()
            } else {
                format!("Failed to run ffmpeg: {}. Make sure ffmpeg is installed and in your PATH.", e)
            };
            Err(error_msg)
        }
    }
}

#[tauri::command]
fn get_open_file_data() -> Option<OpenFileData> {
    let filename = std::env::args().nth(1);
    if let Some(filename) = filename {
        let path = std::path::Path::new(&filename);
        let ext = path
            .extension()
            .map(|x| x.to_string_lossy().into_owned())
            .unwrap_or_default();
        if let Ok(data) = std::fs::read_to_string(&filename) {
            return Some(OpenFileData {
                filename,
                data,
                ext,
            });
        }
    }

    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::missing_panics_doc)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    #[cfg(desktop)]
    {
        use tauri_plugin_window_state::StateFlags;

        builder = builder.plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN,
                )
                .build(),
        );
    }

    builder
        .manage(DiscordState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(target_os = "macos")]
            {
                use tauri::{Manager, Emitter};
                use tauri_plugin_decorum::WebviewWindowExt;
                use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};

                let handle = app.handle();

                // 1. App menu
                let app_menu = Submenu::new(app, "AMLL TTML Tool", true)?;
                app_menu.append(&PredefinedMenuItem::about(app, None, None)?)?;
                app_menu.append(&PredefinedMenuItem::separator(app)?)?;
                let account_item = MenuItem::with_id(app, "menu-cloud-auth", "Cloud Account...", true, None::<&str>)?;
                app_menu.append(&account_item)?;
                let settings_item = MenuItem::with_id(app, "menu-settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
                app_menu.append(&settings_item)?;
                app_menu.append(&PredefinedMenuItem::separator(app)?)?;
                app_menu.append(&PredefinedMenuItem::quit(app, None)?)?;

                // 2. File menu
                let file_menu = Submenu::new(app, "File", true)?;
                let new_file_item = MenuItem::with_id(app, "menu-new-file", "New File", true, Some("CmdOrCtrl+N"))?;
                let open_file_item = MenuItem::with_id(app, "menu-open-file", "Open File...", true, Some("CmdOrCtrl+O"))?;
                let open_cloud_item = MenuItem::with_id(app, "menu-cloud-open", "Open from Cloud...", true, Some("CmdOrCtrl+Shift+O"))?;
                let save_file_item = MenuItem::with_id(app, "menu-save-file", "Save File", true, Some("CmdOrCtrl+S"))?;
                let save_cloud_item = MenuItem::with_id(app, "menu-cloud-save", "Save to Cloud...", true, Some("CmdOrCtrl+Shift+S"))?;
                let metadata_item = MenuItem::with_id(app, "menu-metadata", "Metadata Editor...", true, None::<&str>)?;
                file_menu.append(&new_file_item)?;
                file_menu.append(&open_file_item)?;
                file_menu.append(&open_cloud_item)?;
                file_menu.append(&PredefinedMenuItem::separator(app)?)?;
                file_menu.append(&save_file_item)?;
                file_menu.append(&save_cloud_item)?;
                file_menu.append(&PredefinedMenuItem::separator(app)?)?;
                file_menu.append(&metadata_item)?;

                // 3. Edit menu
                let edit_menu = Submenu::new(app, "Edit", true)?;
                let undo_item = MenuItem::with_id(app, "menu-undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
                let redo_item = MenuItem::with_id(app, "menu-redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
                let select_all_item = MenuItem::with_id(app, "menu-select-all", "Select All", true, Some("CmdOrCtrl+A"))?;
                edit_menu.append(&undo_item)?;
                edit_menu.append(&redo_item)?;
                edit_menu.append(&PredefinedMenuItem::separator(app)?)?;
                edit_menu.append(&PredefinedMenuItem::cut(app, None)?)?;
                edit_menu.append(&PredefinedMenuItem::copy(app, None)?)?;
                edit_menu.append(&PredefinedMenuItem::paste(app, None)?)?;
                edit_menu.append(&PredefinedMenuItem::separator(app)?)?;
                edit_menu.append(&select_all_item)?;

                // 4. Tools menu
                let tools_menu = Submenu::new(app, "Tools", true)?;
                let segment_item = MenuItem::with_id(app, "menu-quick-segment", "Quick Segment", true, Some("CmdOrCtrl+L"))?;
                let time_shift_item = MenuItem::with_id(app, "menu-time-shift", "Time Shift...", true, None::<&str>)?;
                let time_stretch_item = MenuItem::with_id(app, "menu-time-stretch", "Time Stretch...", true, None::<&str>)?;
                let checklist_item = MenuItem::with_id(app, "menu-checklist", "TTML Checklist...", true, Some("CmdOrCtrl+Shift+C"))?;
                tools_menu.append(&segment_item)?;
                tools_menu.append(&PredefinedMenuItem::separator(app)?)?;
                tools_menu.append(&time_shift_item)?;
                tools_menu.append(&time_stretch_item)?;
                tools_menu.append(&checklist_item)?;

                // 5. Help menu
                let help_menu = Submenu::new(app, "Help", true)?;
                let latency_item = MenuItem::with_id(app, "menu-latency-test", "Latency Test...", true, None::<&str>)?;
                help_menu.append(&latency_item)?;

                let menu = Menu::with_items(app, &[
                    &app_menu,
                    &file_menu,
                    &edit_menu,
                    &tools_menu,
                    &help_menu,
                ])?;
                app.set_menu(menu)?;

                let app_handle_clone = handle.clone();
                app.on_menu_event(move |_app, event| {
                    let id = event.id().0.as_str();
                    if id.starts_with("menu-") {
                        let _ = app_handle_clone.emit(id, ());
                    }
                });

                let main_window = app.get_webview_window("main").unwrap();
                main_window.set_traffic_lights_inset(16.0, 20.0).unwrap();
                main_window.make_transparent().unwrap();
                let main_window_clone = main_window.clone();
                main_window.on_window_event(move |evt| {
                    if let tauri::WindowEvent::Resized(_) = evt {
                        main_window_clone
                            .set_traffic_lights_inset(16.0, 20.0)
                            .unwrap();
                    }
                });
            }

            // Safety fallback: Ensure main window is made visible after 1.5s even if frontend has delay or error
            #[cfg(desktop)]
            {
                use tauri::Manager;
                if let Some(main_window) = app.get_webview_window("main") {
                    let fallback_window = main_window.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        if let Ok(is_visible) = fallback_window.is_visible() {
                            if !is_visible {
                                log::info!("Safety fallback triggered: force-showing main window");
                                let _ = fallback_window.show();
                            }
                        }
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_open_file_data,
            convert_audio_mp3_to_flac,
            set_discord_activity,
            clear_discord_activity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
