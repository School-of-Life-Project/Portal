# Planned Features
subject to change; this is *not* a set-in-stone roadmap, this is a list of ideas

## Courses

- (optionally) gate-keeping chapters behind previous lessons
- remove poor PDF support (need to perform high-quality PDF -> ePub conversion on the course creation end)
- add support for single-document HTML courses
	- save scroll position, use scroll position to track progress

### Course Building
- make a sigil plugin for adding Portal manifests to ePubs
- make a calibre plugin to turn a set of ePubs into a Course
	- also perform on-the-fly conversion to PDFs to HTML via https://github.com/coolwanglu/pdf2htmlEX
- change course format:
	- 1 manifest file per ePub (embedded within ePub) + 1 manifest file per course
- make a script to convert various open-access textbooks into high-quality ePubs
	- scrape online viewers to get raw HTML whenever possible
	- see https://tex.stackexchange.com/questions/1551/use-latex-to-produce-epub
	- make a torrent of these converted books?

## Course Management

- interactively enabling/disabling courses
- interactively marking courses as complete/incomplete
- viewing additional course metadata (author, year created, title & description, etc...)
- create a centralized hub to find and download courses?

### Course Maps
a graphed, color-coded course dependency tree
- color code by subject, course completion status
- allow specifying alternate/equivalent courses
- allow specifying corequisites in addition to prerequisites

how should this tree be displayed?

### Course Map Building
- add a course map building interface
	- build this into the app?
	- make a calibre plugin for building course maps?
	- something else?

## App
- should support a wide range of devices
	- eventually add mobile support?
	- support all widely used OSes: Windows, Mac, and Linux
- should support a wide range of OS versions
- should be very user-friendly and reliable
- should be as performant as reasonably possible
	- needs to run well on older devices
- should include all tools a learner is likely to need
	- excluding tools built into the base operating system, such as a calculator, note-taking app, and browser
- ship a user guide as a built-in course

### display settings
- theming
- allow enabling/disabling all non-core features
- add localization support?

## Packaging
- ship an example course map that contains a variety of courses, covering a variety of topics