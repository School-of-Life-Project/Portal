# short-term project roadmap
subject to change

## pre-beta checklist
Goal: First beta release before Dec 2024

- [ ] Improve validation
	- [ ] Course
		- empty courses
		- uncompletable chapters
		- uncompletable section groups
	- [ ] Course Map
		- empty course maps
		- invalid dependency trees
- [ ] Implement JSON Schema generation
- [ ] Add in-app documentation
	- [ ] User documentation
	- [ ] Creator documentation
- [ ] Add mobile support
	- [ ] Ensure usability on touchscreen devices
- [ ] Write architecture.md
- [ ] Build GH actions release pipeline
- [ ] Perform cross-platform testing

## during-beta checklist
During the Beta period, the focus will shift towards developing tooling and content for the app, rather than developing the app itself.

- [ ] Fix ePub external links
- [ ] Fix ePub sandboxing
- [ ] Add support for panel resizing

## pre-release checklist
- [ ] Better enforce front-end/back-end separation
	- [ ] Write comprehensive backend documentation
	- [ ] Review application security
	- [ ] Review code linting
	- [ ] Review dependencies
- [ ] Add localization support
- [ ] Write unit tests
	- [ ] Front-end (vitest)
	- [ ] Back-end
- [ ] Subset embedded emoji font
- [ ] Perform testing on legacy platforms

## post-1.0 wishlist
- [ ] Theming?
- [ ] Description Markdown?
- [ ] Author Metadata?