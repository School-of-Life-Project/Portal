# course files

- need to be easily user-readable
- need to be easily user-modifable

## structure

- $APPDATA
	- /course_maps/{name}.toml
	- /courses/{uuid}/
		- course.toml
		- accompanying course files
		- automatically decompress .zip files
	- /progress/
		- /courses/{uuid}.toml
		- active.toml