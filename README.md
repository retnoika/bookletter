# Bookletter

Design an 8, 16, 24, 32, or 40-page A5 booklet on 1 to 5 A3 sheets, or a 4-page booklet on A3 or A4 paper. Print both sides, fold, slit, nest the sections (for multi-sheet), and you have a hand-bound booklet.

## About

Bookletter turns a sheet of paper into a hand-bound booklet. Lay the pages out in the browser, print both sides, fold the sheet, slit the fold — and you have a booklet, with no trimming and no software to install.

It's meant for zines, mini-comics, programmes and other small runs where a home printer or a photocopier is the press. Everything runs in the browser: no server, no account, and nothing you make is uploaded anywhere. It works offline from a downloaded copy, and it's built to be used on an iPad or iPhone as well as a laptop.

**8-page format (A3 → A5):** 8, 16, 24, 32, or 40 pages on 1 to 5 sheets, portrait or landscape A5. Fold twice, slit once.

**4-page format (A3 → A4 or A4 → A5):** 4 pages on one sheet, portrait only. One fold, no slit.

Export any printed side as a 300 dpi PNG for a print shop.

![The Bookletter editor showing a booklet in progress: project settings and layout templates on the left rail, the A5 page canvas in the centre with an image frame, safe-margin guides and page caption, and Layers, Selected Page, Print Safety and Print Plan cards on the right rail](docs/screenshot.png)

## Use online

Open [retnoika.github.io/bookletter](https://retnoika.github.io/bookletter) in any modern browser.

## Use offline

Download this folder and open `index.html` directly in your browser. No internet required—all features work from your local filesystem.

## Support my work
Thank you for supporting my work on Bookletter. 

<a href="https://www.buymeacoffee.com/retnoika"><img src="assets/bmac-matcha-latte@2x.png" alt="Buy me a matcha latte" width="236" height="50"></a>

## Designing your booklet

1. **Choose paper and booklet**: A3 paper offers A4 or A5 booklets; A4 paper offers A5 only
2. **Choose orientation**: Portrait or landscape (4-page formats are portrait only)
3. **Use layout templates**: Click one of the layout icons to add image and text frames to the current page
4. **Add images**: Click an image frame to choose an image, or drag and drop images onto the page
5. **Add text**: Double-click a text layer to edit it inline; press Escape to finish
6. **Set backgrounds**: Choose from preset colours or pick a custom colour — the colour picker is a hue wheel plus a saturation/brightness square, not just presets

Click a layer to select it and see its controls in the inspector panel. The **Layers panel** in the right column lists what is on the page with a thumbnail and a type badge, lets you reorder layers by dragging the grip, and keeps selection in sync with the canvas.

### Keyboard shortcuts

- **Delete / Backspace**: Delete selected layer
- **Escape**: Deselect / finish editing text
- **Arrow keys**: Nudge layer 1 mm (Shift = 5 mm, Alt = 0.1 mm)
- **Ctrl+Z / Cmd+Z**: Undo
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Redo
- **Ctrl+D / Cmd+D**: Duplicate selected layer
- **Ctrl+S / Cmd+S**: Save project file

## Saving and opening

- **Save**: Downloads your project as a `.bookletter.json` file
- **Open**: Load a previously saved project file
- **Autosave**: Your work is automatically saved in your browser

## Printing

Print your finished design on A3 or A4 paper, both sides:

**A3 → A5 booklet (8 pages per sheet):** Print on A3 (297 × 420 mm). Duplex flip on the **long edge** for portrait, **short edge** for landscape.

**A3 → A4 booklet (4 pages per sheet):** Print on A3 landscape (420 × 297 mm). Duplex flip on the **short edge**.

**A4 → A5 booklet (4 pages per sheet):** Print on A4 landscape (297 × 210 mm). Duplex flip on the **short edge**.

Set the **paper size** correctly in the print dialog — if the dialog is left on A4 when you need A3, the content overflows and you get blank pages and a wrong reading order.

1. **Scale**: 100%, no page scaling
2. **Margins**: None
3. **Background graphics**: On

The sheet is flipped over like a book page — printed side down, left edge goes to the right.

An 8-page booklet prints as 2 PDF pages (side 1 and side 2 of one A3 sheet). A 16-page booklet prints 4 pages, a 24-page booklet prints 6, a 32-page booklet prints 8, and a 40-page booklet prints 10. A 4-page booklet prints 2 pages. Browser printing rounds the page box to whole pixels, so it can land within about 0.2 mm of the true sheet size; the content itself is placed in exact millimetres.

### Flip sheet backs

If your printer's double-sided pages come out in the wrong order — side 1 looks correct but side 2 is mirrored — turn on **Flip sheet backs** in the print plan. This swaps the columns on side 2 to compensate for a printer whose duplex flip goes the other way. It is off by default and is a per-device setting stored in the browser, not part of a saved project.

Do a test print on plain paper first with page numbers enabled.

## Exporting for a print shop

Use the **PNG export** buttons to export each sheet side as a 300 dpi image file:

- A3 (297 × 420 mm) → 3508 × 4961 pixels
- A4 (210 × 297 mm) → 2480 × 3508 pixels

## Checking your pages

The **Print safety** panel in the editor checks your design for common print problems:

- Text crossing the safe margin (reported as a count of layers, along with the margin width)
- Images crossing the safe margin (reported separately — an image bleeding off the edge is usually intentional, text getting trimmed is not)
- Images placed larger than their resolution allows (reports effective dpi)

You can set the safe margin width in millimetres using the input next to the Margin guide chip.

When everything is fine, the panel says "No print-safety issues found."

## Safe margin

Some printers cannot print to the very edge of the sheet. Enter your printer's unprintable border in millimetres and the canvas draws a dashed blue line showing the safe area.

The line only appears on the sides of a page that are at the edge of the sheet — the sides where the page is folded print fine, so the guide is not a full rectangle.

The guide never prints or exports.

## Folding

### 8-page format (fold twice, slit once)

After printing each sheet:

1. Place the sheet with side 1 facing up, page numbers along the bottom
2. Fold the top half **back behind** the sheet
3. Fold the left half **back behind** the right half
4. Slit the folded top edge with a craft knife so the pages open

### 4-page format (one fold, no slit)

1. Place the sheet with side 1 facing up
2. Fold along the vertical centre line so page 1 is on top

### Multi-sheet nesting

For multi-sheet booklets (16, 24, 32, or 40 pages), after folding each sheet:

5. **Nest the sections**: Place each inner sheet inside the one before it (sheet 2 inside sheet 1, sheet 3 inside sheet 2, and so on)
6. The outermost section (sheet 1) has pages 1-8; each subsequent sheet carries the next 8 pages (sheet 2 = pages 9-16, sheet 3 = pages 17-24, sheet 4 = pages 25-32, sheet 5 = pages 33-40)
7. Stitch or staple through all layers along the spine

This is saddle-stitch binding. Reading order runs straight through: 1, 2, 3, ... all the way to the last page.

## Legacy projects

Projects saved with SRA3 paper stock (an earlier option) still open and print correctly. SRA3 is not offered in the current chooser.

## Development

### Testing tools

**Fold verification** — checks that imposition tables produce correct reading order:
```bash
node tools/fold-check.js              # 8 pages (default, 2x2 format)
node tools/fold-check.js --pages=16   # 16 pages
node tools/fold-check.js --pages=40   # 40 pages (5 sheets)
node tools/fold-check.js --all        # all valid page counts for 2x2
```

**Icon verification** — checks that all `BL.icon()` calls have matching icon definitions:
```bash
node tools/icon-check.js
```

Both tools exit 0 on success, 1 on failure.

## Credits

- **App icon**: ['Service'](https://www.flaticon.com/free-icon/service_13830467) by pikepicture, Flaticon, free licence (attribution required)
- **Fonts**: Fraunces and DM Sans (SIL Open Font License), vendored in `assets/fonts`
- **Icons**: Tabler Icons (MIT License), vendored in `assets/icons`
- **Bookletter**: MIT License
