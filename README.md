# Portal

Portal is an app built for independent learners.

Unlike most eLearning applications, Portal is focused on making use of existing learning materials. Any textbook or set of textbooks can be converted into a Portal course, as long as it is available in the EPUB format.

Portal is designed to perform well on low-end hardware and does not require an internet connection to use. It can run on all desktop [platforms supported by Tauri](https://github.com/tauri-apps/tauri#platforms).

## Binary Installation

Binary releases of Portal can be found on the [releases page](https://github.com/School-of-Life-Project/Portal/releases), and installation instructions can be found on [Portal's website](https://school-of-life-project.github.io/Portal/).

## Building

You will need [Rust](https://www.rust-lang.org/tools/install) and [Node.js](https://nodejs.org/en/download) to build this application. In addition, you will need to install the build dependencies for [Tauri](https://v2.tauri.app/start/prerequisites/).

After installing the required dependencies, run the following command in the repository folder:

```bash
npm install
```

Then, you can:
- run the application in development mode with `npx tauri dev`
- build an optimized desktop binary with `npx tauri build`

## Usage

Portal has a built-in user manual, which can be accessed by pressing the `📜 Guide` button on the app's home screen.

## Architecture

Portal is built using [Tauri](https://tauri.app) and [Vite](https://vitejs.dev).

The Rust-based backend of the application is used to load resources from disk and manage the state of the [embedded database](https://github.com/spacejam/sled). The TypeScript-based frontend of the application is used to render UI elements and display textbooks using [epub.js](https://github.com/futurepress/epub.js/).

UI icons are provided by [OpenMoji](https://openmoji.org). Fonts are provided by the system on Windows and MacOS, and mix of system fonts and custom fonts are used on Linux. On Linux, [Liberation Fonts](https://github.com/liberationfonts/liberation-fonts) are used for the UI.

Portal is a work in progress. View the [development task tracker](https://github.com/orgs/School-of-Life-Project/projects/1) to see what's being worked on.