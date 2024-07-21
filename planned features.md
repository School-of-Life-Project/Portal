# Planned Features
subject to change; this is *not* a set-in-stone roadmap, this is a list of ideas

## Short-term
- performance
	- use documentFragment to minimize DOM updates on first page load
- bug fixes
	- properly handle the case when the user has no courses installed
	- properly handle filesystem lock timeouts
- refactor Course.Textbook.Chapter
- refactor internal progress tracking
	- get rid of offsets.toml, store offset data in CourseProgress files

## Courses

- (optionally) gate-keeping chapters behind previous lessons

### Course Building

#### Short-term
write instructions on how to build a course manually using Sigil (to view the ePub's ToC), a file manager, and a text editor

#### Long-term
- make a Sigil plugin for generating a sidecar JSON file from an ePub file
- make a Sigil plugin to reduce ePub filesize
	- optimize embedded media for smaller filesize
		- images
		- audio
		- fonts
	- minify HTML/CSS/JS/XML
- make a Calibre plugin to turn a set of ePubs into a packaged Course
	- takes a sidecar JSON file as input per-textbook, to add completable sections
	- decompresses ePub files
	- create a central manifest file from the sidecar files
	- compresses course into a LZMA-compressed ZIP file
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
how should Course Maps be best displayed?

### Course Map Building

#### Short term
write instructions on how to create course maps by hand

#### Long term
- add a course map building interface
	- build this into the app?
	- make a separate app / script / plugin for building course maps?

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