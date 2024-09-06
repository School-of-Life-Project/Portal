# Portal

Portal is an app built for independent learners.

Unlike most eLearning applications, Portal is focused on making use of existing learning materials. Any textbook or set of textbooks can be converted into a Portal-compatible course, as long as it is available in the ePub format. Users can [find courses created by other users](https://github.com/School-of-Life-Project/Portal-App/discussions/categories/show-and-tell?discussions_q=is%3Aopen+category%3A%22Show+and+tell%22+sort%3Atopl) and discuss possible improvments to the app on the [discussion board](https://github.com/School-of-Life-Project/Portal-App/discussions).

Portal is designed to perform well on low-end hardware and does not require an internet connection to use. It can run on Windows >= 7, macOS >= 10.15, and popular Linux distributions.

## Installing

> [!WARNING]
> Portal is a work in progress. Please check for app updates frequently, and report any issues you find.

App releases can be found on the [releases page](https://github.com/School-of-Life-Project/Portal-App/releases/). Platform-specific installation instructions are provided below.

### Windows

Download and run the `.msi` file from the release you wish to install. Follow the prompts provided to install the application.

> [!NOTE]
> If the device you are installing the application on does not have an internet connection, you will need to install the [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download) before running the installer. Windows 10 (version 1803 and later) and 11 come with WebView2 preinstalled.

> [!NOTE]
> If your device is 32-bit, you will need to [build the application from source code](#building).

### MacOS

Download and mount the `.dmg` file from the release you wish to install. Drag the application into the Applications folder, and then unmount the disk image.

> [!TIP]
> If the application fails to start after installation, open Terminal and run the following command:
>
> ```bash
> xattr -d com.apple.quarantine /Applications/Portal.app
> ```

### Linux

On Linux, installation instructions are distribution-specific.

> [!NOTE]
> If you are using a lesser-used CPU architecture, you will need to [build the application from source code](#building).

#### DPKG-based distros

Download the `.deb` with the appropriate CPU architecture for your device.

Then, run the following commands as root:

```bash
apt install libwebkit2gtk-4.1-0 libgtk-3-0
dpkg -i Portal_*.deb
```

#### RPM-based distros

Download the `.rpm` with the appropriate CPU architecture for your device.

Then, run the following command as root:

```bash
dnf install Portal-*.rpm
```

## Known Issues
- In some EPUB documents, navigation using the Table of Contents is broken. This is a bug and will be fixed in the next release.
- The tab order of Course Map items is incorrect. This is a bug and will be fixed in the next release.
- External links are broken inside the textbook viewer. This is caused by [a bug in Tauri](https://github.com/tauri-apps/tauri/issues/9912).
- When compiling Portal as a Linux AppImage, external links and folder buttons are broken. This is caused by [a bug in Tauri](https://github.com/tauri-apps/tauri/issues/6172).
- When compiling Portal for mobile platforms, the "Open Resource Folder" and "Open Data Folder" buttons do not function correctly.

## Building

You will need [Rust](https://www.rust-lang.org/tools/install) and [Node.js](https://nodejs.org/en/download) to build this application. In addition, you will need to install the build dependencies for [Tauri](https://v2.tauri.app/start/prerequisites/).

After installing the required dependencies, run the following command in the repository folder:

```bash
npm install
```

Then, you can:
- run the application in development mode with `npx tauri dev`
- build an optimized desktop binary with `npx tauri build`

## Architecture

Portal is built using [Tauri](https://tauri.app) and [Vite](https://vitejs.dev).

The Rust-based backend of the application is used to load resources from disk and manage the state of the [embedded database](https://github.com/spacejam/sled). The TypeScript-based frontend of the application is used to render UI elements and display textbooks using [epub.js](https://github.com/futurepress/epub.js/). UI icons are provided by [OpenMoji](https://openmoji.org).

Portal is a work in progress. See the [development roadmap](TODO.md) for more information.