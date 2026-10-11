/**
 * Bookletter — state model, defaults, factories, undo/redo
 * All geometry in millimetres; never pixels.
 */
(function() {
  'use strict';
  window.BL = window.BL || {};

  // ============ Constants ============
  var PAGE_W_P = 148, PAGE_H_P = 210;  // A5 portrait
  var PAGE_W_L = 210, PAGE_H_L = 148;  // A5 landscape
  var SHEET_A3  = [297, 420];
  var SHEET_SRA3 = [320, 450];

  BL.SHEETS = { A3: SHEET_A3, SRA3: SHEET_SRA3 };

  // Dynamic page label computation
  function computePageLabel(idx, total) {
    if (idx === 0) return '1 · Front cover';
    if (idx === total - 1) return total + ' · Back cover';
    return String(idx + 1);
  }
  BL.computePageLabel = computePageLabel;

  // Valid page counts (8, 16, or 24)
  BL.VALID_PAGE_COUNTS = [8, 16, 24];

  // ============ ID generator ============
  var layerCounter = 0;
  function genId() {
    return 'l' + (++layerCounter);
  }
  BL.genId = genId;

  // ============ Layer factories ============
  function newPhotoLayer(x, y, w, h) {
    return {
      id: genId(),
      kind: 'photo',
      x: x || 0,
      y: y || 0,
      w: w || 148,
      h: h || 210,
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
    return {
      id: genId(),
      kind: 'text',
      x: x || 0,
      y: y || 0,
      w: w || 148,
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
    if (BL.VALID_PAGE_COUNTS.indexOf(pageCount) === -1) {
      pageCount = 8;
    }
    var pages = [];
    for (var i = 0; i < pageCount; i++) {
      pages.push(newPage());
    }
    return {
      v: 2,
      title: 'untitled booklet',
      orient: 'portrait',
      sheet: 'A3',
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
  function pageDims() {
    return BL.S.orient === 'portrait' ? [PAGE_W_P, PAGE_H_P] : [PAGE_W_L, PAGE_H_L];
  }

  function sheetDims() {
    var s = BL.SHEETS[BL.S.sheet];
    return BL.S.orient === 'portrait' ? [s[0], s[1]] : [s[1], s[0]];
  }

  BL.pageDims = pageDims;
  BL.sheetDims = sheetDims;

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
    if (BL.cur >= BL.S.pages.length) BL.cur = 0;
    return true;
  }

  function clearHistory() {
    undoStack = [];
    redoStack = [];
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  // Expose for test API
  function getUndoStack() { return undoStack; }
  function getRedoStack() { return redoStack; }

  BL.pushUndo = pushUndo;
  BL.undo = undo;
  BL.redo = redo;
  BL.clearHistory = clearHistory;
  BL.canUndo = canUndo;
  BL.canRedo = canRedo;
  BL.getUndoStack = getUndoStack;
  BL.getRedoStack = getRedoStack;

  // ============ Find layer by id ============
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

  BL.findLayer = findLayer;
  BL.findLayerIndex = findLayerIndex;

  // ============ Template catalogue hook ============
  // Templates are registered in 10-templates.js
  BL.TEMPLATES = {};
  BL.TEMPLATE_ORDER = [];

})();
