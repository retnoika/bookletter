/**
 * Bookletter Imposition Module
 * 
 * Single source of truth for imposition tables and geometry computation.
 * Works in browser (classic script tag) and Node (require).
 * 
 * SUPPORTED FORMATS:
 * 
 * 2x2 (quarter-size pages, e.g., A5 on A3):
 * - 8 pages per sheet, 2×2 grid per side
 * - Two folds + one slit
 * - Top row rotated 180°
 * 
 * 1x2 (half-size pages, e.g., A4 on A3):
 * - 4 pages per sheet
 * - Portrait booklet: 1×2 grid (pages side by side, vertical fold)
 * - Landscape booklet: 2×1 grid (pages stacked, horizontal fold)
 * - One fold, no slit, no rotation
 */
(function(exports) {
  'use strict';

  // ============ Paper and Booklet Dimensions (mm) ============
  var PAPERS = {
    A3:   [297, 420],  // portrait: w × h
    SRA3: [320, 450],
    A4:   [210, 297]
  };

  var BOOKLETS = {
    A5: [148, 210],    // portrait: w × h
    A4: [210, 297]
  };

  // ============ Base Imposition Tables ============

  /**
   * 2×2 imposition table (8 pages per sheet).
   * Used for quarter-size pages: A5 on A3/SRA3.
   * Grid: 2 rows × 2 columns per side.
   * 
   * Side 1 (printed first):
   *   Top row (rotated 180°): [5, 4]
   *   Bottom row (upright):   [8, 1]
   * 
   * Side 2 (back, after long-edge flip):
   *   Top row (rotated 180°): [3, 6]
   *   Bottom row (upright):   [2, 7]
   */
  var BASE_IMPOSITION_2x2 = {
    side1: [[5, 4], [8, 1]],
    side2: [[3, 6], [2, 7]],
    rotatedRow: 0
  };

  /**
   * 1×2 imposition table (4 pages per sheet).
   * Used for half-size pages: A4 on A3/SRA3, A5 on A4.
   * Grid: 1 row × 2 columns (portrait) or 2 rows × 1 column (landscape).
   * No rotation needed for single-fold booklets.
   * 
   * Side 1: [4, 1] — left = back cover, right = front cover
   * Side 2: [2, 3] — inside spread (pages 2 and 3)
   * 
   * Reading order after fold: 1, 2, 3, 4
   */
  var BASE_IMPOSITION_1x2 = {
    side1: [[4, 1]],
    side2: [[2, 3]],
    rotatedRow: -1  // no rotation
  };

  // Backward compatibility alias
  var BASE_IMPOSITION = BASE_IMPOSITION_2x2;

  // ============ Format Resolution ============

  /**
   * Determine the imposition format for a paper/booklet combination.
   * 
   * @param {string} paper - Paper size: 'A3', 'SRA3', or 'A4'
   * @param {string} booklet - Booklet page size: 'A5' or 'A4'
   * @returns {string} Format: '2x2' or '1x2'
   * @throws {Error} If combination is invalid
   */
  function getFormat(paper, booklet) {
    // A5 on A3/SRA3 = quarter-size = 2x2
    if (booklet === 'A5' && (paper === 'A3' || paper === 'SRA3')) {
      return '2x2';
    }
    // A4 on A3/SRA3 = half-size = 1x2
    if (booklet === 'A4' && (paper === 'A3' || paper === 'SRA3')) {
      return '1x2';
    }
    // A5 on A4 = half-size = 1x2
    if (booklet === 'A5' && paper === 'A4') {
      return '1x2';
    }
    // Invalid combinations
    if (booklet === 'A4' && paper === 'A4') {
      throw new Error('Cannot make A4 booklet on A4 paper (same size)');
    }
    if (paper === 'A5') {
      throw new Error('A5 paper not supported (no valid smaller booklet size)');
    }
    throw new Error('Unsupported combination: ' + paper + ' paper with ' + booklet + ' booklet');
  }

  /**
   * Get the base imposition table for a format.
   * 
   * @param {string} format - '2x2' or '1x2'
   * @returns {Object} Base imposition table
   */
  function getBaseImposition(format) {
    return format === '2x2' ? BASE_IMPOSITION_2x2 : BASE_IMPOSITION_1x2;
  }

  /**
   * Get pages per sheet for a format.
   * 
   * @param {string} format - '2x2' or '1x2'
   * @returns {number} 8 for 2x2, 4 for 1x2
   */
  function getPagesPerSheet(format) {
    return format === '2x2' ? 8 : 4;
  }

  /**
   * Resolve complete geometry for a paper/booklet/orientation combination.
   * 
   * @param {string} paper - Paper size: 'A3', 'SRA3', or 'A4'
   * @param {string} booklet - Booklet page size: 'A5' or 'A4'
   * @param {string} orient - Booklet page orientation: 'portrait' or 'landscape'
   * @returns {Object} Complete geometry specification
   */
  function resolveGeometry(paper, booklet, orient) {
    var format = getFormat(paper, booklet);
    var base = getBaseImposition(format);
    var pagesPerSheet = getPagesPerSheet(format);

    // Get paper and booklet dimensions
    var paperDims = PAPERS[paper];
    var bookletDims = BOOKLETS[booklet];

    if (!paperDims) throw new Error('Unknown paper size: ' + paper);
    if (!bookletDims) throw new Error('Unknown booklet size: ' + booklet);

    // Booklet page dimensions based on orientation
    var pageDims = orient === 'portrait' 
      ? [bookletDims[0], bookletDims[1]]    // w × h
      : [bookletDims[1], bookletDims[0]];   // h × w (swapped for landscape)

    // Grid and paper orientation depend on format and booklet orientation
    var gridCols, gridRows, paperOrient, folds, slit;

    if (format === '2x2') {
      // Quarter-size: 2×2 grid, paper same orientation as booklet
      gridCols = 2;
      gridRows = 2;
      paperOrient = orient;
      folds = 2;
      slit = true;
    } else {
      // Half-size: paper orientation opposite to booklet
      // Portrait booklet: landscape paper, pages side by side (1×2 = 1 row, 2 cols)
      // Landscape booklet: portrait paper, pages stacked (2×1 = 2 rows, 1 col)
      if (orient === 'portrait') {
        gridCols = 2;
        gridRows = 1;
        paperOrient = 'landscape';
      } else {
        gridCols = 1;
        gridRows = 2;
        paperOrient = 'portrait';
      }
      folds = 1;
      slit = false;
    }

    // Sheet dimensions based on paper orientation
    var sheetDims = paperOrient === 'portrait'
      ? [paperDims[0], paperDims[1]]        // w × h
      : [paperDims[1], paperDims[0]];       // h × w (swapped for landscape)

    // Calculate spare margin
    var blockW = gridCols * pageDims[0];
    var blockH = gridRows * pageDims[1];
    var spareW = sheetDims[0] - blockW;
    var spareH = sheetDims[1] - blockH;

    return {
      format: format,
      paper: paper,
      booklet: booklet,
      orient: orient,
      pageDims: pageDims,           // [w, h] in mm
      sheetDims: sheetDims,         // [w, h] in mm
      paperOrient: paperOrient,     // 'portrait' or 'landscape'
      grid: { cols: gridCols, rows: gridRows },
      pagesPerSheet: pagesPerSheet,
      folds: folds,
      slit: slit,
      rotatedRow: base.rotatedRow,
      spare: { w: spareW, h: spareH },
      base: base
    };
  }

  // ============ Imposition Computation ============

  /**
   * Compute imposition for sheet k of an N-page booklet.
   * 
   * @param {number} k - 1-based sheet index
   * @param {number} N - Total page count
   * @param {string} [format='2x2'] - Format: '2x2' or '1x2'
   * @returns {Object} { side1, side2, rotatedRow }
   */
  function computeImposition(k, N, format) {
    format = format || '2x2';
    var base = getBaseImposition(format);
    var pagesPerSheet = getPagesPerSheet(format);
    
    if (typeof k !== 'number' || k < 1) {
      throw new Error('Sheet index k must be >= 1');
    }
    var sheetCount = Math.ceil(N / pagesPerSheet);
    if (k > sheetCount) {
      throw new Error('Sheet index ' + k + ' exceeds sheet count ' + sheetCount);
    }

    var offset = pagesPerSheet * (k - 1);

    // Apply offset to base table
    var side1 = base.side1.map(function(row) {
      return row.map(function(p) { return p + offset; });
    });
    var side2 = base.side2.map(function(row) {
      return row.map(function(p) { return p + offset; });
    });

    return {
      side1: side1,
      side2: side2,
      rotatedRow: base.rotatedRow
    };
  }

  // ============ Reading Order ============

  /**
   * Get reading order for 2×2 format (8 pages per sheet).
   */
  function getSheetReadingOrder_2x2(imp) {
    return [
      imp.side1[1][1], // Position 0: page 1 (front cover)
      imp.side2[1][0], // Position 1: page 2
      imp.side2[0][0], // Position 2: page 3
      imp.side1[0][1], // Position 3: page 4
      imp.side1[0][0], // Position 4: page 5
      imp.side2[0][1], // Position 5: page 6
      imp.side2[1][1], // Position 6: page 7
      imp.side1[1][0]  // Position 7: page 8 (back cover)
    ];
  }

  /**
   * Get reading order for 1×2 format (4 pages per sheet).
   */
  function getSheetReadingOrder_1x2(imp) {
    return [
      imp.side1[0][1], // Position 0: page 1 (front cover, right of side 1)
      imp.side2[0][0], // Position 1: page 2 (left of side 2 after flip)
      imp.side2[0][1], // Position 2: page 3 (right of side 2 after flip)
      imp.side1[0][0]  // Position 3: page 4 (back cover, left of side 1)
    ];
  }

  /**
   * Get the reading order for a single sheet after folding.
   * 
   * @param {Object} imp - Imposition object from computeImposition
   * @param {string} [format='2x2'] - Format: '2x2' or '1x2'
   * @returns {number[]} Array of page numbers in reading order
   */
  function getSheetReadingOrder(imp, format) {
    format = format || '2x2';
    return format === '2x2' 
      ? getSheetReadingOrder_2x2(imp) 
      : getSheetReadingOrder_1x2(imp);
  }

  /**
   * Get the full reading order for an entire booklet (all sheets nested).
   * 
   * @param {number} N - Total page count
   * @param {string} [format='2x2'] - Format: '2x2' or '1x2'
   * @returns {number[]} Array of N page numbers in reading order
   */
  function getBookletReadingOrder(N, format) {
    format = format || '2x2';
    var pagesPerSheet = getPagesPerSheet(format);
    var sheetCount = Math.ceil(N / pagesPerSheet);
    var order = [];
    for (var k = 1; k <= sheetCount; k++) {
      var imp = computeImposition(k, N, format);
      var sheetOrder = getSheetReadingOrder(imp, format);
      order = order.concat(sheetOrder);
    }
    return order;
  }

  /**
   * Verify that the imposition produces the correct reading order.
   * 
   * @param {number} N - Total page count
   * @param {string} [format='2x2'] - Format: '2x2' or '1x2'
   * @returns {null|Object} null if valid, or error object
   */
  function verifyReadingOrder(N, format) {
    format = format || '2x2';
    var actual = getBookletReadingOrder(N, format);
    var expected = [];
    for (var i = 1; i <= N; i++) {
      expected.push(i);
    }

    for (var j = 0; j < N; j++) {
      if (actual[j] !== expected[j]) {
        return {
          expected: expected,
          actual: actual,
          firstMismatch: {
            position: j,
            expectedPage: expected[j],
            actualPage: actual[j]
          }
        };
      }
    }
    return null;
  }

  // ============ Safe Bands (unchanged for now) ============

  /**
   * Get the safe-area bands for a page based on its position in the imposition.
   * NOTE: This currently only supports 2x2 format. 1x2 support is a future step.
   * 
   * @param {number} pageIdx - 0-based page index
   * @param {number} pageCount - Total pages
   * @param {string} orient - 'portrait' or 'landscape'
   * @param {string} sheet - 'A3' or 'SRA3'
   * @param {number} safe - Safe margin in mm
   * @returns {Object} { top, right, bottom, left, unsafeSides, spareX, spareY }
   */
  function pageSafeBands(pageIdx, pageCount, orient, sheet, safe) {
    // Find which sheet this page is on (1-based)
    var sheetIdx = Math.ceil((pageIdx + 1) / 8);
    var imp = computeImposition(sheetIdx, pageCount);
    
    // Find position of this page in the imposition
    var page = pageIdx + 1;
    var pos = null;
    
    // Search side 1
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        if (imp.side1[r][c] === page) {
          pos = { side: 1, row: r, col: c };
          break;
        }
      }
      if (pos) break;
    }
    
    // Search side 2
    if (!pos) {
      for (var r2 = 0; r2 < 2; r2++) {
        for (var c2 = 0; c2 < 2; c2++) {
          if (imp.side2[r2][c2] === page) {
            pos = { side: 2, row: r2, col: c2 };
            break;
          }
        }
        if (pos) break;
      }
    }
    
    if (!pos) {
      throw new Error('Page ' + page + ' not found in imposition');
    }
    
    // Determine which sides are at the edge of the sheet (unsafe for printing)
    var unsafeSides = [];
    if (pos.row === 0) unsafeSides.push('top');
    if (pos.row === 1) unsafeSides.push('bottom');
    if (pos.col === 0) unsafeSides.push('left');
    if (pos.col === 1) unsafeSides.push('right');
    
    // Get dimensions
    var SHEETS = { A3: [297, 420], SRA3: [320, 450] };
    var PAGE_P = [148, 210], PAGE_L = [210, 148];
    
    var pageDims = orient === 'portrait' ? PAGE_P : PAGE_L;
    var sheetDims = orient === 'portrait' ? SHEETS[sheet] : [SHEETS[sheet][1], SHEETS[sheet][0]];
    
    var pw = pageDims[0], ph = pageDims[1];
    var sw = sheetDims[0], sh = sheetDims[1];
    
    // Calculate spare (gap between pages and sheet edge)
    var spareX = (sw - 2 * pw) / 2;
    var spareY = (sh - 2 * ph) / 2;
    
    // Band width: how much of the safe margin extends into the printable area
    // If spare >= safe, band = 0 (safe margin fits in the gap)
    // If spare < safe, band = safe - spare (that much can't be printed)
    var bandH = Math.max(0, safe - spareY);  // for top/bottom
    var bandV = Math.max(0, safe - spareX);  // for left/right
    
    return {
      top: unsafeSides.indexOf('top') >= 0 ? bandH : 0,
      right: unsafeSides.indexOf('right') >= 0 ? bandV : 0,
      bottom: unsafeSides.indexOf('bottom') >= 0 ? bandH : 0,
      left: unsafeSides.indexOf('left') >= 0 ? bandV : 0,
      unsafeSides: unsafeSides,
      spareX: spareX,
      spareY: spareY
    };
  }

  // ============ Exports ============
  
  // Tables
  exports.BASE_IMPOSITION = BASE_IMPOSITION;
  exports.BASE_IMPOSITION_2x2 = BASE_IMPOSITION_2x2;
  exports.BASE_IMPOSITION_1x2 = BASE_IMPOSITION_1x2;
  
  // Dimensions
  exports.PAPERS = PAPERS;
  exports.BOOKLETS = BOOKLETS;
  
  // Format helpers
  exports.getFormat = getFormat;
  exports.getBaseImposition = getBaseImposition;
  exports.getPagesPerSheet = getPagesPerSheet;
  exports.resolveGeometry = resolveGeometry;
  
  // Imposition computation
  exports.computeImposition = computeImposition;
  exports.getSheetReadingOrder = getSheetReadingOrder;
  exports.getSheetReadingOrder_2x2 = getSheetReadingOrder_2x2;
  exports.getSheetReadingOrder_1x2 = getSheetReadingOrder_1x2;
  exports.getBookletReadingOrder = getBookletReadingOrder;
  exports.verifyReadingOrder = verifyReadingOrder;
  exports.pageSafeBands = pageSafeBands;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.BL = window.BL || {}));
