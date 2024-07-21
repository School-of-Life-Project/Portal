# Planned Features
subject to change; this is *not* a set-in-stone roadmap, this is a list of ideas

## Short-term
- use documentFragment to minimize DOM updates on first page load
- properly handle the case when the user has no courses installed
- change internal data structures
	- store courses and course maps in $document_dir/Portal
		- update UI to separate $app_document_dir and $app_data_dir
	- store user data in nativeDB (kept in $data_dir/$app_id)
		- remove need for file locking
- ensure that MathML-containing ePubs display properly
- test ePub.js browser support

## Courses

- (optionally) gate-keeping chapters behind previous lessons
- remove poor PDF support
- remove automatic ePub decompression

### Course Building
note: this will require **significant changes to the course format**

- make a Sigil plugin for adding Portal manifests to ePubs
	- store chapter manifest within ePub metadata
	- (optional) lossily compress images
		- possibly convert WebP images to JPEG if epub.js works on Safari <16?
- make a Calibre plugin to turn a set of ePubs into a packaged Course
	- decompress ePub files
	- create a central manifest file
	- compress course into a LZMA-compressed ZIP file
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