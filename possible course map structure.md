# course map structure

- id: Uuid
- title: String
- courses: CourseMapItem[]
	- course: Uuid
	- group: number
	- corequisites: Uuid[]
	- prerequisites: Uuid[]

## rendering

grouping, color coding

allow interactively adjusting course enabled/disabled status

## todo:

use documentFragment to minimize DOM updates on first page load

add additional fields to Course object to allow for additional problem books / additional material

add secondary/optional/reference books to Course object
- these do not count towards course completion
- however, their completion can still be tracked, and can be displayed on the homescreen (but are displayed in a distintly different way from primary Coursebooks)