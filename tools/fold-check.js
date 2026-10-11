#!/usr/bin/env node
/**
 * Fold check — verifies nested imposition for 1, 2, or 3 sheet booklets.
 * 
 * Simulates the folding process for each sheet:
 * 1. Fold top half back behind the sheet
 * 2. Fold left half back behind the right half
 * 3. Slit the top fold
 * 
 * For multi-sheet booklets, verifies nested saddle-stitch order:
 * - All pages 1..N appear exactly once across all sheets
 * - Page 1 is always on sheet 1, side 1, bottom-right (the cover after folding)
 * - Page N is always on sheet 1, side 1, bottom-left (back cover)
 * 
 * Usage:
 *   node tools/fold-check.js             # Test 8 pages (default)
 *   node tools/fold-check.js --pages=16  # Test 16 pages
 *   node tools/fold-check.js --pages=24  # Test 24 pages
 */

const VALID_PAGE_COUNTS = [8, 16, 24];

// ============ Imposition computation ============
// Matches js/50-sheets.js computeImposition()
function computeImposition(sheetIndex, pageCount) {
  const k = sheetIndex;  // 1-based
  const N = pageCount;
  const a = 4 * (k - 1) + 1;
  const b = N - 4 * (k - 1);
  return {
    side1: [[b - 3, a + 3], [b, a]],
    side2: [[a + 2, b - 2], [a + 1, b - 1]],
    rotatedRow: 0
  };
}

// ============ Build physical sheet layout ============
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

// ============ Simulate folding for one sheet ============
/**
 * Physical folding process:
 * 1. Side 1 up, portrait orientation
 * 2. Fold top half BACK (behind the sheet)
 * 3. Fold left half BACK (behind the right half)
 * 4. Slit the top fold
 * 
 * Returns the 8 pages in reading order for this sheet.
 * For the OUTERMOST sheet (sheet 1), these are pages 1-4 and N-3..N.
 * For inner sheets, these are middle pages.
 */
function simulateFoldForSheet(side1Layout, side2Layout) {
  // After folding, the reading order is determined by physical positions:
  // Page positions after folding (verified manually):
  const readingOrder = [
    // Position 1 (cover): side1[1][1] = bottom-right of side 1
    { page: side1Layout[1][1].page, rot: side1Layout[1][1].rot, expected: 0 },
    // Position 2: side2[1][0] = bottom-left of side 2 (at right after flip)
    { page: side2Layout[1][0].page, rot: side2Layout[1][0].rot, expected: 0 },
    // Position 3: side2[0][0] = top-left of side 2 (after slit)
    { page: side2Layout[0][0].page, rot: side2Layout[0][0].rot, expected: 180 },
    // Position 4: side1[0][1] = top-right of side 1 (after slit)
    { page: side1Layout[0][1].page, rot: side1Layout[0][1].rot, expected: 180 },
    // Position 5: side1[0][0] = top-left of side 1 (center spread right)
    { page: side1Layout[0][0].page, rot: side1Layout[0][0].rot, expected: 180 },
    // Position 6: side2[0][1] = top-right of side 2 (at left after flip)
    { page: side2Layout[0][1].page, rot: side2Layout[0][1].rot, expected: 180 },
    // Position 7: side2[1][1] = bottom-right of side 2 (at left after flip)
    { page: side2Layout[1][1].page, rot: side2Layout[1][1].rot, expected: 0 },
    // Position 8 (back cover): side1[1][0] = bottom-left of side 1
    { page: side1Layout[1][0].page, rot: side1Layout[1][0].rot, expected: 0 }
  ];
  return readingOrder;
}

// ============ Main verification ============
function verify(pageCount) {
  console.log('=== Bookletter Fold Verification ===');
  console.log('Page count:', pageCount);
  console.log('Sheet count:', pageCount / 8);
  console.log('');

  const sheetCount = pageCount / 8;
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
      
      // Track all pages
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

  // Verify all pages are present
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
  
  // Verify page 1 is at correct position (sheet 1, side 1, bottom-right)
  const sheet1Imp = computeImposition(1, pageCount);
  const page1Pos = sheet1Imp.side1[1][1];  // bottom-right
  const pageNPos = sheet1Imp.side1[1][0];  // bottom-left
  
  if (page1Pos !== 1) {
    console.log(`ERROR: Page 1 should be at sheet 1 side 1 bottom-right, but found ${page1Pos}`);
    allPassed = false;
  } else {
    console.log('Page 1 at correct position (sheet 1, side 1, bottom-right) v');
  }
  
  if (pageNPos !== pageCount) {
    console.log(`ERROR: Page ${pageCount} should be at sheet 1 side 1 bottom-left, but found ${pageNPos}`);
    allPassed = false;
  } else {
    console.log(`Page ${pageCount} at correct position (sheet 1, side 1, bottom-left) v`);
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
