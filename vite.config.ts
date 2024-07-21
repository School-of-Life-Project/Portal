import { resolve } from "path";
import { defineConfig } from "vite";
import eslint from "vite-plugin-eslint";
import legacy from "@vitejs/plugin-legacy";
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
		"TAURI_PLATFORM",
		"TAURI_ARCH",
		"TAURI_FAMILY",
		"TAURI_PLATFORM_VERSION",
		"TAURI_PLATFORM_TYPE",
		"TAURI_DEBUG",
	],
	build: {
		// Tauri uses Edge on Windows and WebKit on macOS and Linux
		target: process.env.TAURI_PLATFORM == "windows" ? "edge109" : "safari12",
		// don't minify for debug builds
		minify: !process.env.TAURI_DEBUG ? "terser" : false,
		cssMinify: "lightningcss",
		// produce sourcemaps for debug builds
		sourcemap: !!process.env.TAURI_DEBUG,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				viewer: resolve(__dirname, "viewer.html"),
				error: resolve(__dirname, "error.html"),
			},
		},
		chunkSizeWarningLimit: 550,
	},
	css: {
		transformer: "lightningcss",
	},
	plugins: [
		eslint(),
		legacy({
			targets:
				process.env.TAURI_PLATFORM == "windows" ? "edge>=109" : "safari>=12",
			additionalLegacyPolyfills: [],
			modernTargets:
				process.env.TAURI_PLATFORM == "windows"
					? "last 10 Edge versions"
					: "safari>=15.6",
		}),
	],
});
