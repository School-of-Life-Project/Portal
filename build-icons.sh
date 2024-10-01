svgexport public/web-icon.svg app-icon.png 1024:1024
npx tauri icon
rm docs/icon.png
cp src-tauri/icons/128x128.png docs/icon.png
rm app-icon.png

svgexport public/app-icon.svg app-icon.png 4096:4096
npx tauri icon
rm -r src-tauri/icons/android
rm -r src-tauri/icons/ios
rm app-icon.png

oxipng --zopfli -o max --strip all docs/icon.png
oxipng --zopfli -o max --strip all src-tauri/icons/*.png

iconutil --convert iconset src-tauri/icons/icon.icns
rm src-tauri/icons/icon.icns
oxipng --zopfli -o max --strip all src-tauri/icons/icon.iconset/*.png
iconutil --convert icns src-tauri/icons/icon.iconset
rm -r src-tauri/icons/icon.iconset

mkdir src-tauri/icons/icon.ico.images
icotool -x src-tauri/icons/icon.ico -o src-tauri/icons/icon.ico.images
oxipng --zopfli -o max --strip all src-tauri/icons/icon.ico.images/*.png
icotool -c -r src-tauri/icons/icon.ico.images/icon_1_*.png -r src-tauri/icons/icon.ico.images/icon_2_*.png -r src-tauri/icons/icon.ico.images/icon_3_*.png -r src-tauri/icons/icon.ico.images/icon_4_*.png -r src-tauri/icons/icon.ico.images/icon_5_*.png -r src-tauri/icons/icon.ico.images/icon_6_*.png -o src-tauri/icons/icon.ico
rm -r src-tauri/icons/icon.ico.images