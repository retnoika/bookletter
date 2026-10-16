# Bookletter Design Notes

Bookletter is a browser-only tool for designing booklets. The 8-page format (A3 → A5) produces 8, 16, 24, 32, or 40-page A5 booklets on 1 to 5 A3 sheets. The 4-page format (A3 → A4 or A4 → A5) produces a 4-page booklet on one sheet. Print both sides, fold, nest the sections, and you have a hand-bound booklet.

## Architecture

### File Structure
```
index.html           Entry point
css/app.css          All styles
js/00-state.js       State model, defaults, factories, undo/redo
js/10-templates.js   Layout templates, shape SVG library
js/20-render.js      DOM rendering (shared by editor, thumbnails, print)
js/30-editor.js      Selection, inspector, keyboard, images
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
  sheet: 'A3'|'A4',             // print sheet size (SRA3 legacy only)
  guide: true,                   // show margin guide
  safe: 8,                       // mm safe margin
  nums: false,                   // show page numbers
  pages: [Page × 4|8|16|24|32|40] // 4 to 40 pages (1 to 5 sheets)
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

`BL.VERSION` is the app's version string, shown in the left rail. It is bumped in the same commit as each release tag.

### Rendering

Pages render via a `--mm` CSS variable. The same `renderPage()` function works at any scale:
- Thumbnails: `--mm: 0.55px`
- Editor: `--mm: ~2.4px` (fit to viewport)
- Print: `--mm: 1mm`

---

## Verified Imposition Facts

These are the authoritative facts for sheet layout and folding. Do not modify.

### Page Geometry

- **8, 16, 24, 32, or 40 pages per booklet** (1 to 5 A3 sheets)
- Page = A5: portrait **148 × 210 mm** or landscape **210 × 148 mm**; A4: portrait **210 × 297 mm**
- One A3 sheet (**297 × 420 mm**) holds a 2×2 block of pages per side = 4 per side = **8 total per sheet**

### Sheet Sizes

- **A3**: 297 × 420 mm — exactly four A5 pages, no bleed, no room for marks
- **SRA3**: 320 × 450 mm — legacy only, not offered in current chooser; projects saved with it still work

### Duplex Printing

- Side 1 printed first
- **Flip on the long edge** (short edge for landscape sheet) — back appears mirrored left/right, book-style

### Imposition Algorithm (Offset-Based)

Each sheet carries 8 **consecutive** pages. Sheet k (1-based) uses the base 8-page table with every page number shifted by `8 * (k - 1)`.

**Base 8-page table:**
```
Side 1: [[5, 4], [8, 1]]   // top-left, top-right; bottom-left, bottom-right
Side 2: [[3, 6], [2, 7]]   // after long-edge flip

Top row (row 0) is always rotated 180°.
```

**For sheet k with offset = 8 * (k - 1):**
```
Side 1: [[5+offset, 4+offset], [8+offset, 1+offset]]
Side 2: [[3+offset, 6+offset], [2+offset, 7+offset]]
```

#### 8-page booklet (1 sheet)

**Sheet 1** (pages 1-8, offset 0):
- Side 1: `[[5, 4], [8, 1]]` (top row rotated 180°)
- Side 2: `[[3, 6], [2, 7]]` (top row rotated 180°)

#### 16-page booklet (2 sheets)

**Sheet 1** (pages 1-8, offset 0):
- Side 1: `[[5, 4], [8, 1]]` (top row rotated 180°)
- Side 2: `[[3, 6], [2, 7]]` (top row rotated 180°)

**Sheet 2** (pages 9-16, offset 8):
- Side 1: `[[13, 12], [16, 9]]` (top row rotated 180°)
- Side 2: `[[11, 14], [10, 15]]` (top row rotated 180°)

#### 24-page booklet (3 sheets)

**Sheet 1** (pages 1-8, offset 0):
- Side 1: `[[5, 4], [8, 1]]` (top row rotated 180°)
- Side 2: `[[3, 6], [2, 7]]` (top row rotated 180°)

**Sheet 2** (pages 9-16, offset 8):
- Side 1: `[[13, 12], [16, 9]]` (top row rotated 180°)
- Side 2: `[[11, 14], [10, 15]]` (top row rotated 180°)

**Sheet 3** (pages 17-24, offset 16):
- Side 1: `[[21, 20], [24, 17]]` (top row rotated 180°)
- Side 2: `[[19, 22], [18, 23]]` (top row rotated 180°)

#### 32-page booklet (4 sheets)

**Sheet 1** (pages 1-8, offset 0):
- Side 1: `[[5, 4], [8, 1]]` (top row rotated 180°)
- Side 2: `[[3, 6], [2, 7]]` (top row rotated 180°)

**Sheet 2** (pages 9-16, offset 8):
- Side 1: `[[13, 12], [16, 9]]` (top row rotated 180°)
- Side 2: `[[11, 14], [10, 15]]` (top row rotated 180°)

**Sheet 3** (pages 17-24, offset 16):
- Side 1: `[[21, 20], [24, 17]]` (top row rotated 180°)
- Side 2: `[[19, 22], [18, 23]]` (top row rotated 180°)

**Sheet 4** (pages 25-32, offset 24):
- Side 1: `[[29, 28], [32, 25]]` (top row rotated 180°)
- Side 2: `[[27, 30], [26, 31]]` (top row rotated 180°)

#### 40-page booklet (5 sheets)

**Sheet 1** (pages 1-8, offset 0):
- Side 1: `[[5, 4], [8, 1]]` (top row rotated 180°)
- Side 2: `[[3, 6], [2, 7]]` (top row rotated 180°)

**Sheet 2** (pages 9-16, offset 8):
- Side 1: `[[13, 12], [16, 9]]` (top row rotated 180°)
- Side 2: `[[11, 14], [10, 15]]` (top row rotated 180°)

**Sheet 3** (pages 17-24, offset 16):
- Side 1: `[[21, 20], [24, 17]]` (top row rotated 180°)
- Side 2: `[[19, 22], [18, 23]]` (top row rotated 180°)

**Sheet 4** (pages 25-32, offset 24):
- Side 1: `[[29, 28], [32, 25]]` (top row rotated 180°)
- Side 2: `[[27, 30], [26, 31]]` (top row rotated 180°)

**Sheet 5** (pages 33-40, offset 32):
- Side 1: `[[37, 36], [40, 33]]` (top row rotated 180°)
- Side 2: `[[35, 38], [34, 39]]` (top row rotated 180°)

### Cell Placement

```
left = (sheetW − 2·pageW)/2 + col·pageW
top  = (sheetH − 2·pageH)/2 + row·pageH
```
Each cell is the page size. Top-row cells rotate 180° about their center.

### Why This Order

- Page 1 must be at bottom-right quadrant (only panel facing reader after both folds)
- For single sheet: page 8 sits beside it at bottom-left
- Top row ends up folded behind → prints upside down (rotated 180°)
- Long-edge duplex flip mirrors back side left/right
- For multi-sheet: each sheet carries 8 consecutive pages; sheet k uses the base table with every page number shifted by +8 × (k − 1)
- Sheets nest inside each other (sheet 1 = outermost, sheet 5 = innermost for a 40-page booklet)
- Reading order runs straight through: 1, 2, 3, ..., N

### Margins and Bleed

- A3 holds exactly 4 A5 pages with ~0.5 mm spare — **no bleed, no marks**
- Content must stay inside the safe margin (default 8 mm)
- SRA3 provides room for crop/fold marks and bleed

### Folding Instructions

For each sheet:

1. Side 1 facing you, page numbers along the bottom
2. Fold the top half **back behind** the sheet
3. Fold the left half **back behind** the right half
4. Slit the top fold with a craft knife so the pages open

For multi-sheet booklets:

5. **Nest the sections**: Place each inner sheet inside the one before it (sheet 2 inside sheet 1, etc.; the last sheet is innermost)
6. Stitch or staple through all layers along the spine (saddle-stitch binding)
7. Reading order runs 1, 2, 3, ... straight through to the last page

---

## Measured Print Facts

Printing via the browser produces a 2-page PDF where each page corresponds to one side of the printed sheet. The PDF page box lands within about 0.2mm of the true sheet size because browsers round `@page` millimetres to whole CSS pixels; the content itself is placed in exact mm using CSS calc.

**A3 (297 × 420 mm)**: No crop or fold marks. The 2×2 page block fits with only 0.5mm spare per side horizontally (1mm total) and 0mm vertically.

**SRA3 (320 × 450 mm)**: 8 crop-mark lines (2 per corner) and 4 fold-mark lines (one at each edge midpoint). Room for 3mm bleed when enabled.

---

## Current Status

**Implemented:**
- Editor with image, text, and shape layers
- 8 layout templates (additive application to current page)
- Direct manipulation: move, resize, rotate layers with mouse or touch
- Snapping to margins, centers, and other layer edges
- Image pan inside frame (Alt+drag or inspector toggle)
- Two-finger pinch to scale on touch devices
- Undo/redo (40-entry stack)
- Keyboard shortcuts (delete, nudge, duplicate, save)
- Autosave (IndexedDB with localStorage fallback)
- Project save/open (.bookletter.json files)
- Imposition preview with live sheet thumbnails
- Print path: `@page` sized dynamically to sheet, multi-page output for multi-sheet booklets
- A3 and A4 paper; A5 and A4 booklet sizes
- 4/8/16/24/32/40 page booklets with correct imposition
- Fold instructions adapted to current stock and orientation
- 300 DPI PNG export per sheet side
- Print-safety warnings for safe-margin crossings and low-resolution images
