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

### misc
- [ ] Add additional Clippy lints
- [ ] Prune dependencies

### during-beta checklist
- [ ] Add support for panel resizing
- [ ] Fix ePub external links
- [ ] Fix ePub sandboxing

## pre-release checklist
Goal: First release within 2025

- [ ] Better enforce front-end/back-end separation
	- [ ] Write comprehensive backend documentation
	- [ ] Review application security
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