/**
 * Bookletter Imposition Module
 * 
 * Single source of truth for the 8-page imposition table and multi-sheet
 * computation. Works in browser (classic script tag) and Node (require).
 * 
 * PHYSICAL FACTS:
 * - One A3 sheet, folded twice and slit, becomes a 4-leaf section
 * - Leaves read in order: leaf 1 = (1,2), leaf 2 = (3,4), leaf 3 = (5,6), leaf 4 = (7,8)
 * - Nesting sections: sheet 1 is outermost, sheet N is innermost
 * - Reading order: 1,2,3,4,5,6,7,8 | 9,10,11,12,13,14,15,16 | ...
 * - Each sheet carries 8 CONSECUTIVE pages: sheet k = pages 8*(k-1)+1 to 8*k
 * 
 * The imposition for sheet k is the base 8-page table with every page
 * number shifted by 8*(k-1).
 */
(function(exports) {
  'use strict';

  /**
   * Base imposition table for an 8-page booklet on one A3 sheet.
   * Grid coordinates: [row][col] where row 0 = top, col 0 = left.
   * 
   * Side 1 (printed first):
   *   Top row (rotated 180°): [5, 4]
   *   Bottom row (upright):   [8, 1]
   * 
   * Side 2 (back, after long-edge flip):
   *   Top row (rotated 180°): [3, 6]
   *   Bottom row (upright):   [2, 7]
   */
  var BASE_IMPOSITION = {
    side1: [[5, 4], [8, 1]],
    side2: [[3, 6], [2, 7]],
    rotatedRow: 0
  };

  /**
   * Compute imposition for sheet k of an N-page booklet.
   * 
   * @param {number} k - 1-based sheet index (1, 2, or 3)
   * @param {number} N - Total page count (8, 16, or 24)
   * @returns {Object} { side1: [[number]], side2: [[number]], rotatedRow: number }
   */
  function computeImposition(k, N) {
    if (typeof k !== 'number' || k < 1) {
      throw new Error('Sheet index k must be >= 1');
    }
    var sheetCount = N / 8;
    if (k > sheetCount) {
      throw new Error('Sheet index ' + k + ' exceeds sheet count ' + sheetCount);
    }

    // Offset: sheet 1 = 0, sheet 2 = 8, sheet 3 = 16
    var offset = 8 * (k - 1);

    // Apply offset to base table
    return {
      side1: [
        [BASE_IMPOSITION.side1[0][0] + offset, BASE_IMPOSITION.side1[0][1] + offset],
        [BASE_IMPOSITION.side1[1][0] + offset, BASE_IMPOSITION.side1[1][1] + offset]
      ],
      side2: [
        [BASE_IMPOSITION.side2[0][0] + offset, BASE_IMPOSITION.side2[0][1] + offset],
        [BASE_IMPOSITION.side2[1][0] + offset, BASE_IMPOSITION.side2[1][1] + offset]
      ],
      rotatedRow: BASE_IMPOSITION.rotatedRow
    };
  }

  /**
   * Get the reading order for a single sheet after folding.
   * This is the order pages appear when you fold the sheet and flip through.
   * 
   * For any sheet, the reading order of the 8 positions is: 1,2,3,4,5,6,7,8
   * (relative to that sheet's offset).
   * 
   * @param {Object} imp - Imposition object from computeImposition
   * @returns {number[]} Array of 8 page numbers in reading order
   */
  function getSheetReadingOrder(imp) {
    // After folding:
    // Position 0 (visible first): side1[1][1] (bottom-right of side 1) - upright
    // Position 1 (turn page): side2[1][0] (bottom-left of side 2) - upright  
    // Position 2: side2[0][0] (top-left of side 2) - was rotated, now upright
    // Position 3: side1[0][1] (top-right of side 1) - was rotated, now upright
    // Position 4: side1[0][0] (top-left of side 1) - was rotated, now upright
    // Position 5: side2[0][1] (top-right of side 2) - was rotated, now upright
    // Position 6: side2[1][1] (bottom-right of side 2) - upright
    // Position 7: side1[1][0] (bottom-left of side 1) - upright
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
   * Get the full reading order for an entire booklet (all sheets nested).
   * Sheets are nested outermost to innermost (sheet 1 outside, sheet N inside).
   * 
   * @param {number} N - Total page count (8, 16, or 24)
   * @returns {number[]} Array of N page numbers in reading order
   */
  function getBookletReadingOrder(N) {
    var sheetCount = N / 8;
    var order = [];
    for (var k = 1; k <= sheetCount; k++) {
      var imp = computeImposition(k, N);
      var sheetOrder = getSheetReadingOrder(imp);
      order = order.concat(sheetOrder);
    }
    return order;
  }

  /**
   * Verify that the imposition produces the correct reading order.
   * Returns null if valid, or an error object describing the failure.
   * 
   * @param {number} N - Total page count (8, 16, or 24)
   * @returns {Object|null} null if valid, or { expected, actual, firstMismatch }
   */
  function verifyReadingOrder(N) {
    var actual = getBookletReadingOrder(N);
    var expected = [];
    for (var i = 1; i <= N; i++) expected.push(i);
    
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

  /**
   * Get the safe-area bands for a page based on its position in the imposition.
   * 
   * Each page has exactly 2 unsafe sides (those touching the sheet edge).
   * The band width = max(0, safeMargin - spare) where spare is the gap between
   * the 2x2 cell block and the sheet edge.
   * 
   * @param {number} pageIdx - 0-based page index
   * @param {number} pageCount - Total pages (8, 16, 24)
   * @param {string} orient - 'portrait' or 'landscape'
   * @param {string} sheet - 'A3' or 'SRA3'
   * @param {number} safe - Printer margin in mm
   * @returns {Object} { top, right, bottom, left } - band width in mm for each side (0 if fold side)
   */
  function pageSafeBands(pageIdx, pageCount, orient, sheet, safe) {
    var page = pageIdx + 1; // 1-based page number
    
    // Determine which sheet (1-based) and find page position
    var sheetIdx = Math.ceil(page / 8);
    var imp = computeImposition(sheetIdx, pageCount);
    
    // Find page in the imposition table
    var row = -1, col = -1, side = null;
    
    // Search side 1
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        if (imp.side1[r][c] === page) {
          row = r; col = c; side = 1;
          break;
        }
      }
      if (side) break;
    }
    
    // Search side 2 if not found
    if (!side) {
      for (var r = 0; r < 2; r++) {
        for (var c = 0; c < 2; c++) {
          if (imp.side2[r][c] === page) {
            row = r; col = c; side = 2;
            break;
          }
        }
        if (side) break;
      }
    }
    
    if (row === -1) {
      // Page not found (shouldn't happen)
      return { top: 0, right: 0, bottom: 0, left: 0, unsafeSides: [] };
    }
    
    // Determine unsafe sides based on cell position
    // col 0 -> left edge on sheet; col 1 -> right edge on sheet
    // row 0 -> top edge on sheet; row 1 -> bottom edge on sheet
    var unsafeTop = (row === 0);
    var unsafeBottom = (row === 1);
    var unsafeLeft = (col === 0);
    var unsafeRight = (col === 1);
    
    // Get page and sheet dimensions
    var SHEETS = { A3: [297, 420], SRA3: [320, 450] };
    var PAGE_P = [148, 210], PAGE_L = [210, 148];
    
    var pageDims = orient === 'portrait' ? PAGE_P : PAGE_L;
    var sheetDims = orient === 'portrait' ? SHEETS[sheet] : [SHEETS[sheet][1], SHEETS[sheet][0]];
    
    var pw = pageDims[0], ph = pageDims[1];
    var sw = sheetDims[0], sh = sheetDims[1];
    
    // Calculate spare margins
    var spareX = (sw - 2 * pw) / 2;
    var spareY = (sh - 2 * ph) / 2;
    
    // Band width = max(0, safe - spare)
    var bandH = Math.max(0, safe - spareY); // top/bottom bands
    var bandV = Math.max(0, safe - spareX); // left/right bands
    
    var unsafeSides = [];
    if (unsafeTop) unsafeSides.push('top');
    if (unsafeRight) unsafeSides.push('right');
    if (unsafeBottom) unsafeSides.push('bottom');
    if (unsafeLeft) unsafeSides.push('left');
    
    return {
      top: unsafeTop ? bandH : 0,
      right: unsafeRight ? bandV : 0,
      bottom: unsafeBottom ? bandH : 0,
      left: unsafeLeft ? bandV : 0,
      unsafeSides: unsafeSides,
      spareX: spareX,
      spareY: spareY
    };
  }

  // Export for browser (window.BL) and Node (module.exports)
  exports.BASE_IMPOSITION = BASE_IMPOSITION;
  exports.computeImposition = computeImposition;
  exports.getSheetReadingOrder = getSheetReadingOrder;
  exports.getBookletReadingOrder = getBookletReadingOrder;
  exports.verifyReadingOrder = verifyReadingOrder;
  exports.pageSafeBands = pageSafeBands;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.BL = window.BL || {}));
