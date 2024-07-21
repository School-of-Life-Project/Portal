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
- properly support MathML in ePubs
	- see https://github.com/futurepress/epub.js/blob/f09089cf77c55427bfdac7e0a4fa130e373a19c8/examples/mathml.html#L154
	- see https://www.npmjs.com/package/katex

## Courses

- (optionally) gate-keeping chapters behind previous lessons
- remove poor PDF support
- remove automatic ePub decompression, require courses to use decompressed ePubs

### Course Building
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