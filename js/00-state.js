/**
 * Bookletter — state model, defaults, factories, undo/redo
 * All geometry in millimetres; never pixels.
 */
(function() {
  'use strict';
  window.BL = window.BL || {};


  // ============ Version ============
  BL.VERSION = '0.9.0';
  // ============ Paper and Booklet Constants ============
  // Paper sizes (portrait w×h)
  var SHEET_A3   = [297, 420];
  var SHEET_A4   = [210, 297];
  var SHEET_SRA3 = [320, 450];
  
  // Booklet page sizes (portrait w×h)
  var BOOKLET_A5 = [148, 210];
  var BOOKLET_A4 = [210, 297];

  BL.SHEETS = { A3: SHEET_A3, A4: SHEET_A4, SRA3: SHEET_SRA3 };
  BL.BOOKLETS = { A5: BOOKLET_A5, A4: BOOKLET_A4 };

  // ============ Format Derivation ============
  /**
   * Get imposition format based on paper and booklet sizes.
   * A5 on A3/SRA3 = 2x2 (quarter-size, two folds + slit)
   * A4 on A3/SRA3 = 1x2 (half-size, one fold)
   * A5 on A4 = 1x2 (half-size, one fold)
   */
  function getFormat() {
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var booklet = BL.S.booklet || 'A5';
    
    if (booklet === 'A5' && (paper === 'A3' || paper === 'SRA3')) {
      return '2x2';
    }
    return '1x2';
  }
  BL.getFormat = getFormat;

  /**
   * Get pages per sheet based on format.
   */
  function pagesPerSheet() {
    return getFormat() === '2x2' ? 8 : 4;
  }
  BL.pagesPerSheet = pagesPerSheet;

  /**
   * Get valid page counts for current format.
   */
  function validPageCounts() {
    return getFormat() === '2x2' ? [8, 16, 24, 32, 40] : [4, 8, 12, 16, 20];
  }
  BL.validPageCounts = validPageCounts;

  /**
   * Get all valid page counts across all formats (for validation).
   * Union of 2x2 [8,16,24,32,40] and 1x2 [4,8,12,16,20].
   */
  function allValidPageCounts() {
    return [4, 8, 12, 16, 20, 24, 32, 40];
  }
  BL.allValidPageCounts = allValidPageCounts;

  // Legacy: BL.VALID_PAGE_COUNTS for backward compatibility
  // Returns the current valid counts (may change when format changes)
  Object.defineProperty(BL, 'VALID_PAGE_COUNTS', {
    get: function() { return validPageCounts(); }
  });

  // ============ Dynamic page label computation ============
  function computePageLabel(idx, total) {
    if (idx === 0) return '1 · Front cover';
    if (idx === total - 1) return total + ' · Back cover';
    return String(idx + 1);
  }
  BL.computePageLabel = computePageLabel;

  // ============ ID generator ============
  var layerCounter = 0;
  function genId() {
    return 'l' + (++layerCounter);
  }
  BL.genId = genId;

  // ============ Layer factories ============
  function newPhotoLayer(x, y, w, h) {
    var dims = pageDims();
    return {
      id: genId(),
      kind: 'photo',
      x: x || 0,
      y: y || 0,
      w: w || dims[0],
      h: h || dims[1],
      rot: 0,
      opacity: 1,
      src: null,
      fit: 'cover',
      px: 50,
      py: 50
    };
  }

  function newTextLayer(x, y, w, h, opts) {
    opts = opts || {};
    var dims = pageDims();
    return {
      id: genId(),
      kind: 'text',
      x: x || 0,
      y: y || 0,
      w: w || dims[0],
      h: h || 30,
      rot: 0,
      opacity: 1,
      text: opts.text || '',
      font: opts.font || 'sans',
      size: opts.size || 5,
      align: opts.align || 'left',
      bold: opts.bold || false,
      color: opts.color || '#17261f',
      line: opts.line || 1.3
    };
  }

  BL.newPhotoLayer = newPhotoLayer;
  BL.newTextLayer = newTextLayer;

  // ============ Page factory ============
  function newPage() {
    return {
      bg: '#ffffff',
      layers: []
    };
  }
  BL.newPage = newPage;

  // ============ Default state ============
  function defaultState(pageCount) {
    pageCount = pageCount || 8;
    // Validate against current format's valid counts
    if ([4, 8, 12, 16, 24].indexOf(pageCount) === -1) {
      pageCount = 8;
    }
    var pages = [];
    for (var i = 0; i < pageCount; i++) {
      pages.push(newPage());
    }
    return {
      v: 3,                      // Version 3: paper/booklet fields
      title: 'untitled booklet',
      orient: 'portrait',
      paper: 'A3',               // Paper size
      booklet: 'A5',             // Booklet page size
      sheet: 'A3',               // Legacy field for backward compat
      guide: true,
      safe: 8,
      nums: false,
      pageCount: pageCount,
      pages: pages
    };
  }
  BL.defaultState = defaultState;

  // ============ Current state ============
  BL.S = defaultState();
  BL.cur = 0;       // current page index
  BL.sel = null;    // selected layer id

  // ============ Geometry helpers ============
  /**
   * Get booklet page dimensions in mm based on booklet size and orientation.
   */
  function pageDims() {
    var booklet = BL.S.booklet || 'A5';
    var dims = BL.BOOKLETS[booklet] || BL.BOOKLETS.A5;
    return BL.S.orient === 'portrait' ? [dims[0], dims[1]] : [dims[1], dims[0]];
  }

  /**
   * Get sheet (paper) dimensions in mm.
   * For 2x2 format: paper orientation matches booklet orientation.
   * For 1x2 format: paper orientation is OPPOSITE to booklet orientation
   *   (portrait booklet pages need landscape paper, and vice versa).
   */
  function sheetDims() {
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var s = BL.SHEETS[paper] || BL.SHEETS.A3;
    var format = getFormat();
    
    var paperOrient;
    if (format === '2x2') {
      // Quarter-size: paper same orientation as booklet
      paperOrient = BL.S.orient;
    } else {
      // Half-size: paper opposite orientation to booklet
      paperOrient = BL.S.orient === 'portrait' ? 'landscape' : 'portrait';
    }
    
    return paperOrient === 'portrait' ? [s[0], s[1]] : [s[1], s[0]];
  }

  BL.pageDims = pageDims;
  BL.sheetDims = sheetDims;

  /**
   * Get paper orientation string for display.
   */
  function paperOrient() {
    var format = getFormat();
    if (format === '2x2') {
      return BL.S.orient;
    } else {
      return BL.S.orient === 'portrait' ? 'landscape' : 'portrait';
    }
  }
  BL.paperOrient = paperOrient;

  // Luminance for auto text color on dark backgrounds
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  BL.lum = lum;

  // ============ Deep clone ============
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  BL.clone = clone;

  // ============ Undo/Redo ============
  var MAX_UNDO = 40;
  var undoStack = [];
  var redoStack = [];

  function snapshot() {
    return clone(BL.S);
  }

  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return false;
    redoStack.push(snapshot());
    BL.S = undoStack.pop();
    // Validate cur and sel
    if (BL.cur >= BL.S.pages.length) BL.cur = 0;
    if (BL.sel !== null) {
      var page = BL.S.pages[BL.cur];
      var found = false;
      for (var i = 0; i < page.layers.length; i++) {
        if (page.layers[i].id === BL.sel) { found = true; break; }
      }
      if (!found) BL.sel = null;
    }
    return true;
  }

  function redo() {
    if (redoStack.length === 0) return false;
    undoStack.push(snapshot());
    BL.S = redoStack.pop();
    // Validate cur and sel
    if (BL.cur >= BL.S.pages.length) BL.cur = 0;
    if (BL.sel !== null) {
      var page = BL.S.pages[BL.cur];
      var found = false;
      for (var i = 0; i < page.layers.length; i++) {
        if (page.layers[i].id === BL.sel) { found = true; break; }
      }
      if (!found) BL.sel = null;
    }
    return true;
  }

  function clearHistory() {
    undoStack = [];
    redoStack = [];
  }

  BL.pushUndo = pushUndo;
  BL.undo = undo;
  BL.redo = redo;
  BL.clearHistory = clearHistory;

  // ============ Find layer helpers ============
  function findLayer(id, pageIdx) {
    if (pageIdx === undefined) pageIdx = BL.cur;
    var page = BL.S.pages[pageIdx];
    if (!page) return null;
    for (var i = 0; i < page.layers.length; i++) {
      if (page.layers[i].id === id) return page.layers[i];
    }
    return null;
  }

  function findLayerIndex(id, pageIdx) {
    if (pageIdx === undefined) pageIdx = BL.cur;
    var page = BL.S.pages[pageIdx];
    if (!page) return -1;
    for (var i = 0; i < page.layers.length; i++) {
      if (page.layers[i].id === id) return i;
    }
    return -1;
  }

  function findLayerById(id, pageIdx) {
    if (pageIdx !== undefined) {
      var page = BL.S.pages[pageIdx];
      if (!page) return null;
      for (var i = 0; i < page.layers.length; i++) {
        if (page.layers[i].id === id) return page.layers[i];
      }
      return null;
    }
    // Search all pages
    for (var p = 0; p < BL.S.pages.length; p++) {
      var pg = BL.S.pages[p];
      for (var j = 0; j < pg.layers.length; j++) {
        if (pg.layers[j].id === id) return pg.layers[j];
      }
    }
    return null;
  }

  BL.findLayer = findLayer;
  BL.findLayerIndex = findLayerIndex;
  BL.findLayerById = findLayerById;

})();
