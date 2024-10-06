if [ -f src-tauri/tauri-hardened.json ]; then
	mv src-tauri/tauri.conf.json src-tauri/tauri.conf.json.old
	mv src-tauri/tauri-hardened.json src-tauri/tauri.conf.json

	echo "Successfully applied application hardening. Rerun the compiler to create a hardened build."
fi