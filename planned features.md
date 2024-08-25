# Planned Features
subject to change

## Course Building

### Short-term
- documentation
	- write instructions on how to build a course manually using Sigil (to view the ePub's ToC), a file manager, and a text editor
	- note: app only supports up to ePub 3.2, ePub 3.3 is not fully supported

### Long-term
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

- create a centralized hub to find and download courses?

### Course Map Building

#### Short term
write instructions on how to create course maps by hand

#### Long term
- add a course map building interface
	- make a separate app / script / plugin for building course maps?

## Packaging
- ship an example course map that contains a variety of courses, covering a variety of topics