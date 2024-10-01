svgexport public/icon.svg app-icon.png 8192:8192
npx tauri icon
rm -r src-tauri/icons/android
rm -r src-tauri/icons/ios
rm app-icon.png

oxipng --zopfli -o max --strip all src-tauri/icons/*.png

rm docs/icon.png
cp src-tauri/icons/128x128.png docs/icon.png