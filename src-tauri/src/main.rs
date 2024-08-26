#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![warn(clippy::pedantic)]

fn main() -> anyhow::Result<()> {
    app_lib::run()
}
