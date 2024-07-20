# Planned Features
subject to change; this is *not* a roadmap, this is a list of ideas

## Courses

- (optionally) gate-keeping chapters behind previous lessons
- remove poor PDF support (need to perform high-quality PDF -> ePub conversion on the course creation end)

### Course Building
- create a separate app for building courses
	- make this a calibre plugin?
- make a script to convert various formats to ePub
	- PDF -> ePub via https://github.com/coolwanglu/pdf2htmlEX
	- LaTeX -> ePub via https://tex.stackexchange.com/questions/1551/use-latex-to-produce-epub
- make a script to convert various open-access textbooks into high-quality ePubs
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