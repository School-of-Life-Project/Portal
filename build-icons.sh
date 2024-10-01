rm -r src-tauri/icons

svgexport icons/web-icon.svg app-icon.png 8192:8192
npx tauri icon
rm docs/icon.png
cp src-tauri/icons/128x128.png docs/icon.png
rm app-icon.png

rm -r src-tauri/icons

svgexport icons/app-icon.svg app-icon.png 8192:8192
npx tauri icon
rm -r src-tauri/icons/android
rm -r src-tauri/icons/ios
rm app-icon.png