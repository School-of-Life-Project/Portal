# course files

- need to be easily user-readable
- need to be easily user-modifable

## structure

- $APPDATA
	- /course_maps/{name}.v1.toml
	- /courses/{uuid}/
		- course.v1.toml
		- accompanying course files
		- automatically decompress .zip files
	- /progress/
		- {uuid}.toml
		- active.toml