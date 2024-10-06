sed -e 's/⚠ You should only import resources from creators you trust\. Malicious resources could pose a security risk\./⚠ You are running a hardened version of Portal. Some resources may not function properly./g' guide.html

rm src-tauri/tauri.conf.json
mv src-tauri/tauri-hardened.json src-tauri/tauri.conf.json
