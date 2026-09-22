use std::io::{self, BufRead};
use stremio_core::runtime::msg::{Action, ActionPlayer};
use stremio_core::types::player::av_sync_v2::Controller;

fn main() {
    let mut controller = Controller::default();
    controller.begin();
    for line in io::stdin().lock().lines() {
        let line = line.expect("Input line");
        let action: Action = serde_json::from_str(&line).expect("The real Core action wire format");
        match action {
            Action::Player(ActionPlayer::AvSyncV2Observed { observation, now_ms }) => controller.observe(&observation, now_ms, true),
            Action::Player(ActionPlayer::AvSyncV2Acknowledged { acknowledgement, now_ms }) => controller.acknowledge(&acknowledgement, now_ms),
            Action::Player(ActionPlayer::AvSyncV2Tick { session_id, now_ms }) => controller.tick(session_id, now_ms),
            Action::Player(ActionPlayer::PausedChanged { paused: true }) => controller.interrupt(),
            Action::Unload => controller.close(),
            _ => panic!("Unexpected contract action"),
        }
    }
    println!("{}", serde_json::to_string(&controller).unwrap());
}
