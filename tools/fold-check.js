#!/usr/bin/env node
/**
 * Fold check — verifies imposition for booklets in both grid formats.
 * 
 * Formats:
 *   2x2 — 8 pages per sheet (A5 on A3/SRA3), two folds + slit
 *   1x2 — 4 pages per sheet (A4 on A3/SRA3, or A5 on A4), one fold only
 * 
 * Uses js/imposition.js (single source of truth) for the imposition tables.
 * 
 * Verifies:
 * 1. TABLE INVARIANCE: Imposition table matches expected values
 * 2. READING SEQUENCE: Concatenating all sheets' reading orders produces 1,2,3,...,N
 * 3. COVERAGE: All pages 1..N appear exactly once across all sheets
 * 4. ROTATIONS: Correct panels rotated per grid format
 * 5. POSITIONS: Page 1 at front cover position, page N at back cover position
 * 6. GEOMETRY: Cell and sheet dimensions match expected values for orientation
 * 7. SAFE BANDS: Correct unsafe sides per page position
 * 
 * Usage:
 *   node tools/fold-check.js                       # Test 2x2 format, 8 pages, both orientations
 *   node tools/fold-check.js --format=1x2         # Test 1x2 format, 4 pages
 *   node tools/fold-check.js --pages=16            # Test 2x2, 16 pages
 *   node tools/fold-check.js --format=1x2 --pages=8  # Test 1x2, 8 pages (2 sheets)
 *   node tools/fold-check.js --orient=portrait     # Test portrait only
 *   node tools/fold-check.js --all                 # Test all valid page counts for the format
 */

const imposition = require('../js/imposition.js');
const { 
  computeImposition, 
  getSheetReadingOrder, 
  getBookletReadingOrder, 
  verifyReadingOrder,
  BASE_IMPOSITION,
  BASE_IMPOSITION_2x2,
  BASE_IMPOSITION_1x2,
  pageSafeBands,
  resolveGeometry,
  getPagesPerSheet
} = imposition;

// ============ Valid configurations per format ============
const VALID_PAGE_COUNTS_2x2 = [8, 16, 24];
const VALID_PAGE_COUNTS_1x2 = [4, 8, 12];
const VALID_ORIENTATIONS = ['portrait', 'landscape'];
const VALID_FORMATS = ['2x2', '1x2'];


// ============ Geometry constants ============
// 2x2: A5 booklet on A3/SRA3 paper
const GEOMETRY_2x2 = {
  portrait: {
    page: { w: 148, h: 210 },
    sheet: { A3: { w: 297, h: 420 }, SRA3: { w: 320, h: 450 } }
  },
  landscape: {
    page: { w: 210, h: 148 },
    sheet: { A3: { w: 420, h: 297 }, SRA3: { w: 450, h: 320 } }
  }
};

// 1x2: A4 booklet on A3/SRA3, or A5 booklet on A4
// PORTRAIT booklet pages: 1×2 grid (pages side by side, vertical fold)
// LANDSCAPE booklet pages: 2×1 grid (pages stacked, horizontal fold)
// Note: "1x2" format name refers to portrait; landscape is effectively "2x1"
const GEOMETRY_1x2 = {
  portrait: {
    // Portrait A4 booklet (210x297) on landscape A3/SRA3 paper
    // Grid: 1 row × 2 cols, pages side by side, vertical fold
    page: { w: 210, h: 297 },
    sheet: { A3: { w: 420, h: 297 }, SRA3: { w: 450, h: 320 } },
    gridRows: 1,
    gridCols: 2
  },
  landscape: {
    // Landscape A4 booklet (297x210) on portrait A3/SRA3 paper
    // Grid: 2 rows × 1 col, pages stacked, horizontal fold
    page: { w: 297, h: 210 },
    sheet: { A3: { w: 297, h: 420 }, SRA3: { w: 320, h: 450 } },
    gridRows: 2,
    gridCols: 1
  }
};

// A5 on A4 for one-fold (same grid logic)
const GEOMETRY_1x2_A5onA4 = {
  portrait: {
    page: { w: 148, h: 210 },
    sheet: { A4: { w: 297, h: 210 } },
    gridRows: 1,
    gridCols: 2
  },
  landscape: {
    page: { w: 210, h: 148 },
    sheet: { A4: { w: 210, h: 297 } },
    gridRows: 2,
    gridCols: 1
  }
};

// ============ Build physical sheet layout with rotation info ============
function buildSheetLayout(grid, rotatedRow) {
  const layout = [];
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        page: grid[r][c],
        rot: (rotatedRow >= 0 && r === rotatedRow) ? 180 : 0
      });
    }
    layout.push(row);
  }
  return layout;
}

// ============ Simulate folding for 2x2 sheet (two folds + slit) ============
function simulateFoldForSheet_2x2(side1Layout, side2Layout) {
  // After folding twice and slitting, reading order is determined by physical positions
  const readingOrder = [
    // Position 1 (cover): side1[1][1] = bottom-right of side 1 - upright
    { page: side1Layout[1][1].page, rot: side1Layout[1][1].rot, expected: 0 },
    // Position 2: side2[1][0] = bottom-left of side 2 - upright
    { page: side2Layout[1][0].page, rot: side2Layout[1][0].rot, expected: 0 },
    // Position 3: side2[0][0] = top-left of side 2 - was rotated, now upright
    { page: side2Layout[0][0].page, rot: side2Layout[0][0].rot, expected: 180 },
    // Position 4: side1[0][1] = top-right of side 1 - was rotated, now upright
    { page: side1Layout[0][1].page, rot: side1Layout[0][1].rot, expected: 180 },
    // Position 5: side1[0][0] = top-left of side 1 - was rotated, now upright
    { page: side1Layout[0][0].page, rot: side1Layout[0][0].rot, expected: 180 },
    // Position 6: side2[0][1] = top-right of side 2 - was rotated, now upright
    { page: side2Layout[0][1].page, rot: side2Layout[0][1].rot, expected: 180 },
    // Position 7: side2[1][1] = bottom-right of side 2 - upright
    { page: side2Layout[1][1].page, rot: side2Layout[1][1].rot, expected: 0 },
    // Position 8 (back cover): side1[1][0] = bottom-left of side 1 - upright
    { page: side1Layout[1][0].page, rot: side1Layout[1][0].rot, expected: 0 }
  ];
  return readingOrder;
}

// ============ Simulate folding for 1x2 sheet (one fold only) ============
function simulateFoldForSheet_1x2(side1Layout, side2Layout) {
  // After folding once (no slit), reading order is:
  // 1. Front cover: side1[0][1] (right half of side 1)
  // 2. Page 2: side2[0][0] (left half of side 2, which becomes right after flip)
  // 3. Page 3: side2[0][1] (right half of side 2, which becomes left after flip)
  // 4. Back cover: side1[0][0] (left half of side 1)
  // All pages are upright (no rotation needed for single fold)
  const readingOrder = [
    { page: side1Layout[0][1].page, rot: side1Layout[0][1].rot, expected: 0 },
    { page: side2Layout[0][0].page, rot: side2Layout[0][0].rot, expected: 0 },
    { page: side2Layout[0][1].page, rot: side2Layout[0][1].rot, expected: 0 },
    { page: side1Layout[0][0].page, rot: side1Layout[0][0].rot, expected: 0 }
  ];
  return readingOrder;
}

// ============ Geometry verification ============
function verifyGeometry(orient, stockType, format) {
  const geo = format === '2x2' ? GEOMETRY_2x2[orient] : GEOMETRY_1x2[orient];
  const page = geo.page;
  const sheet = geo.sheet[stockType];
  
  if (!sheet) {
    return { passed: true, skipped: true, reason: `${stockType} not applicable for ${format}` };
  }
  
  const errors = [];
  
  // Get grid dimensions from geometry config, or default for 2x2
  const cols = geo.gridCols || 2;
  const rows = geo.gridRows || (format === '2x2' ? 2 : 1);
  
  const blockW = cols * page.w;
  const blockH = rows * page.h;
  
  const spareW = sheet.w - blockW;
  const spareH = sheet.h - blockH;
  
  // Check cells fit on sheet
  if (blockW > sheet.w) {
    errors.push(`Pages too wide: ${blockW}mm > sheet ${sheet.w}mm`);
  }
  if (blockH > sheet.h) {
    errors.push(`Pages too tall: ${blockH}mm > sheet ${sheet.h}mm`);
  }
  
  // Check spare is reasonable (allow up to 30mm for SRA3, 6mm for A3)
  const maxSpare = stockType === 'A3' ? 3 : 30;
  if (spareW < 0) {
    errors.push(`Negative horizontal spare: ${spareW}mm`);
  } else if (spareW > maxSpare * 2 && stockType === 'A3') {
    errors.push(`Excessive horizontal spare: ${spareW}mm (max ${maxSpare * 2}mm for ${stockType})`);
  }
  if (spareH < 0) {
    errors.push(`Negative vertical spare: ${spareH}mm`);
  } else if (spareH > maxSpare * 2 && stockType === 'A3') {
    errors.push(`Excessive vertical spare: ${spareH}mm (max ${maxSpare * 2}mm for ${stockType})`);
  }
  
  return {
    passed: errors.length === 0,
    page,
    sheet,
    spare: { w: spareW, h: spareH },
    grid: { rows, cols },
    errors
  };
}

// ============ Verify imposition table is valid ============
function verifyImpositionTable(format) {
  // Verify that production tables in imposition.js have correct structure
  const base = format === '2x2' ? BASE_IMPOSITION_2x2 : BASE_IMPOSITION_1x2;
  
  // Expected structure based on format
  const expectedRows = format === '2x2' ? 2 : 1;
  
  // Verify structure
  const errors = [];
  
  if (!base || !base.side1 || !base.side2) {
    return { passed: false, errors: ['Missing table or sides'] };
  }
  
  if (base.side1.length !== expectedRows || base.side2.length !== expectedRows) {
    errors.push(`Expected ${expectedRows} row(s), got side1:${base.side1.length}, side2:${base.side2.length}`);
  }
  
  // Verify expected values match known-correct imposition
  if (format === '2x2') {
    // Expected: side1=[[5,4],[8,1]], side2=[[3,6],[2,7]], rotatedRow=0
    const expected = { side1: [[5,4],[8,1]], side2: [[3,6],[2,7]], rotatedRow: 0 };
    if (JSON.stringify(base.side1) !== JSON.stringify(expected.side1)) {
      errors.push(`2x2 side1 mismatch: expected ${JSON.stringify(expected.side1)}, got ${JSON.stringify(base.side1)}`);
    }
    if (JSON.stringify(base.side2) !== JSON.stringify(expected.side2)) {
      errors.push(`2x2 side2 mismatch: expected ${JSON.stringify(expected.side2)}, got ${JSON.stringify(base.side2)}`);
    }
    if (base.rotatedRow !== expected.rotatedRow) {
      errors.push(`2x2 rotatedRow mismatch: expected ${expected.rotatedRow}, got ${base.rotatedRow}`);
    }
  } else {
    // Expected: side1=[[4,1]], side2=[[2,3]], rotatedRow=-1
    const expected = { side1: [[4,1]], side2: [[2,3]], rotatedRow: -1 };
    if (JSON.stringify(base.side1) !== JSON.stringify(expected.side1)) {
      errors.push(`1x2 side1 mismatch: expected ${JSON.stringify(expected.side1)}, got ${JSON.stringify(base.side1)}`);
    }
    if (JSON.stringify(base.side2) !== JSON.stringify(expected.side2)) {
      errors.push(`1x2 side2 mismatch: expected ${JSON.stringify(expected.side2)}, got ${JSON.stringify(base.side2)}`);
    }
    if (base.rotatedRow !== expected.rotatedRow) {
      errors.push(`1x2 rotatedRow mismatch: expected ${expected.rotatedRow}, got ${base.rotatedRow}`);
    }
  }
  
  return { 
    passed: errors.length === 0, 
    actual: base,
    errors 
  };
}


// ============ Main verification ============
function verify(pageCount, orient, format) {
  const pagesPerSheet = format === '2x2' ? 8 : 4;
  
  console.log(`=== Bookletter Fold Verification (${format}, ${orient}) ===`);
  console.log('Format:', format === '2x2' ? '2×2 grid (8 pages/sheet, two folds + slit)' : '1×2 grid (4 pages/sheet, one fold)');
  console.log('Page count:', pageCount);
  const sheetCount = Math.ceil(pageCount / pagesPerSheet);
  console.log('Sheet count:', sheetCount);
  console.log('');

  let allPassed = true;

  // ====== Geometry Check ======
  console.log('--- Geometry Check ---');
  const stocks = format === '2x2' ? ['A3', 'SRA3'] : ['A3', 'SRA3'];
  for (const stock of stocks) {
    const geo = verifyGeometry(orient, stock, format);
    if (geo.skipped) {
      console.log(`  ${stock}: ${geo.reason} (skipped)`);
      continue;
    }
    console.log(`  ${stock}: page ${geo.page.w}×${geo.page.h}mm, sheet ${geo.sheet.w}×${geo.sheet.h}mm`);
    console.log(`         spare: ${geo.spare.w.toFixed(1)}mm × ${geo.spare.h.toFixed(1)}mm`);
    if (geo.passed) {
      console.log(`         ${stock} geometry OK v`);
    } else {
      console.log(`         ${stock} geometry FAILED x`);
      geo.errors.forEach(e => console.log(`           ERROR: ${e}`));
      allPassed = false;
    }
  }
  console.log('');

  // ====== Reading Sequence Check ======
  console.log('--- Reading Sequence Check ---');
  
  // Use production function from imposition.js with format parameter
  const fullReadingOrder = getBookletReadingOrder(pageCount, format);
  
  const expectedSequence = Array.from({ length: pageCount }, (_, i) => i + 1);
  
  console.log('Expected sequence: 1,2,3,...,' + pageCount);
  console.log('Actual sequence:   ' + fullReadingOrder.join(','));
  
  const seqMatch = JSON.stringify(fullReadingOrder) === JSON.stringify(expectedSequence);
  if (!seqMatch) {
    console.log('');
    console.log('READING ORDER MISMATCH!');
    for (let i = 0; i < Math.max(fullReadingOrder.length, expectedSequence.length); i++) {
      if (fullReadingOrder[i] !== expectedSequence[i]) {
        console.log(`First divergence at position ${i + 1}:`);
        console.log(`  Expected page: ${expectedSequence[i]}`);
        console.log(`  Actual page:   ${fullReadingOrder[i]}`);
        break;
      }
    }
    console.log('');
    console.log('FAIL: Reading sequence verification failed x');
    allPassed = false;
  } else {
    console.log('Reading sequence correct v');
  }
  console.log('');

  // ====== Rotation Check ======
  console.log('--- Rotation Check ---');
  
  for (let sheetNum = 1; sheetNum <= sheetCount; sheetNum++) {
    // Use production computeImposition with format parameter
    const imp = computeImposition(sheetNum, pageCount, format);
    const side1Layout = buildSheetLayout(imp.side1, imp.rotatedRow);
    const side2Layout = buildSheetLayout(imp.side2, imp.rotatedRow);
    const readingOrder = format === '2x2' 
      ? simulateFoldForSheet_2x2(side1Layout, side2Layout)
      : simulateFoldForSheet_1x2(side1Layout, side2Layout);
    
    console.log(`  Sheet ${sheetNum}:`);
    let sheetPassed = true;
    
    for (const entry of readingOrder) {
      if (entry.rot !== entry.expected) {
        console.log(`    Page ${entry.page}: FAIL - printed at ${entry.rot}°, expected ${entry.expected}°`);
        sheetPassed = false;
        allPassed = false;
      }
    }
    
    if (sheetPassed) {
      const rotSummary = format === '2x2' 
        ? 'top row 180°, bottom row 0°'
        : 'all pages 0° (no rotation for single fold)';
      console.log(`    All rotations correct (${rotSummary}) v`);
    }
  }
  console.log('');

  // ====== Coverage Check ======
  console.log('--- Coverage Check ---');
  const allPages = new Set();
  const duplicates = [];
  
  for (let sheetNum = 1; sheetNum <= sheetCount; sheetNum++) {
    // Use production computeImposition with format parameter
    const imp = computeImposition(sheetNum, pageCount, format);
    
    const pages = [...imp.side1.flat(), ...imp.side2.flat()];
    for (const p of pages) {
      if (allPages.has(p)) {
        duplicates.push(p);
      }
      allPages.add(p);
    }
  }
  
  if (duplicates.length > 0) {
    console.log('DUPLICATE PAGES:', duplicates.join(', '));
    allPassed = false;
  }
  
  const missing = [];
  for (let p = 1; p <= pageCount; p++) {
    if (!allPages.has(p)) {
      missing.push(p);
    }
  }
  
  if (missing.length > 0) {
    console.log('MISSING PAGES:', missing.join(', '));
    allPassed = false;
  } else {
    console.log('All pages 1-' + pageCount + ' present v');
  }
  console.log('');

  // ====== Position Check ======
  console.log('--- Position Check ---');
  
  let page1Pos, pageNPos;
  
  // Use production computeImposition with format parameter
  const sheet1Imp = computeImposition(1, pageCount, format);
  const lastSheetImp = computeImposition(sheetCount, pageCount, format);
  
  if (format === '2x2') {
    page1Pos = sheet1Imp.side1[1][1];  // bottom-right
    pageNPos = lastSheetImp.side1[1][0];  // bottom-left
    
    if (page1Pos !== 1) {
      console.log(`ERROR: Page 1 should be at sheet 1 side 1 bottom-right [1][1], but found ${page1Pos}`);
      allPassed = false;
    } else {
      console.log('Page 1 at correct position (sheet 1, side 1, [1][1] bottom-right) v');
    }
    
    if (pageNPos !== pageCount) {
      console.log(`ERROR: Page ${pageCount} should be at sheet ${sheetCount} side 1 bottom-left [1][0], but found ${pageNPos}`);
      allPassed = false;
    } else {
      console.log(`Page ${pageCount} at correct position (sheet ${sheetCount}, side 1, [1][0] bottom-left) v`);
    }
  } else {
    page1Pos = sheet1Imp.side1[0][1];  // right column of single row
    pageNPos = lastSheetImp.side1[0][0];  // left column of single row
    
    if (page1Pos !== 1) {
      console.log(`ERROR: Page 1 should be at sheet 1 side 1 [0][1] (right), but found ${page1Pos}`);
      allPassed = false;
    } else {
      console.log('Page 1 at correct position (sheet 1, side 1, [0][1] right = front cover) v');
    }
    
    if (pageNPos !== pageCount) {
      console.log(`ERROR: Page ${pageCount} should be at sheet ${sheetCount} side 1 [0][0] (left), but found ${pageNPos}`);
      allPassed = false;
    } else {
      console.log(`Page ${pageCount} at correct position (sheet ${sheetCount}, side 1, [0][0] left = back cover) v`);
    }
  }
  console.log('');

  // ====== Safe Bands Check ======
  console.log('--- Safe Bands Check ---');
  
  if (format === '2x2') {
    // Expected unsafe sides per page for 2x2 (derived from imposition)
    const expectedUnsafeSides_2x2 = {
      1: ['bottom', 'right'],
      2: ['bottom', 'left'],
      3: ['top', 'left'],
      4: ['top', 'right'],
      5: ['top', 'left'],
      6: ['top', 'right'],
      7: ['bottom', 'right'],
      8: ['bottom', 'left']
    };
    
    const testSafe = 6;
    console.log(`  Testing with safe=${testSafe}mm on A3 ${orient} (2x2):`);
    
    for (let p = 0; p < Math.min(pageCount, 8); p++) {
      const bands = pageSafeBands(p, pageCount, orient, 'A3', testSafe);
      const pageNum = p + 1;
      const expected = expectedUnsafeSides_2x2[pageNum] || expectedUnsafeSides_2x2[((pageNum - 1) % 8) + 1];
      const actual = bands.unsafeSides.sort();
      const expectedSorted = expected.sort();
      
      const match = JSON.stringify(actual) === JSON.stringify(expectedSorted);
      if (!match) {
        console.log(`    Page ${pageNum}: FAIL - expected [${expectedSorted}], got [${actual}]`);
        allPassed = false;
      } else {
        console.log(`    Page ${pageNum}: [${actual}] v`);
      }
    }
    
    // Test SRA3 with safe = 3mm (should give zero bands)
    console.log(`  Testing SRA3 with safe=3mm (expect zero bands):`);
    const sra3Bands = pageSafeBands(0, pageCount, orient, 'SRA3', 3);
    const allZero = sra3Bands.top === 0 && sra3Bands.right === 0 && sra3Bands.bottom === 0 && sra3Bands.left === 0;
    if (allZero) {
      console.log(`    SRA3: All bands zero v (spare: ${sra3Bands.spareX.toFixed(1)}mm x ${sra3Bands.spareY.toFixed(1)}mm)`);
    } else {
      console.log(`    SRA3: FAIL - expected zero bands, got ${sra3Bands.top}/${sra3Bands.right}/${sra3Bands.bottom}/${sra3Bands.left}mm`);
      allPassed = false;
    }
  } else {
    // 1x2: Each page spans full sheet width, so has 3 unsafe sides
    // Pages on side 1: left, right, and bottom unsafe (fold is at top)
    // Pages on side 2: left, right, and top unsafe (fold is at bottom after flip)
    const expectedUnsafeSides_1x2 = {
      1: ['left', 'right', 'bottom'],  // side1[0][1] - front cover
      2: ['left', 'right', 'top'],     // side2[0][0] - inside left
      3: ['left', 'right', 'top'],     // side2[0][1] - inside right
      4: ['left', 'right', 'bottom']   // side1[0][0] - back cover
    };
    
    console.log(`  Expected unsafe sides for 1x2 (3 sides per page):`);
    for (let p = 1; p <= 4; p++) {
      const expected = expectedUnsafeSides_1x2[p];
      console.log(`    Page ${p}: [${expected.join(', ')}] (only fold side is safe)`);
    }
    console.log('  Note: pageSafeBands not yet extended for 1x2 format');
  }
  console.log('');

  // ====== Summary ======
  if (allPassed) {
    console.log(`PASS: All ${format} ${pageCount}-page ${orient} imposition tests passed v`);
  } else {
    console.log(`FAIL: ${format} ${orient} imposition verification failed x`);
  }
  
  return allPassed;
}

// ============ CLI ============
function main() {
  const args = process.argv.slice(2);
  let pageCount = null;  // will be set based on format
  let orient = null;     // null means test both
  let format = '2x2';    // default format
  let testAll = false;
  
  for (const arg of args) {
    if (arg.startsWith('--pages=')) {
      pageCount = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--orient=')) {
      orient = arg.split('=')[1];
    } else if (arg.startsWith('--format=')) {
      format = arg.split('=')[1];
    } else if (arg === '--all') {
      testAll = true;
    }
  }
  
  // Validate format
  if (!VALID_FORMATS.includes(format)) {
    console.error(`ERROR: Invalid format '${format}'. Must be '2x2' or '1x2'.`);
    process.exit(1);
  }
  
  // Set default page count based on format
  const validPageCounts = format === '2x2' ? VALID_PAGE_COUNTS_2x2 : VALID_PAGE_COUNTS_1x2;
  if (pageCount === null) {
    pageCount = validPageCounts[0];  // 8 for 2x2, 4 for 1x2
  }
  
  if (!validPageCounts.includes(pageCount) && !testAll) {
    console.error(`ERROR: Invalid page count ${pageCount} for ${format} format. Must be ${validPageCounts.join(', ')}.`);
    process.exit(1);
  }
  
  if (orient && !VALID_ORIENTATIONS.includes(orient)) {
    console.error(`ERROR: Invalid orientation '${orient}'. Must be 'portrait' or 'landscape'.`);
    process.exit(1);
  }
  
  // First verify that the imposition table is correct
  console.log(`=== Imposition Table Check (${format}) ===`);
  const tableCheck = verifyImpositionTable(format);
  
  if (tableCheck.passed) {
    console.log(`${format.toUpperCase()} imposition table matches expected v`);
    console.log(`  Side 1: ${JSON.stringify(tableCheck.actual.side1)}`);
    console.log(`  Side 2: ${JSON.stringify(tableCheck.actual.side2)}`);
    console.log(`  Rotated row: ${tableCheck.actual.rotatedRow} (${tableCheck.actual.rotatedRow >= 0 ? 'top row' : 'none'})`);
  } else {
    console.log(`${format.toUpperCase()} imposition table does not match expected x`);
    for (const err of tableCheck.errors) {
      console.log('  ERROR:', err);
    }
    process.exit(1);
  }
  console.log('');
  
  // Determine which tests to run
  const pageCounts = testAll ? validPageCounts : [pageCount];
  const orientations = orient ? [orient] : VALID_ORIENTATIONS;
  
  let allPassed = true;
  
  for (const pc of pageCounts) {
    for (const o of orientations) {
      const passed = verify(pc, o, format);
      if (!passed) {
        allPassed = false;
      }
      console.log('');
    }
  }
  
  // Final summary
  console.log('=== Final Summary ===');
  if (allPassed) {
    const count = pageCounts.length * orientations.length;
    console.log(`PASS: All ${count} ${format} configuration(s) verified successfully v`);
    process.exit(0);
  } else {
    console.log(`FAIL: One or more ${format} configurations failed x`);
    process.exit(1);
  }
}

main();
