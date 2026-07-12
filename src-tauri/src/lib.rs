use midir::{MidiInput, MidiOutput};
use parking_lot::Mutex;
use serde::Serialize;
use std::sync::Arc;
use tauri::{
    Emitter, Manager, State,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

struct MidiState {
    input: Option<MidiInputConnection>,
    output: Option<MidiOutputConnection>,
}

struct MidiInputConnection {
    _conn: midir::MidiInputConnection<()>,
    port_name: String,
}

struct MidiOutputConnection {
    _conn: midir::MidiOutputConnection,
    port_name: String,
}

struct AppState {
    midi: Arc<Mutex<MidiState>>,
}

#[derive(Serialize, Clone)]
struct MidiPortInfo {
    name: String,
    index: usize,
}

#[tauri::command]
fn list_midi_inputs(_state: State<AppState>) -> Vec<MidiPortInfo> {
    match MidiInput::new("Chord Engine Input") {
        Ok(input) => input
            .ports()
            .iter()
            .enumerate()
            .filter_map(|(i, p)| {
                input.port_name(p).ok().map(|name| MidiPortInfo { name, index: i })
            })
            .collect(),
        Err(_) => vec![],
    }
}

#[tauri::command]
fn list_midi_outputs(_state: State<AppState>) -> Vec<MidiPortInfo> {
    match MidiOutput::new("Chord Engine Output") {
        Ok(output) => output
            .ports()
            .iter()
            .enumerate()
            .filter_map(|(i, p)| {
                output.port_name(p).ok().map(|name| MidiPortInfo { name, index: i })
            })
            .collect(),
        Err(_) => vec![],
    }
}

#[tauri::command]
fn connect_midi_input(
    port_index: usize,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let midi_in = MidiInput::new("Chord Engine Input").map_err(|e| e.to_string())?;
    let ports = midi_in.ports();
    let port = ports.get(port_index).ok_or("Port not found")?;
    let port_name = midi_in.port_name(port).map_err(|e| e.to_string())?;
    let name_clone = port_name.clone();

    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();
    let conn = midi_in
        .connect(
            port,
            "chord-engine-midi",
            move |_timestamp, message, _data| {
                let _ = tx.send(message.to_vec());
            },
            (),
        )
        .map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        while let Ok(msg) = rx.recv() {
            if msg.len() >= 3 {
                let status = msg[0];
                let note = msg[1];
                let velocity = msg[2];
                let event_type = match status & 0xF0 {
                    0x90 if velocity > 0 => "note_on",
                    0x80 | 0x90 => "note_off",
                    0xB0 => "cc",
                    _ => continue,
                };
                let _ = app_handle.emit("midi-event", serde_json::json!({
                    "type": event_type,
                    "note": note,
                    "velocity": velocity,
                    "channel": status & 0x0F,
                }));
            }
        }
    });

    let mut state_lock = state.midi.lock();
    state_lock.input = Some(MidiInputConnection {
        _conn: conn,
        port_name: name_clone,
    });
    Ok(port_name)
}

#[tauri::command]
fn connect_midi_output(
    port_index: usize,
    state: State<AppState>,
) -> Result<String, String> {
    let midi_out = MidiOutput::new("Chord Engine Output").map_err(|e| e.to_string())?;
    let ports = midi_out.ports();
    let port = ports.get(port_index).ok_or("Port not found")?;
    let port_name = midi_out.port_name(port).map_err(|e| e.to_string())?;
    let name_clone = port_name.clone();

    let conn = midi_out.connect(port, "chord-engine-midi").map_err(|e| e.to_string())?;

    let mut state_lock = state.midi.lock();
    state_lock.output = Some(MidiOutputConnection {
        _conn: conn,
        port_name: name_clone,
    });
    Ok(port_name)
}

#[tauri::command]
fn disconnect_midi_input(state: State<AppState>) -> Result<(), String> {
    let mut state_lock = state.midi.lock();
    state_lock.input = None;
    Ok(())
}

#[tauri::command]
fn disconnect_midi_output(state: State<AppState>) -> Result<(), String> {
    let mut state_lock = state.midi.lock();
    state_lock.output = None;
    Ok(())
}

#[tauri::command]
fn get_midi_connection_status(state: State<AppState>) -> MidiConnectionStatus {
    let state_lock = state.midi.lock();
    MidiConnectionStatus {
        input_connected: state_lock.input.is_some(),
        input_port: state_lock.input.as_ref().map(|c| c.port_name.clone()),
        output_connected: state_lock.output.is_some(),
        output_port: state_lock.output.as_ref().map(|c| c.port_name.clone()),
    }
}

#[derive(Serialize)]
struct MidiConnectionStatus {
    input_connected: bool,
    input_port: Option<String>,
    output_connected: bool,
    output_port: Option<String>,
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let midi_state = Arc::new(Mutex::new(MidiState {
        input: None,
        output: None,
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(AppState {
            midi: midi_state,
        })
        .invoke_handler(tauri::generate_handler![
            list_midi_inputs,
            list_midi_outputs,
            connect_midi_input,
            connect_midi_output,
            disconnect_midi_input,
            disconnect_midi_output,
            get_midi_connection_status,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // System tray
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Chord Engine");
}
