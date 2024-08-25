# short-term project roadmap
subject to change

## pre-beta checklist
Goal: First beta release before Dec 2024

- [X] Improve internal handling of malformed resources
	- [X] Course
		- missing sections
		- uncompletable chapters
		- uncompletable section groups
	- [X] Course Map
		- invalid dependency trees
- [X] Implement JSON Schema generation
- [ ] Add in-app documentation
	- [ ] User documentation
	- [X] Creator documentation
- [ ] Ensure usability on touchscreen devices
- [ ] Write architecture.md
- [ ] Write installation instructions
	- [ ] Write and test offline installation instructions
- [X] Build GH actions release pipeline
- [ ] Perform cross-platform testing

## during-beta checklist
During the Beta period, the focus will shift towards developing tooling and content for the app, rather than developing the app itself.

- [ ] Fix ePub external links
- [ ] Fix ePub sandboxing
- [ ] Add support for panel resizing
- [ ] Improve release packaging
	- [ ] Build for linux aarch64
	- [ ] Build for windows aarch64
- [ ] Add mobile support

## pre-release checklist
- [ ] Better enforce front-end/back-end separation
	- [ ] Write comprehensive backend documentation
	- [ ] Review application security
	- [ ] Review code linting
	- [ ] Review dependencies
- [ ] Write unit tests
	- [ ] Front-end (vitest)
	- [ ] Back-end
- [ ] Subset embedded emoji font
- [ ] Perform testing on legacy platforms

## post-1.0 wishlist
- [ ] Theming?
- [ ] Localization?
- [ ] Description Markdown?
- [ ] Author Metadata?