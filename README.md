# Bookletter

Design an 8-page A5 booklet and print it on one A3 sheet, both sides. Fold twice, slit one fold, and you have a hand-bound booklet.

## Use online

Open [retnoika.github.io/bookletter](https://retnoika.github.io/bookletter) in any modern browser.

## Use offline

Download this folder and open `index.html` directly in your browser. No internet required—all features work from your local filesystem.

## Designing your booklet

1. **Choose orientation**: Portrait A5 (148 × 210 mm) or Landscape A5 (210 × 148 mm)
2. **Use layout templates**: Click one of the layout icons to add photo and text frames to the current page
3. **Add images**: Click a photo frame to choose an image, or drag and drop images onto the page
4. **Add text**: Double-click a text layer to edit it inline; press Escape to finish
5. **Add shapes**: Use the Shape button to add decorative elements
6. **Set backgrounds**: Choose from preset colors or pick a custom color

Click a layer to select it and see its controls in the inspector panel.

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

Print your finished design on A3 paper, both sides:

**Portrait A5 pages** → print on A3 portrait (297 × 420 mm), duplex flip on the **long edge**

**Landscape A5 pages** → print on A3 landscape (420 × 297 mm), duplex flip on the **short edge**

1. **Scale**: 100%, no page scaling
2. **Margins**: None
3. **Background graphics**: On

The app prints exactly two pages — side 1 and side 2. Browser printing rounds the page box to whole pixels, so it can land within about 0.2 mm of the true sheet size; the content itself is placed in exact millimetres.

Do a test print on plain paper first with page numbers enabled.

## Exporting for a print shop

Use the **PNG 1** and **PNG 2** buttons to export each sheet side as a 300 dpi image file:

- A3 (297 × 420 mm) → 3508 × 4961 pixels
- SRA3 (320 × 450 mm) → 3780 × 5315 pixels

When SRA3 stock is selected, the PNGs include crop marks at the corners and fold marks at the midpoints.

## Checking your pages

The **Print safety** panel in the editor checks your design for common print problems:

- Layers that cross the safe margin (reports how far, in mm)
- Photos placed larger than their resolution allows (reports effective dpi)
- Shape strokes thinner than 0.25 mm

When everything is fine, the panel says "No print-safety issues found."

## Folding

After printing:

1. Place the sheet with side 1 facing up, pages 8 and 1 along the bottom
2. Fold the top half **back behind** the sheet
3. Fold the left half **back behind** the right half
4. Page 1 is now your cover; the left fold is the spine
5. Slit the folded top edge with a craft knife so the pages open
6. Stitch or staple along the spine to bind
