# Changelog

## v0.9.0 - 16 October 2026 (pre-release)

First tagged release. Everything runs in the browser - no server, no account, nothing you make leaves your device.

### Making a booklet
- Choose paper and booklet size once, when you create the project: A3 to A5 (8 pages), A3 to A4 (4 pages), A4 to A5 (4 pages).
- Up to 5 sheets: 8, 16, 24, 32 or 40 A5 pages from A3.
- Canvas-first: the app opens on your booklet. New booklet lives under Options.
- A live imposition schematic in the setup panel shows how the pages land on the sheet.

### Designing the pages
- Layouts, image and text layers, a layer list with reordering, and a per-page background colour.
- Text styling and an in-app colour picker.
- Built to be used on a laptop, an iPad or an iPhone, with touch-sized targets.

### Printing it correctly
- Print plan: how many sheets, how many pages, and whether to flip the sheet backs on your printer.
- Sheet Preview shows both sides with their page numbers, the fold (dashed blue) and the cut (solid pink). The lines are preview only and are never printed.
- The safe-margin guide marks the sides of a page that sit at the sheet edge, so text does not land in the printer's dead zone.
- Save as PDF for a print shop, or 300 dpi PNGs of each side.

### Guard rails
- Creating a new booklet asks before replacing your work, and "Save it first" really does save first.
- Reducing the sheet count refuses while pages still hold content, and names the offending pages.
- Clear everything asks for confirmation.

### Known gaps - why this is 0.9 and not 1.0
- The 4-page formats (A3 to A4 and A4 to A5) are portrait only.
- There is no A5 paper option yet; A6 and smaller booklets are deferred.
- No bleed or crop marks. Fold-and-slit needs neither, because nothing is trimmed.
- SRA3 is not offered anywhere in the chooser. Booklets saved with it earlier still open and print.
