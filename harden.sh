if [ -f src-tauri/tauri-hardened.json ]; then
	rm src-tauri/tauri.conf.json
	mv src-tauri/tauri-hardened.json src-tauri/tauri.conf.json

	echo "Successfully applied application hardening. Rerun the compiler to create a hardened build."
fi