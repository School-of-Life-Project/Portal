# short-term project roadmap
subject to change

## pre-beta checklist
- [X] Improve internal handling of malformed resources
	- [X] Course
		- missing sections
		- uncompletable chapters
		- uncompletable section groups
	- [X] Course Map
		- invalid dependency trees
- [X] Implement JSON Schema generation
- [X] Add in-app documentation
	- [X] User documentation
	- [X] Creator documentation
- [X] Prevent database & filesystem errors from causing app startup to fail
- [X] Add additional sections to README
	- [X] Installation Instructions
	- [X] Application architecture
- [X] Build GH actions release pipeline

## during-beta checklist
During the Beta period, the focus will shift towards developing tooling and content for the app, rather than developing the app itself.

- [X] Add builds for ARM Linux
- [ ] Fix external links in document viewer
- [ ] Add support for panel resizing
- [ ] Add mobile support?
	- Currently blocked by mobile-specific issues with open() and app_data_dir
- [ ] Perform cross-platform testing

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
