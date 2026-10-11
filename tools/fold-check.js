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
 * 
 * Usage:
 *   node tools/fold-check.js             # Test 8 pages (default)
 *   node tools/fold-check.js --pages=16  # Test 16 pages
 *   node tools/fold-check.js --pages=24  # Test 24 pages
 */

const imposition = require('../js/imposition.js');
const { computeImposition, getSheetReadingOrder, getBookletReadingOrder, verifyReadingOrder } = imposition;

const VALID_PAGE_COUNTS = [8, 16, 24];

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

// ============ Main verification ============
function verify(pageCount) {
  console.log('=== Bookletter Fold Verification ===');
  console.log('Page count:', pageCount);
  const sheetCount = pageCount / 8;
  console.log('Sheet count:', sheetCount);
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
    console.log('PASS: All ' + pageCount + '-page imposition tests passed v');
  } else {
    console.log('FAIL: Imposition verification failed x');
  }
  
  return allPassed;
}

// ============ CLI ============
function main() {
  const args = process.argv.slice(2);
  let pageCount = 8;
  
  for (const arg of args) {
    if (arg.startsWith('--pages=')) {
      pageCount = parseInt(arg.split('=')[1], 10);
    }
  }
  
  if (!VALID_PAGE_COUNTS.includes(pageCount)) {
    console.error(`ERROR: Invalid page count ${pageCount}. Must be 8, 16, or 24.`);
    process.exit(1);
  }
  
  const passed = verify(pageCount);
  process.exit(passed ? 0 : 1);
}

main();
