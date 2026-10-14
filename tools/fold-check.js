#!/usr/bin/env node
/**
 * Fold check — verifies imposition for 1, 2, or 3 sheet booklets.
 * 
 * Uses js/imposition.js (single source of truth) for the imposition tables.
 * 
 * Verifies:
 * 1. READING SEQUENCE: Concatenating all sheets' reading orders produces 1,2,3,...,N
 * 2. COVERAGE: All pages 1..N appear exactly once across all sheets
 * 3. ROTATIONS: Top row pages print at 180°, bottom row at 0°
 * 4. POSITIONS: Page 1 at sheet 1 side 1 bottom-right, page N at bottom-left
 * 5. GEOMETRY: Cell and sheet dimensions match expected values for orientation
 * 
 * Usage:
 *   node tools/fold-check.js                       # Test all orientations, 8 pages
 *   node tools/fold-check.js --pages=16            # Test all orientations, 16 pages
 *   node tools/fold-check.js --pages=24            # Test all orientations, 24 pages
 *   node tools/fold-check.js --orient=portrait     # Test portrait only
 *   node tools/fold-check.js --orient=landscape    # Test landscape only
 *   node tools/fold-check.js --all                 # Test all page counts, both orientations
 */

const imposition = require('../js/imposition.js');
const { computeImposition, getSheetReadingOrder, getBookletReadingOrder, verifyReadingOrder, BASE_IMPOSITION } = imposition;

const VALID_PAGE_COUNTS = [8, 16, 24];
const VALID_ORIENTATIONS = ['portrait', 'landscape'];

// ============ Geometry constants ============
const GEOMETRY = {
  portrait: {
    page: { w: 148, h: 210 },
    sheet: { A3: { w: 297, h: 420 }, SRA3: { w: 320, h: 450 } }
  },
  landscape: {
    page: { w: 210, h: 148 },
    sheet: { A3: { w: 420, h: 297 }, SRA3: { w: 450, h: 320 } }
  }
};

// ============ Build physical sheet layout with rotation info ============
function buildSheetLayout(grid, rotatedRow) {
  const layout = [];
  for (let r = 0; r < 2; r++) {
    const row = [];
    for (let c = 0; c < 2; c++) {
      row.push({
        page: grid[r][c],
        rot: r === rotatedRow ? 180 : 0
      });
    }
    layout.push(row);
  }
  return layout;
}

// ============ Simulate folding for one sheet (with rotation checks) ============
function simulateFoldForSheet(side1Layout, side2Layout) {
  // After folding, the reading order is determined by physical positions.
  // Each position has expected rotation after the folds.
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
    // Position 8 (back cover of this sheet): side1[1][0] = bottom-left of side 1 - upright
    { page: side1Layout[1][0].page, rot: side1Layout[1][0].rot, expected: 0 }
  ];
  return readingOrder;
}

// ============ Geometry verification ============
function verifyGeometry(orient, stockType) {
  const geo = GEOMETRY[orient];
  const page = geo.page;
  const sheet = geo.sheet[stockType];
  
  let passed = true;
  const errors = [];
  
  // Verify page fits 4x in sheet (2 cols × 2 rows)
  const blockW = page.w * 2;
  const blockH = page.h * 2;
  
  // Sheet must contain the 2×2 block
  if (blockW > sheet.w) {
    errors.push(`2×2 block width ${blockW}mm exceeds sheet width ${sheet.w}mm`);
    passed = false;
  }
  if (blockH > sheet.h) {
    errors.push(`2×2 block height ${blockH}mm exceeds sheet height ${sheet.h}mm`);
    passed = false;
  }
  
  // Calculate spare margins
  const spareW = sheet.w - blockW;
  const spareH = sheet.h - blockH;
  
  // For A3, spare should be ~0.5mm per side (1mm total)
  // For SRA3, spare allows for 3mm bleed + crop marks
  if (stockType === 'A3') {
    if (spareW < 0 || spareW > 2) {
      errors.push(`A3 spare width ${spareW}mm not in expected range [0, 2]`);
      passed = false;
    }
    if (spareH < 0 || spareH > 2) {
      errors.push(`A3 spare height ${spareH}mm not in expected range [0, 2]`);
      passed = false;
    }
  } else if (stockType === 'SRA3') {
    // SRA3 should have ~23mm spare on each axis for 3mm bleed + marks
    if (spareW < 20 || spareW > 30) {
      errors.push(`SRA3 spare width ${spareW}mm not in expected range [20, 30]`);
      passed = false;
    }
    if (spareH < 20 || spareH > 30) {
      errors.push(`SRA3 spare height ${spareH}mm not in expected range [20, 30]`);
      passed = false;
    }
  }
  
  // Cell position formula check
  const ox = (sheet.w - blockW) / 2;
  const oy = (sheet.h - blockH) / 2;
  
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const left = ox + c * page.w;
      const top = oy + r * page.h;
      
      // Verify cell is within sheet bounds
      if (left < 0 || left + page.w > sheet.w) {
        errors.push(`Cell [${r}][${c}] x-range [${left}, ${left + page.w}] exceeds sheet width ${sheet.w}`);
        passed = false;
      }
      if (top < 0 || top + page.h > sheet.h) {
        errors.push(`Cell [${r}][${c}] y-range [${top}, ${top + page.h}] exceeds sheet height ${sheet.h}`);
        passed = false;
      }
    }
  }
  
  return { passed, errors, page, sheet, spare: { w: spareW, h: spareH } };
}

// ============ Verify imposition table is orientation-agnostic ============
function verifyImpositionInvariance() {
  // The imposition table should be the same for both orientations
  // Only geometry changes; panel assignment and rotation rules stay constant
  const expected = {
    side1: [[5, 4], [8, 1]],
    side2: [[3, 6], [2, 7]],
    rotatedRow: 0
  };
  
  const actual = BASE_IMPOSITION;
  
  const match = 
    JSON.stringify(actual.side1) === JSON.stringify(expected.side1) &&
    JSON.stringify(actual.side2) === JSON.stringify(expected.side2) &&
    actual.rotatedRow === expected.rotatedRow;
  
  return {
    passed: match,
    expected,
    actual
  };
}

// ============ Main verification ============
function verify(pageCount, orient) {
  console.log(`=== Bookletter Fold Verification (${orient}) ===`);
  console.log('Page count:', pageCount);
  const sheetCount = pageCount / 8;
  console.log('Sheet count:', sheetCount);
  console.log('');

  // ====== Geometry Check ======
  console.log('--- Geometry Check ---');
  for (const stock of ['A3', 'SRA3']) {
    const geo = verifyGeometry(orient, stock);
    console.log(`  ${stock}: page ${geo.page.w}×${geo.page.h}mm, sheet ${geo.sheet.w}×${geo.sheet.h}mm`);
    console.log(`         spare: ${geo.spare.w}mm × ${geo.spare.h}mm (0.5mm per side)`);
    if (geo.passed) {
      console.log(`         ${stock} geometry OK v`);
    } else {
      console.log(`         ${stock} geometry FAILED x`);
      geo.errors.forEach(e => console.log(`           ERROR: ${e}`));
      return false;
    }
  }
  console.log('');

  // ====== CRITICAL CHECK: Reading sequence must be 1,2,3,...,N ======
  console.log('--- Reading Sequence Check ---');
  const fullReadingOrder = getBookletReadingOrder(pageCount);
  const expectedSequence = Array.from({ length: pageCount }, (_, i) => i + 1);
  
  console.log('Expected sequence: 1,2,3,...,' + pageCount);
  console.log('Actual sequence:   ' + fullReadingOrder.join(','));
  
  const seqError = verifyReadingOrder(pageCount);
  if (seqError) {
    console.log('');
    console.log('READING ORDER MISMATCH!');
    console.log('First divergence at position ' + (seqError.firstMismatch.position + 1) + ':');
    console.log('  Expected page: ' + seqError.firstMismatch.expectedPage);
    console.log('  Actual page:   ' + seqError.firstMismatch.actualPage);
    console.log('');
    console.log('FAIL: Reading sequence verification failed x');
    return false;
  }
  console.log('Reading sequence correct v');
  console.log('');

  // ====== Per-sheet verification (rotations, duplicates) ======
  const allPages = new Set();
  let allPassed = true;

  for (let k = 1; k <= sheetCount; k++) {
    console.log(`--- Sheet ${k} of ${sheetCount} ---`);
    
    const imp = computeImposition(k, pageCount);
    console.log('  Side 1:', JSON.stringify(imp.side1));
    console.log('  Side 2:', JSON.stringify(imp.side2));
    
    const side1Layout = buildSheetLayout(imp.side1, imp.rotatedRow);
    const side2Layout = buildSheetLayout(imp.side2, imp.rotatedRow);
    
    const readingOrder = simulateFoldForSheet(side1Layout, side2Layout);
    
    console.log('  Reading order after fold:');
    let sheetPassed = true;
    
    for (let i = 0; i < 8; i++) {
      const entry = readingOrder[i];
      const rotOk = entry.rot === entry.expected;
      const status = rotOk ? 'v' : 'x';
      
      if (!rotOk) {
        sheetPassed = false;
        allPassed = false;
      }
      
      // Track all pages for coverage check
      if (allPages.has(entry.page)) {
        console.log(`    Position ${i + 1}: Page ${entry.page} - DUPLICATE! x`);
        sheetPassed = false;
        allPassed = false;
      } else {
        allPages.add(entry.page);
        console.log(`    Position ${i + 1}: Page ${entry.page} (${entry.rot}° printed, ${entry.expected}° expected) ${status}`);
      }
    }
    
    if (sheetPassed) {
      console.log('  Sheet OK v');
    } else {
      console.log('  Sheet FAILED x');
    }
    console.log('');
  }

  // ====== Coverage Check ======
  console.log('--- Coverage Check ---');
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
  
  // ====== Position Check ======
  // Page 1 is always on sheet 1, side 1, bottom-right (front cover)
  const sheet1Imp = computeImposition(1, pageCount);
  const page1Pos = sheet1Imp.side1[1][1];  // bottom-right
  
  if (page1Pos !== 1) {
    console.log(`ERROR: Page 1 should be at sheet 1 side 1 bottom-right, but found ${page1Pos}`);
    allPassed = false;
  } else {
    console.log('Page 1 at correct position (sheet 1, side 1, bottom-right) v');
  }
  
  // Page N is on the LAST sheet, side 1, bottom-left (back cover of innermost section)
  const lastSheetImp = computeImposition(sheetCount, pageCount);
  const pageNPos = lastSheetImp.side1[1][0];  // bottom-left of last sheet
  
  if (pageNPos !== pageCount) {
    console.log(`ERROR: Page ${pageCount} should be at sheet ${sheetCount} side 1 bottom-left, but found ${pageNPos}`);
    allPassed = false;
  } else {
    console.log(`Page ${pageCount} at correct position (sheet ${sheetCount}, side 1, bottom-left) v`);
  }
  
  console.log('');
  if (allPassed) {
    console.log(`PASS: All ${pageCount}-page ${orient} imposition tests passed v`);
  } else {
    console.log(`FAIL: ${orient} imposition verification failed x`);
  }
  
  return allPassed;
}

// ============ CLI ============
function main() {
  const args = process.argv.slice(2);
  let pageCount = 8;
  let orient = null;  // null means test both
  let testAll = false;
  
  for (const arg of args) {
    if (arg.startsWith('--pages=')) {
      pageCount = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--orient=')) {
      orient = arg.split('=')[1];
    } else if (arg === '--all') {
      testAll = true;
    }
  }
  
  if (!VALID_PAGE_COUNTS.includes(pageCount) && !testAll) {
    console.error(`ERROR: Invalid page count ${pageCount}. Must be 8, 16, or 24.`);
    process.exit(1);
  }
  
  if (orient && !VALID_ORIENTATIONS.includes(orient)) {
    console.error(`ERROR: Invalid orientation '${orient}'. Must be 'portrait' or 'landscape'.`);
    process.exit(1);
  }
  
  // First verify that the imposition table is orientation-agnostic
  console.log('=== Imposition Table Invariance Check ===');
  const invCheck = verifyImpositionInvariance();
  if (invCheck.passed) {
    console.log('BASE_IMPOSITION matches expected table v');
    console.log(`  Side 1: ${JSON.stringify(invCheck.actual.side1)}`);
    console.log(`  Side 2: ${JSON.stringify(invCheck.actual.side2)}`);
    console.log(`  Rotated row: ${invCheck.actual.rotatedRow} (top)`);
    console.log('');
    console.log('This confirms the imposition is IDENTICAL for portrait and landscape.');
    console.log('The fold sequence produces the same page assignment regardless of aspect ratio.');
  } else {
    console.log('BASE_IMPOSITION does not match expected x');
    console.log('Expected:', JSON.stringify(invCheck.expected));
    console.log('Actual:', JSON.stringify(invCheck.actual));
    process.exit(1);
  }
  console.log('');
  
  // Determine which tests to run
  const pageCounts = testAll ? VALID_PAGE_COUNTS : [pageCount];
  const orientations = orient ? [orient] : VALID_ORIENTATIONS;
  
  let allPassed = true;
  
  for (const pc of pageCounts) {
    for (const o of orientations) {
      const passed = verify(pc, o);
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
    console.log(`PASS: All ${count} configuration(s) verified successfully v`);
    process.exit(0);
  } else {
    console.log('FAIL: One or more configurations failed x');
    process.exit(1);
  }
}

main();
