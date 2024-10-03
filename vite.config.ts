import { resolve } from "path";
import { defineConfig } from "vite";
import eslint from "vite-plugin-eslint";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { createHtmlPlugin } from "vite-plugin-html";
import { createWriteStream, existsSync, mkdirSync } from "fs";

if (!existsSync("node_modules/jszip/dist/jszip.js")) {
	mkdirSync("node_modules/jszip/dist");

	// Hack required to get ePub.js to build without jszip
	const writeStream = createWriteStream("node_modules/jszip/dist/jszip.js");
	writeStream.write("module.exports = {};");
	writeStream.end();
}

export default defineConfig({
	// prevent vite from obscuring rust errors
	clearScreen: false,
	// Tauri expects a fixed port, fail if that port is not available
	server: {
		strictPort: true,
	},
	// to access the Tauri environment variables set by the CLI with information about the current target
	envPrefix: [
		"VITE_",
		"TAURI_ENV_PLATFORM",
		"TAURI_ENV_ARCH",
		"TAURI_ENV_FAMILY",
		"TAURI_ENV_PLATFORM_VERSION",
		"TAURI_ENV_PLATFORM_TYPE",
		"TAURI_ENV_DEBUG",
	],
	build: {
		// Tauri uses Edge on Windows and WebKit on macOS and Linux
		target: process.env.TAURI_ENV_PLATFORM == "windows" ? "edge89" : "safari15",
		minify: "terser",
		cssMinify: "lightningcss",
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				viewer: resolve(__dirname, "viewer.html"),
				subviewer: resolve(__dirname, "subviewer.html"),
				error: resolve(__dirname, "error.html"),
				navigator: resolve(__dirname, "navigator.html"),
				settings: resolve(__dirname, "settings.html"),
				guide: resolve(__dirname, "guide.html"),
			},
		},
	},
	css: {
		transformer: "lightningcss",
		lightningcss: {
			targets: browserslistToTargets(
				browserslist(
					// Tauri uses Edge on Windows and WebKit on macOS and Linux
					process.env.TAURI_ENV_PLATFORM == "windows"
						? "edge>=89"
						: "safari>=15",
				),
			),
		},
	},
	plugins: [eslint(), createHtmlPlugin({ minify: true })],
});
