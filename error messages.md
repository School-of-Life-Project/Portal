# Possible UI Error Messages

## Other

If the application fails to start, it is either a Filesystem Error, a Database Error, or an OS Error.

## Backend

### Application Bug

- An internal error occured

### OS Errors

- Unable to open handler for path {path}
- Unable to open URL {path}

### Malformed Resources

- Unable to get Course {id}
- Unable to get Course Map {uuid}

### Filesystem Errors

- Unable to check if Course exists
- Unable to get Course and CourseMap list

### Database Errors

- Unable to get list of active Courses
- Unable to get progress for Course {id}
- Unable to update progress for Course {uuid}
- Unable to update list of active Courses
- Unable to get overall progress
- Unable to get Settings
- Unable to update Settings

## Frontend

### Application Bug

- An internal error occured

### Malformed Resources

- Unable to display Course {id}
	- Cause: Unable to find section {id}
	- Cause: Unable to find chapter root {id}
- Unable to display Course Map {id}
	- Cause: Course {id} does not exist