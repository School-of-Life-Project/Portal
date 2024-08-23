# Portal

Portal is an eLearning application built for independent learners, designed to allow the use of existing learning materials such as textbooks.

## Notice

Portal is currently a work in progress, and is not yet ready for use by end users.

We welcome contributions from any developers interested in this project.

At the moment, the application is functional enough to be evaluated by end-users, but currently lacks documentation and has undergone very minimal testing. The application's Course and Course Map formats are unlikely to undergo any significant breaking changes.

### For Developers

You will need Cargo (Rust's Package Manager) and NPM (Node.js' package manager) to build this application.

First, install the app's dependencies.

```bash
cargo install tauri-cli
npm install
```

Then, you can:
- run the app in development mode with `cargo tauri dev`
- build an optimized binary with `cargo tauri build`
