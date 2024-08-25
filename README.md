# Portal

Portal is an app built for independent learners.

Unlike most eLearning applications, Portal is focused on making use of existing learning materials. Any textbook or set of textbooks can be converted into a Portal-compatible course, as long as it is available in the ePub format.

In addition, Portal is designed to function well on a wide variety of hardware configurations and does not require an internet connection to use.

## For Users

> [!WARNING]
> Portal is currently a work in progress, and is not yet ready for use by end users.

App releases can be found on the [releases page](https://github.com/School-of-Life-Project/Portal-App/releases/). Platform-specific installation instructions are provided below.

### Windows

Download and run the `.msi` file from the release you wish to install. Follow the prompts provided to install the application.

> [!NOTE]
> If the device you are installing the application on does not have an internet connection, you will need to install the [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download) before running the installer. This step can be skipped on Windows 10 and 11.

### MacOS

Download and mount the `.dmg` file from the release you wish to install. Drag the application into the Applications folder, and then unmount the disk image.

> [!TIP]
> If the application fails to start after installation, open Terminal and run the following command:
>
> ```bash
> xattr -d com.apple.quarantine /Applications/school-of-life-portal.app
> ```

### Linux

On Linux, installation instructions are distribution-specific.

Alterntively, you can download the `.AppImage` with the appropriate CPU architecture for your device. [AppImage](https://appimage.org) files are portable binaries which can be run on any distribution.

#### DPKG-based distros

Download the `.deb` with the appropriate CPU architecture for your device.

Then, run the following commands as root:

```bash
apt install libwebkit2gtk-4.1-0 libgtk-3-0
dpkg -i school-of-life-portal_*.deb
```

#### RPM-based distros

**TODO**

## Building

You will need Cargo (Rust's Package Manager) and NPM (Node.js' package manager) to build this application.

First, install the app's dependencies.

```bash
npm install
```

Then, you can:
- run the app in development mode with `npx tauri dev`
- build an optimized binary with `npx tauri build`
