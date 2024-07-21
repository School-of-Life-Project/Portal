# Planned Features
subject to change; this is *not* a set-in-stone roadmap, this is a list of ideas

## Short-term
- use documentFragment to minimize DOM updates on first page load
- properly handle the case when the user has no courses installed
- work on internal data structures
	- should user data be easily modifiable externally, or should the app focus on "idiot-proofing" at the expense of customizability? (probably the latter...)
		- for "idiot-proofed" version, load all data into memory at app start and then write data to disk on change or app close in Borsh format
	- should courses & course maps be stored separately from app data (such as keeping app data in $data_dir / $config_dir, while keeping courses in $document_dir)
- properly handle file lock conflicts

## Courses

- (optionally) gate-keeping chapters behind previous lessons
- remove poor PDF support (need to perform high-quality PDF -> ePub conversion on the course creation end)
- remove automatic ePub decompression, require courses to use decompressed ePubs

### Course Building
- make a script to convert from PDF -> ePub via https://github.com/coolwanglu/pdf2htmlEX
	- may not be fully standards-compliant; just needs to be standards compliant *enough* to work in Sigil and in the Portal app
		- aim for full standards compliance if possible, but this may not be reasonably possible
	- need to convert HTML5 -> XHTML via https://stackoverflow.com/questions/12092532/how-to-convert-html-to-valid-xhtml
- make a Sigil plugin for adding Portal manifests to ePubs
- make a Calibre plugin or basic python script to turn a set of ePubs into a valid Course
- change course format:
	- completable chapter manifest embedded within ePub metadata + 1 manifest file per course
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