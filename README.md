# Portal

Portal is an app built for independent learners.

Unlike most eLearning applications, Portal is focused on making use of existing learning materials. Any textbook or set of textbooks can be converted into a Portal-compatible course, as long as it is available in the ePub format.

In addition, Portal is designed to function well on a wide variety of hardware configurations and does not require an internet connection to use. Courses and app updates can be distributed via a [sneakernet](https://en.wikipedia.org/wiki/Sneakernet) if necessary.

## Notice

Portal is currently a work in progress, and is not yet ready for use by end users. We welcome contributions from any developers interested in this project.

At the moment, the application is functional enough to be evaluated by end-users, but it lacks documentation and has undergone very minimal testing. The application's Course and Course Map formats are unlikely to undergo any significant breaking changes.

[Development Roadmap](TODO.md)

### For Developers

You will need Cargo (Rust's Package Manager) and NPM (Node.js' package manager) to build this application.

First, install the app's dependencies.

```bash
npm install
```

Then, you can:
- run the app in development mode with `npx tauri dev`
- build an optimized binary with `npx tauri build`
