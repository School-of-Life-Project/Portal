# Portal

Portal is an app built for independent learners.

Unlike most eLearning applications, Portal is focused on making use of existing learning materials. Any textbook or set of textbooks can be converted into a Portal course, as long as it is available in the EPUB format.

Portal is designed to perform well on low-end hardware and does not require an internet connection to use. It can run on Windows >= 7, macOS >= 10.15, and popular Linux distributions.

## Installing

> [!WARNING]
> Portal is a work in progress. Please check for app updates frequently, and report any issues you find.

App releases can be found on the [releases page](https://github.com/School-of-Life-Project/Portal-App/releases/). Platform-specific installation instructions are provided below.

### Windows

Download and run the `.msi` file from the release you wish to install. Follow the prompts provided to install the application.

> [!IMPORTANT]
> If the device you are installing the application on does not have an internet connection, you will need to install the [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download) before running the installer. Windows 10 (version 1803 and later) and 11 come with WebView2 preinstalled.

> [!NOTE]
> If your device is 32-bit or ARM, you will need to [build the application from source code](https://github.com/School-of-Life-Project/Portal-App/#building).

### MacOS

Download and mount the `.dmg` file from the release you wish to install. Drag the application into the Applications folder, and then unmount the disk image.

> [!IMPORTANT]
> If the application fails to start after installation, open Terminal and run the following command:
>
> ```bash
> xattr -d com.apple.quarantine /Applications/Portal.app
> ```

### Linux

On Linux, installation instructions are distribution-specific.

> [!NOTE]
> If you are using a lesser-used CPU architecture, you will need to [build the application from source code](https://github.com/School-of-Life-Project/Portal-App/#building).

#### DPKG-based distros

Download the `.deb` with the appropriate CPU architecture for your device.

Then, run the following commands as root:

```bash
apt install libwebkit2gtk-4.1-0 libgtk-3-0 fonts-liberation2
dpkg -i Portal_*.deb
```

#### RPM-based distros

Download the `.rpm` with the appropriate CPU architecture for your device.

Then, run the following command as root:

```bash
dnf install Portal-*.rpm
```

## Usage

Portal has a built-in user manual, which should be read if you are unfamiliar with the app. This can be accessed by pressing the `📜 Guide` button on the app's home screen.

[Find courses created by other users](https://github.com/School-of-Life-Project/Portal-App/discussions/categories/show-and-tell?discussions_q=is%3Aopen+category%3A%22Show+and+tell%22+sort%3Atopl)
