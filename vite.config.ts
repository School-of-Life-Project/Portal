import { resolve } from "path";
import { defineConfig } from "vite";
import eslint from "vite-plugin-eslint";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import legacy from "@vitejs/plugin-legacy";
import { createWriteStream, existsSync, mkdirSync } from "fs";

if (!existsSync("node_modules/jszip/dist/jszip.js")) {
	mkdirSync("node_modules/jszip/dist");

	// Hack required to get ePub.js to build without jszip
	const writeStream = createWriteStream("node_modules/jszip/dist/jszip.js");
	writeStream.write("module.exports = {};");
	writeStream.end();
}

// Tauri uses Edge on Windows and WebKit on macOS and Linux
const targets =
	process.env.TAURI_PLATFORM == "windows" ? "edge>=89" : "safari>=12";

// Consider browser versions released since 2023 as modern
const modernTargets =
	process.env.TAURI_PLATFORM == "windows" ? "edge>=109" : "safari>=16.3";

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
		"TAURI_PLATFORM",
		"TAURI_ARCH",
		"TAURI_FAMILY",
		"TAURI_PLATFORM_VERSION",
		"TAURI_PLATFORM_TYPE",
		"TAURI_DEBUG",
	],
	build: {
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
			},
		},
	},
	css: {
		transformer: "lightningcss",
		lightningcss: {
			targets: browserslistToTargets(browserslist(targets)),
		},
	},
	plugins: [
		eslint(),
		legacy({
			targets,
			additionalLegacyPolyfills: [],
			modernTargets,
		}),
	],
});
