/**
 * Bookletter — imposition and print engine
 * Supports both 2x2 (8 pages/sheet) and 1x2 (4 pages/sheet) formats.
 * All geometry in millimetres.
 * 
 * Imposition is computed by js/imposition.js (single source of truth).
 */
(function() {
  'use strict';
  var BL = window.BL;

  // Legacy: BL.IMPOSITION for backward compatibility (sheet 1 of current booklet)
  Object.defineProperty(BL, 'IMPOSITION', {
    get: function() {
      return BL.computeImposition(1, BL.S.pages.length, BL.getFormat());
    }
  });

  // ============ Bleed state ============
  var bleed = 0;  // 0 or 3 mm

  BL.getBleed = function() { return bleed; };
  BL.setBleed = function(v) { bleed = v; };

  // ============ Flip sheet backs (device workaround) ============
  var flipSheetBacks = localStorage.getItem('flipSheetBacks') === 'true';

  BL.getFlipSheetBacks = function() { return flipSheetBacks; };
  BL.setFlipSheetBacks = function(v) {
    flipSheetBacks = !!v;
    localStorage.setItem('flipSheetBacks', flipSheetBacks ? 'true' : 'false');
  };

  // ============ Check if bleed is allowed ============
  function canBleed() {
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    return paper === 'SRA3';
  }
  BL.canBleed = canBleed;

  // ============ Get grid dimensions for current format ============
  function getGridDims() {
    var format = BL.getFormat();
    if (format === '2x2') {
      return { rows: 2, cols: 2 };
    } else {
      // 1x2: depends on orientation
      // Portrait booklet: 1 row × 2 cols (landscape paper, pages side by side)
      // Landscape booklet: 2 rows × 1 col (portrait paper, pages stacked)
      return BL.S.orient === 'portrait' 
        ? { rows: 1, cols: 2 }
        : { rows: 2, cols: 1 };
    }
  }
  BL.getGridDims = getGridDims;

  // ============ Cell placement ============
  function cellPosition(row, col) {
    var dims = BL.pageDims();
    var sheet = BL.sheetDims();
    var pw = dims[0], ph = dims[1];
    var sw = sheet[0], sh = sheet[1];
    var grid = getGridDims();
    
    var ox = (sw - grid.cols * pw) / 2;
    var oy = (sh - grid.rows * ph) / 2;
    
    var left = ox + col * pw;
    var top = oy + row * ph;
    
    return { left: left, top: top, width: pw, height: ph };
  }

  // ============ Build a sheet element ============
  function buildSheet(sheetIdx, side, opts) {
    // Support old signature: buildSheet(side, opts) for backward compatibility
    if (typeof sheetIdx === 'number' && typeof side === 'object') {
      opts = side;
      side = sheetIdx;
      sheetIdx = 1;
    }
    opts = opts || {};
    var format = BL.getFormat();
    var N = BL.S.pages.length;
    var imp = BL.computeImposition(sheetIdx, N, format);
    var grid = side === 1 ? imp.side1 : imp.side2;
    var dims = BL.pageDims();
    var sheet = BL.sheetDims();
    var pw = dims[0], ph = dims[1];
    var sw = sheet[0], sh = sheet[1];
    var bleedMm = canBleed() ? bleed : 0;
    var gridDims = getGridDims();

    var sheetEl = BL.el('div', 'sheet');
    sheetEl.style.setProperty('--sw', sw);
    sheetEl.style.setProperty('--sh', sh);
    sheetEl.style.setProperty('--pw', pw);
    sheetEl.style.setProperty('--ph', ph);

    // Offset for centering the page block
    var ox = (sw - gridDims.cols * pw) / 2;
    var oy = (sh - gridDims.rows * ph) / 2;

    // Render cells
    var rows = grid.length;
    var cols = grid[0].length;
    
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var pageNum = grid[r][c];
        var pageIdx = pageNum - 1;
        var rotated = (imp.rotatedRow >= 0) && (r === imp.rotatedRow);

        // For side 2, swap column positions when flipSheetBacks is enabled
        var posCol = (side === 2 && flipSheetBacks) ? (cols - 1 - c) : c;

        var cell = BL.el('div', 'cell' + (rotated ? ' rot' : ''));
        cell.style.left = 'calc(var(--mm) * ' + (ox + posCol * pw) + ')';
        cell.style.top = 'calc(var(--mm) * ' + (oy + r * ph) + ')';
        cell.dataset.page = pageNum;
        cell.dataset.row = r;
        cell.dataset.col = posCol;

        // Render the page content
        var pageEl = BL.renderPage(pageIdx, { nums: BL.S.nums });
        cell.appendChild(pageEl);

        sheetEl.appendChild(cell);

        // Page number tag (preview only, not for print)
        if (opts.tags) {
          var tag = BL.el('div', 'tag');
          tag.textContent = rotated ? pageNum + ' ↻' : String(pageNum);
          tag.style.left = 'calc(var(--mm) * ' + (ox + posCol * pw) + ')';
          tag.style.top = 'calc(var(--mm) * ' + (oy + r * ph) + ')';
          sheetEl.appendChild(tag);
        }
      }
    }

    // Crop and fold marks (SRA3 only)
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    if (paper === 'SRA3') {
      renderMarks(sheetEl, ox, oy, pw, ph, gridDims);
    }

    // Fold and cut lines (preview only)
    // Rule: FOLD runs PARALLEL to the sheet's LONG edge; CUT is perpendicular.
    // Derived from sheet dimensions (sw, sh), not from rotatedRow.
    // Portrait (sh > sw): fold = vertical, cut = horizontal
    // Landscape (sw >= sh): fold = horizontal, cut = vertical
    if (opts.tags) {
      var isPortrait = sh > sw;
      if (format === '2x2') {
        if (isPortrait) {
          // Portrait: vertical fold, horizontal cut
          sheetEl.appendChild(BL.el('div', 'foldline v'));
          sheetEl.appendChild(BL.el('div', 'cutline h'));
        } else {
          // Landscape: horizontal fold, vertical cut
          sheetEl.appendChild(BL.el('div', 'foldline h'));
          sheetEl.appendChild(BL.el('div', 'cutline v'));
        }
      } else {
        // 1x2: single fold line, same long-edge rule
        if (isPortrait) {
          sheetEl.appendChild(BL.el('div', 'foldline v'));
        } else {
          sheetEl.appendChild(BL.el('div', 'foldline h'));
        }
      }
    }

    return sheetEl;
  }

  // ============ Render crop and fold marks ============
  function renderMarks(sheetEl, ox, oy, pw, ph, gridDims) {
    var bleedMm = canBleed() ? bleed : 0;
    var trimX = ox - bleedMm;
    var trimY = oy - bleedMm;
    var blockW = gridDims.cols * pw + 2 * bleedMm;
    var blockH = gridDims.rows * ph + 2 * bleedMm;
    var x1 = trimX + blockW;
    var y1 = trimY + blockH;

    var t = 0.25;  // mark thickness
    var g = 2;     // gap from trim edge
    var len = Math.max(3, Math.min(ox - bleedMm, oy - bleedMm) - g - 1.5);

    // Corner crop marks (4 corners × 2 lines = 8 lines)
    var corners = [
      [trimX, trimY, -1, -1],
      [x1, trimY, 1, -1],
      [trimX, y1, -1, 1],
      [x1, y1, 1, 1]
    ];

    for (var i = 0; i < corners.length; i++) {
      var cx = corners[i][0], cy = corners[i][1];
      var dx = corners[i][2], dy = corners[i][3];
      // Horizontal line
      addMark(sheetEl, 
        dx < 0 ? cx - g - len : cx + g, 
        cy - t / 2, 
        len, t, 'crop');
      // Vertical line
      addMark(sheetEl,
        cx - t / 2,
        dy < 0 ? cy - g - len : cy + g,
        t, len, 'crop');
    }

    // Fold marks - depend on format
    var format = BL.getFormat();
    if (format === '2x2') {
      // Horizontal fold at center
      var foldY = oy + ph;
      addMark(sheetEl, trimX - g - len, foldY - t / 2, len, t, 'fold');
      addMark(sheetEl, x1 + g, foldY - t / 2, len, t, 'fold');
      // Vertical fold at center
      var foldX = ox + pw;
      addMark(sheetEl, foldX - t / 2, trimY - g - len, t, len, 'fold');
      addMark(sheetEl, foldX - t / 2, y1 + g, t, len, 'fold');
    } else {
      // Single fold for 1x2
      if (gridDims.rows === 1) {
        // Vertical fold between pages
        var foldX2 = ox + pw;
        addMark(sheetEl, foldX2 - t / 2, trimY - g - len, t, len, 'fold');
        addMark(sheetEl, foldX2 - t / 2, y1 + g, t, len, 'fold');
      } else {
        // Horizontal fold between pages
        var foldY2 = oy + ph;
        addMark(sheetEl, trimX - g - len, foldY2 - t / 2, len, t, 'fold');
        addMark(sheetEl, x1 + g, foldY2 - t / 2, len, t, 'fold');
      }
    }
  }

  function addMark(parent, x, y, w, h, type) {
    var mark = BL.el('div', 'mark ' + type);
    mark.style.left = 'calc(var(--mm) * ' + x + ')';
    mark.style.top = 'calc(var(--mm) * ' + y + ')';
    mark.style.width = 'calc(var(--mm) * ' + w + ')';
    mark.style.height = 'calc(var(--mm) * ' + h + ')';
    parent.appendChild(mark);
  }

  // ============ Render sheet previews ============
  function renderSheets() {
    var container = document.getElementById('sheets');
    if (!container) {
      console.error('renderSheets: container #sheets not found');
      return;
    }
    container.innerHTML = '';
    var pps = BL.pagesPerSheet();
    var sheetCount = Math.ceil(BL.S.pages.length / pps);

    for (var k = 1; k <= sheetCount; k++) {
      // Front side
      var fig1 = document.createElement('figure');
      fig1.className = 'sheet-item';
      var cap1 = document.createElement('figcaption');
      cap1.textContent = 'Sheet ' + k + ' · Front';
      fig1.appendChild(cap1);
      fig1.appendChild(buildSheet(k, 1, { tags: true }));
      container.appendChild(fig1);

      // Back side
      var fig2 = document.createElement('figure');
      fig2.className = 'sheet-item';
      var cap2 = document.createElement('figcaption');
      cap2.textContent = 'Sheet ' + k + ' · Back';
      fig2.appendChild(cap2);
      fig2.appendChild(buildSheet(k, 2, { tags: true }));
      container.appendChild(fig2);
    }

    updateSheetNote();
  }

  // ============ Update fold instructions ============
  function updateSheetNote() {
    var noteEl = document.getElementById('sheetNote');
    if (!noteEl) return;

    var sheet = BL.sheetDims();
    var sw = sheet[0], sh = sheet[1];
    var format = BL.getFormat();
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var paperO = BL.paperOrient();
    
    // Flip edge depends on format and orientation
    var edge;
    if (format === '2x2') {
      edge = BL.S.orient === 'portrait' ? 'long edge' : 'short edge';
    } else {
      // For 1x2, flip on the edge parallel to the fold
      edge = paperO === 'landscape' ? 'long edge' : 'short edge';
    }

    var lines = [];
    lines.push('Print on <b>' + paper + ' ' + paperO + '</b> (' + sw + ' × ' + sh + ' mm), both sides, flip on the ' + edge + '.');
    lines.push('In the print dialog choose ' + paper + ' paper size, 100% scale (Actual size), margins none.');

    if (paper === 'A3' || paper === 'A4') {
      lines.push(paper + ' has no room for crop or fold marks—the pages fit exactly.');
    } else {
      lines.push('SRA3: trim to the crop marks before folding.');
    }

    lines.push('Do a test print on plain paper first with page numbers enabled.');
    lines.push('If the inside pages come out in the wrong order, enable "Flip sheet backs" and reprint.');

    noteEl.innerHTML = lines.join('<br>');
  }

  // ============ Update folding steps ============
  function updateSteps() {
    var stepsEl = document.getElementById('steps');
    if (!stepsEl) return;

    var sheet = BL.sheetDims();
    var sw = sheet[0], sh = sheet[1];
    var format = BL.getFormat();
    var N = BL.S.pages.length;
    var pps = BL.pagesPerSheet();
    var sheetCount = Math.ceil(N / pps);
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var paperO = BL.paperOrient();
    var edge = format === '2x2' 
      ? (BL.S.orient === 'portrait' ? 'long edge' : 'short edge')
      : (paperO === 'landscape' ? 'long edge' : 'short edge');

    var html = '<li><b>1 · Print</b> ' + sheetCount + ' × ' + paper + ' ' + paperO + ' (' + sw + ' × ' + sh + ' mm), both sides, flip on the ' + edge + '.</li>';

    if (format === '2x2') {
      html += '<li><b>2 · First fold</b> Side 1 facing you, with ' + N + ' | 1 along the bottom. Fold the top half back, behind the sheet.</li>';
      html += '<li><b>3 · Second fold</b> Fold the left half back behind the right half. Page 1 is now the cover and the left fold is the spine. <em>Check: page 1 front cover, page 2 first inside—if not, enable "Flip sheet backs".</em></li>';
      html += '<li><b>4 · Slit the top fold</b> Use a craft knife to slit the top edge so the pages open.</li>';
    } else {
      // 1x2 format - single fold, no slit
      var gridDims = getGridDims();
      if (gridDims.rows === 1) {
        html += '<li><b>2 · Fold</b> Side 1 facing you, with ' + N + ' | 1 at left | right. Fold the left half back behind the right half. Page 1 is now the cover.</li>';
      } else {
        html += '<li><b>2 · Fold</b> Side 1 facing you, with ' + N + ' above 1. Fold the top half back, behind the sheet. Page 1 is now the cover.</li>';
      }
      html += '<li><b>3 · Check</b> <em>Page 1 should be the front cover, page 2 the first inside—if not, enable "Flip sheet backs".</em></li>';
    }
    
    if (sheetCount > 1) {
      var nextStep = format === '2x2' ? 5 : 4;
      html += '<li><b>' + nextStep + ' · Nest sections</b> Place smaller signatures inside larger ones (sheet ' + sheetCount + ' innermost).</li>';
      html += '<li><b>' + (nextStep + 1) + ' · Stitch or staple</b> Through all layers along the spine.</li>';
    } else {
      var finalStep = format === '2x2' ? 5 : 4;
      html += '<li><b>' + finalStep + ' · Stitch or staple</b> Along the spine to bind.</li>';
    }
    
    stepsEl.innerHTML = html;
  }

  // ============ Build print area ============
  function buildPrintArea() {
    var printArea = document.getElementById('printArea');
    if (!printArea) return;

    // Set @page size dynamically - ALWAYS use explicit mm dimensions
    var sheet = BL.sheetDims();
    var sw = sheet[0], sh = sheet[1];
    var pageStyle = document.getElementById('pageStyle');
    if (pageStyle) {
      pageStyle.textContent = '@page { size: ' + sw + 'mm ' + sh + 'mm; margin: 0; }';
    }

    var pps = BL.pagesPerSheet();
    var sheetCount = Math.ceil(BL.S.pages.length / pps);
    printArea.innerHTML = '';
    for (var k = 1; k <= sheetCount; k++) {
      printArea.appendChild(buildSheet(k, 1, { tags: false }));
      printArea.appendChild(buildSheet(k, 2, { tags: false }));
    }
  }

  // ============ Print / Save PDF ============
  function doPrint() {
    if (bleed > 0 && !canBleed()) {
      BL.toast('Bleed requires SRA3 stock.');
      return;
    }

    buildPrintArea();

    var images = document.querySelectorAll('#printArea img');
    var allComplete = true;
    for (var i = 0; i < images.length; i++) {
      if (!images[i].complete) {
        allComplete = false;
        break;
      }
    }

    if (allComplete) {
      window.print();
    } else {
      BL.toast('Loading images…');
      setTimeout(function() { window.print(); }, 500);
    }
  }

  // ============ beforeprint handler ============
  window.addEventListener('beforeprint', function() {
    buildPrintArea();
  });

  // ============ Expose ============
  BL.buildSheet = buildSheet;
  BL.renderSheets = renderSheets;
  BL.updateSteps = updateSteps;
  BL.doPrint = doPrint;
  BL.buildPrintArea = buildPrintArea;

  // ============ Setup ============
  function setupSheets() {
    // Flip Sheet Backs toggle
    var flipToggle = document.getElementById('flipSheetBacks');
    if (flipToggle) {
      flipToggle.checked = flipSheetBacks;
      flipToggle.addEventListener('change', function() {
        BL.setFlipSheetBacks(flipToggle.checked);
        BL.renderSheets();
      });
    }

    // Print button
    var printBtn = document.getElementById('bPrint');
    if (printBtn) {
      printBtn.addEventListener('click', doPrint);
    }

    // Sheet tabs (if present)
    var sheetTabs = document.getElementById('sheetTabs');
    if (sheetTabs) {
      sheetTabs.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var sheetNum = parseInt(btn.dataset.sheet, 10);
        if (sheetNum >= 1) {
          // Navigate to first page of that sheet
          var pps = BL.pagesPerSheet();
          BL.cur = (sheetNum - 1) * pps;
          if (BL.cur >= BL.S.pages.length) BL.cur = BL.S.pages.length - 1;
          BL.renderSheets();
          BL.updateSteps();
          BL.save();
        }
      });
    }
  }

  function updateSheetToggle() {
    var segSheet = document.getElementById('segSheet');
    if (!segSheet) return;
    var btns = segSheet.querySelectorAll('button');
    var current = BL.S.sheet;
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.v === current);
    }
  }

  function updateBleedToggle() {
    var segBleed = document.getElementById('segBleed');
    if (!segBleed) return;
    var btns = segBleed.querySelectorAll('button');
    var canUseBleed = canBleed();
    
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      var val = parseInt(btn.dataset.v, 10);
      btn.classList.toggle('active', val === bleed);
      // Disable 3mm button when bleed not allowed
      if (val > 0) {
        btn.disabled = !canUseBleed;
        btn.setAttribute('aria-disabled', !canUseBleed);
      }
    }
    
    // Reset bleed to 0 if switching to non-SRA3
    if (!canUseBleed && bleed > 0) {
      bleed = 0;
      for (var j = 0; j < btns.length; j++) {
        btns[j].classList.toggle('active', parseInt(btns[j].dataset.v, 10) === 0);
      }
    }
  }

  BL.setupSheets = setupSheets;
  BL.updateSheetToggle = updateSheetToggle;
  BL.updateBleedToggle = updateBleedToggle;

})();
