# Bookletter Design Notes

Bookletter is a browser-only tool for designing 8-page A5 booklets that print on a single A3 sheet (both sides), fold twice, and become a hand-bound booklet.

## Architecture

### File Structure
```
index.html           Entry point
css/app.css          All styles
js/00-state.js       State model, defaults, factories, undo/redo
js/10-templates.js   Layout templates, shape SVG library
js/20-render.js      DOM rendering (shared by editor, thumbnails, print)
js/30-editor.js      Selection, inspector, keyboard, photos
js/40-persist.js     Autosave, project I/O
js/90-boot.js        Boot, wiring, test API
```

### Data Model

All geometry is stored in **millimetres** (origin = top-left of page). Never pixels.

```js
State = {
  v: 2,                          // schema version
  title: 'untitled booklet',
  orient: 'portrait'|'landscape', // page orientation
  sheet: 'A3'|'SRA3',            // print sheet size
  guide: true,                   // show margin guide
  safe: 8,                       // mm safe margin
  nums: false,                   // show page numbers
  pages: [Page × 8]
}

Page = {
  bg: '#ffffff',                 // background color
  layers: [Layer...]             // z-order: last is topmost
}

Layer = {
  id: 'l1',
  kind: 'photo'|'text'|'shape',
  x, y, w, h,                    // mm, page coordinates
  rot: 0,                        // degrees, around center
  opacity: 1,
  // photo: src, fit, px, py
  // text: text, font, size, align, bold, color, line
  // shape: shape, color, stroke, strokeWidth (≥0.25mm)
}
```

### Rendering

Pages render via a `--mm` CSS variable. The same `renderPage()` function works at any scale:
- Thumbnails: `--mm: 0.55px`
- Editor: `--mm: ~2.4px` (fit to viewport)
- Print: `--mm: 1mm`

---

## Verified Imposition Facts

These are the authoritative facts for sheet layout and folding. Do not modify.

### Page Geometry

- **8 pages per booklet**
- Page = A5: portrait **148 × 210 mm** or landscape **210 × 148 mm**
- One A3 sheet (**297 × 420 mm**) holds a 2×2 block of pages per side = 4 per side = **8 total**

### Sheet Sizes

- **A3**: 297 × 420 mm — exactly four A5 pages, no bleed, no room for marks
- **SRA3**: 320 × 450 mm — room for crop marks, fold marks, and bleed

### Duplex Printing

- Side 1 printed first
- **Flip on the long edge** (short edge for landscape sheet) — back appears mirrored left/right, book-style

### Imposition Grid

**Side 1** (sheet frame; row 0 = top):
```
[[5, 4], [8, 1]]
```
Top row rotated 180°.

**Side 2** (as drawn in side-2 frame; row 0 = top):
```
[[3, 6], [2, 7]]
```
Top row rotated 180°.

### Cell Placement

```
left = (sheetW − 2·pageW)/2 + col·pageW
top  = (sheetH − 2·pageH)/2 + row·pageH
```
Each cell is the page size. Top-row cells rotate 180° about their center.

### Why This Order

- Page 1 must be bottom-right quadrant (only panel facing reader after both folds)
- Page 8 sits beside it, bottom-left
- Top row ends up folded behind → prints upside down
- Long-edge duplex flip mirrors back side left/right → side 2 reads `[[3, 6], [2, 7]]`

### Margins and Bleed

- A3 holds exactly 4 A5 pages with ~0.5 mm spare — **no bleed, no marks**
- Content must stay inside the safe margin (default 8 mm)
- SRA3 provides room for crop/fold marks and bleed

### Folding Instructions

1. Side 1 facing you, with `8 | 1` along the bottom
2. Fold the top half **back behind** the sheet
3. Fold the left half **back behind** the right half
4. Page 1 is the cover; the left fold is the spine
5. Slit the top fold with a craft knife so the pages open
6. Stitch or staple the spine

---

## Measured Print Facts

Printing via the browser produces a 2-page PDF where each page corresponds to one side of the printed sheet. The PDF page box lands within about 0.2mm of the true sheet size because browsers round `@page` millimetres to whole CSS pixels; the content itself is placed in exact mm using CSS calc.

**A3 (297 × 420 mm)**: No crop or fold marks. The 2×2 page block fits with only 0.5mm spare per side horizontally (1mm total) and 0mm vertically.

**SRA3 (320 × 450 mm)**: 8 crop-mark lines (2 per corner) and 4 fold-mark lines (one at each edge midpoint). Room for 3mm bleed when enabled.

---

## Current Status

**Implemented:**
- Editor with photo, text, and shape layers
- 8 layout templates (additive application to current page)
- Direct manipulation: move, resize, rotate layers with mouse or touch
- Snapping to margins, centers, and other layer edges
- Photo pan inside frame (Alt+drag or inspector toggle)
- Two-finger pinch to scale on touch devices
- Undo/redo (40-entry stack)
- Keyboard shortcuts (delete, nudge, duplicate, save)
- Autosave (IndexedDB with localStorage fallback)
- Project save/open (.bookletter.json files)
- Imposition preview with live sheet thumbnails
- Print path: `@page` sized dynamically to sheet, 2-page output
- A3 and SRA3 sheet stock selection
- Crop and fold marks on SRA3
- Bleed (0mm or 3mm) on SRA3; refused on A3
- Fold instructions adapted to current stock and orientation

**Not yet implemented:**
- 300 DPI PNG export per sheet
- Print-safety warnings for safe-margin crossings and low-resolution photos
