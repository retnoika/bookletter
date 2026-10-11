/**
 * Bookletter — imposition and print engine
 * 8/16/24-page A5 booklet on 1-3 A3/SRA3 sheets, both sides, fold twice.
 * All geometry in millimetres.
 * 
 * Imposition is computed by js/imposition.js (single source of truth).
 */
(function() {
  'use strict';
  var BL = window.BL;

  // Legacy: BL.IMPOSITION for backward compatibility (sheet 1 of current booklet)
  // Computed on demand to reflect current state
  Object.defineProperty(BL, 'IMPOSITION', {
    get: function() {
      return BL.computeImposition(1, BL.S.pages.length);
    }
  });

  // ============ Bleed state ============
  var bleed = 0;  // 0 or 3 mm

  BL.getBleed = function() { return bleed; };
  BL.setBleed = function(v) { bleed = v; };

  // ============ Check if bleed is allowed ============
  function canBleed() {
    // A3 has only ~0.5mm spare per side (1mm total), no room for bleed
    return BL.S.sheet === 'SRA3';
  }
  BL.canBleed = canBleed;

  // ============ Cell placement ============
  // left = (sheetW − 2·pageW)/2 + col·pageW
  // top  = (sheetH − 2·pageH)/2 + row·pageH
  function cellPosition(row, col) {
    var dims = BL.pageDims();
    var sheet = BL.sheetDims();
    var pw = dims[0], ph = dims[1];
    var sw = sheet[0], sh = sheet[1];
    
    var left = (sw - 2 * pw) / 2 + col * pw;
    var top = (sh - 2 * ph) / 2 + row * ph;
    
    return { left: left, top: top, width: pw, height: ph };
  }

  // ============ Build a sheet element ============
  // sheetIdx = 1-based sheet number, side = 1 or 2
  function buildSheet(sheetIdx, side, opts) {
    // Support old signature: buildSheet(side, opts) for backward compatibility
    if (typeof sheetIdx === 'number' && typeof side === 'object') {
      opts = side;
      side = sheetIdx;
      sheetIdx = 1;
    }
    opts = opts || {};
    var N = BL.S.pages.length;
    var imp = BL.computeImposition(sheetIdx, N);
    var grid = side === 1 ? imp.side1 : imp.side2;
    var dims = BL.pageDims();
    var sheet = BL.sheetDims();
    var pw = dims[0], ph = dims[1];
    var sw = sheet[0], sh = sheet[1];
    var bleedMm = canBleed() ? bleed : 0;

    var sheetEl = BL.el('div', 'sheet');
    sheetEl.style.setProperty('--sw', sw);
    sheetEl.style.setProperty('--sh', sh);
    sheetEl.style.setProperty('--pw', pw);
    sheetEl.style.setProperty('--ph', ph);

    // Offset for centering the 2x2 page block
    var ox = (sw - 2 * pw) / 2;
    var oy = (sh - 2 * ph) / 2;

    // Render cells
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        var pageNum = grid[r][c];
        var pageIdx = pageNum - 1;
        var rotated = r === imp.rotatedRow;

        var cell = BL.el('div', 'cell' + (rotated ? ' rot' : ''));
        cell.style.left = 'calc(var(--mm) * ' + (ox + c * pw) + ')';
        cell.style.top = 'calc(var(--mm) * ' + (oy + r * ph) + ')';
        cell.dataset.page = pageNum;
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Render the page content
        var pageEl = BL.renderPage(pageIdx, { nums: BL.S.nums });
        cell.appendChild(pageEl);

        sheetEl.appendChild(cell);

        // Page number tag (preview only, not for print)
        if (opts.tags) {
          var tag = BL.el('div', 'tag');
          tag.textContent = rotated ? pageNum + ' ↻' : String(pageNum);
          tag.style.left = 'calc(var(--mm) * ' + (ox + c * pw) + ')';
          tag.style.top = 'calc(var(--mm) * ' + (oy + r * ph) + ')';
          sheetEl.appendChild(tag);
        }
      }
    }

    // Crop and fold marks (SRA3 only, not for A3)
    if (BL.S.sheet === 'SRA3' && !opts.tags) {
      // For print: include marks
      renderMarks(sheetEl, ox, oy, pw, ph);
    } else if (BL.S.sheet === 'SRA3' && opts.tags) {
      // For preview: also show marks
      renderMarks(sheetEl, ox, oy, pw, ph);
    }

    // Fold lines (preview only)
    if (opts.tags) {
      var foldH = BL.el('div', 'foldline h');
      var foldV = BL.el('div', 'foldline v');
      sheetEl.appendChild(foldH);
      sheetEl.appendChild(foldV);
    }

    return sheetEl;
  }

  // ============ Render crop and fold marks ============
  function renderMarks(sheetEl, ox, oy, pw, ph) {
    var bleedMm = canBleed() ? bleed : 0;
    var trimX = ox - bleedMm;
    var trimY = oy - bleedMm;
    var blockW = 2 * pw + 2 * bleedMm;
    var blockH = 2 * ph + 2 * bleedMm;
    var x1 = trimX + blockW;  // right edge of trim
    var y1 = trimY + blockH;  // bottom edge of trim

    var t = 0.25;  // mark thickness
    var g = 2;     // gap from trim edge
    var len = Math.max(3, Math.min(ox - bleedMm, oy - bleedMm) - g - 1.5);

    // Corner crop marks (4 corners × 2 lines = 8 lines)
    var corners = [
      [trimX, trimY, -1, -1],  // top-left
      [x1, trimY, 1, -1],       // top-right
      [trimX, y1, -1, 1],       // bottom-left
      [x1, y1, 1, 1]            // bottom-right
    ];

    corners.forEach(function(corner) {
      var cx = corner[0], cy = corner[1], dx = corner[2], dy = corner[3];
      // Horizontal line
      var hx = dx < 0 ? cx - g - len : cx + g;
      addMark(sheetEl, hx, cy - t / 2, len, t, 'crop');
      // Vertical line
      var vy = dy < 0 ? cy - g - len : cy + g;
      addMark(sheetEl, cx - t / 2, vy, t, len, 'crop');
    });

    // Fold marks at midpoints (4 marks)
    var mx = trimX + blockW / 2;  // horizontal fold center
    var my = trimY + blockH / 2;  // vertical fold center

    // Top fold mark
    addMark(sheetEl, mx - t / 2, trimY - g - len, t, len, 'fold');
    // Bottom fold mark
    addMark(sheetEl, mx - t / 2, y1 + g, t, len, 'fold');
    // Left fold mark
    addMark(sheetEl, trimX - g - len, my - t / 2, len, t, 'fold');
    // Right fold mark
    addMark(sheetEl, x1 + g, my - t / 2, len, t, 'fold');
  }

  function addMark(parent, x, y, w, h, type) {
    var mk = BL.el('div', 'mk ' + type);
    mk.style.left = 'calc(var(--mm) * ' + x + ')';
    mk.style.top = 'calc(var(--mm) * ' + y + ')';
    mk.style.width = 'calc(var(--mm) * ' + w + ')';
    mk.style.height = 'calc(var(--mm) * ' + h + ')';
    parent.appendChild(mk);
  }

  // ============ Render sheet previews ============
  function renderSheets() {
    var sheetsHost = document.getElementById('sheets');
    if (!sheetsHost) return;

    var sheet = BL.sheetDims();
    var sw = sheet[0];
    var sheetCount = BL.S.pages.length / 8;
    var avail = sheetsHost.clientWidth || 900;

    // Scale based on how many sheets we need to show (2 sides per sheet)
    var totalSides = sheetCount * 2;
    var mm = Math.max(0.4, Math.min(1.5, (avail - 20 * totalSides) / (sw * totalSides)));
    sheetsHost.style.setProperty('--mm', mm + 'px');

    // Clear and rebuild sheet figures
    sheetsHost.innerHTML = '';
    for (var k = 1; k <= sheetCount; k++) {
      // Side 1
      var fig1 = document.createElement('figure');
      fig1.innerHTML = '<figcaption>Sheet ' + k + ' side 1 <small>' + (k === 1 ? 'front (print first)' : '') + '</small></figcaption>';
      var div1 = document.createElement('div');
      div1.id = 'sheet-' + k + '-1';
      div1.appendChild(buildSheet(k, 1, { tags: true }));
      fig1.appendChild(div1);
      sheetsHost.appendChild(fig1);
      
      // Side 2
      var fig2 = document.createElement('figure');
      fig2.innerHTML = '<figcaption>Sheet ' + k + ' side 2 <small>' + (k === 1 ? 'back' : '') + '</small></figcaption>';
      var div2 = document.createElement('div');
      div2.id = 'sheet-' + k + '-2';
      div2.appendChild(buildSheet(k, 2, { tags: true }));
      fig2.appendChild(div2);
      sheetsHost.appendChild(fig2);
    }

    updateSheetNote();
  }

  // ============ Update fold instructions ============
  function updateSheetNote() {
    var noteEl = document.getElementById('sheetNote');
    if (!noteEl) return;

    var sheet = BL.sheetDims();
    var sw = sheet[0], sh = sheet[1];
    var edge = BL.S.orient === 'portrait' ? 'long edge' : 'short edge';
    var stockName = BL.S.sheet;

    var lines = [];
    lines.push('Print on ' + stockName + ' (' + sw + ' × ' + sh + ' mm), both sides, flip on the ' + edge + ' like a book page.');
    lines.push('Scale 100%, margins none, background graphics on.');

    if (stockName === 'A3') {
      lines.push('A3 has no room for crop or fold marks—the pages fit exactly.');
    } else {
      lines.push('SRA3: trim to the crop marks before folding.');
    }

    lines.push('Do a test print on plain paper first with page numbers enabled.');

    noteEl.innerHTML = lines.join('<br>');
  }

  // ============ Update folding steps ============
  function updateSteps() {
    var stepsEl = document.getElementById('steps');
    if (!stepsEl) return;

    var sheet = BL.sheetDims();
    var sw = sheet[0], sh = sheet[1];
    var edge = BL.S.orient === 'portrait' ? 'long edge' : 'short edge';
    var N = BL.S.pages.length;
    var sheetCount = N / 8;

    var html = 
      '<li><b>1 · Print</b>' + sheetCount + ' × ' + BL.S.sheet + ' ' + BL.S.orient + ' (' + sw + ' × ' + sh + ' mm), both sides, flip on the ' + edge + '.</li>' +
      '<li><b>2 · First fold</b>Side 1 facing you, with ' + N + ' | 1 along the bottom. Fold the top half back, behind the sheet.</li>' +
      '<li><b>3 · Second fold</b>Fold the left half back behind the right half. Page 1 is now the cover and the left fold is the spine.</li>' +
      '<li><b>4 · Slit the top fold</b>Use a craft knife to slit the top edge so the pages open.</li>';
    
    if (sheetCount > 1) {
      html += '<li><b>5 · Nest sections</b>Place smaller signatures inside larger ones (sheet ' + sheetCount + ' innermost).</li>';
      html += '<li><b>6 · Stitch or staple</b>Through all layers along the spine.</li>';
    } else {
      html += '<li><b>5 · Stitch or staple</b>Along the spine to bind.</li>';
    }
    
    stepsEl.innerHTML = html;
  }

  // ============ Build print area ============
  function buildPrintArea() {
    var printArea = document.getElementById('printArea');
    if (!printArea) return;

    // Set @page size dynamically
    var sheet = BL.sheetDims();
    var sw = sheet[0], sh = sheet[1];
    var pageStyle = document.getElementById('pageStyle');
    if (pageStyle) {
      pageStyle.textContent = '@page { size: ' + sw + 'mm ' + sh + 'mm; margin: 0; }';
    }

    var sheetCount = BL.S.pages.length / 8;
    printArea.innerHTML = '';
    for (var k = 1; k <= sheetCount; k++) {
      printArea.appendChild(buildSheet(k, 1, { tags: false }));
      printArea.appendChild(buildSheet(k, 2, { tags: false }));
    }
  }

  // ============ Print / Save PDF ============
  function doPrint() {
    // Check bleed compatibility
    if (bleed > 0 && !canBleed()) {
      BL.toast('Bleed requires SRA3 stock. A3 has no room for bleed.');
      return;
    }

    buildPrintArea();

    // Wait for images to decode
    var images = document.querySelectorAll('#printArea img');
    var decodePromises = [];
    images.forEach(function(img) {
      decodePromises.push(img.decode().catch(function() {}));
    });

    Promise.all(decodePromises).then(function() {
      window.print();
    });
  }

  // ============ beforeprint handler ============
  window.addEventListener('beforeprint', function() {
    if (bleed > 0 && !canBleed()) {
      // Can't prevent print in beforeprint, but at least don't build garbage
      return;
    }
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
    // Print button
    var bPrint = document.getElementById('bPrint');
    if (bPrint) {
      bPrint.addEventListener('click', doPrint);
    }

    // Sheet stock selector
    var segSheet = document.getElementById('segSheet');
    if (segSheet) {
      segSheet.addEventListener('click', function(e) {
        var btn = e.target.closest('button[data-v]');
        if (!btn) return;
        var val = btn.dataset.v;
        if (BL.S.sheet === val) return;

        BL.pushUndo();
        BL.S.sheet = val;
        updateSheetToggle();
        BL.renderSheets();
        BL.updateSteps();
        BL.save();
      });
    }

    // Bleed selector
    var segBleed = document.getElementById('segBleed');
    if (segBleed) {
      segBleed.addEventListener('click', function(e) {
        var btn = e.target.closest('button[data-v]');
        if (!btn) return;
        var val = parseInt(btn.dataset.v, 10);
        
        if (val > 0 && !canBleed()) {
          BL.toast('Bleed requires SRA3 stock. A3 has only 0.5mm spare per side.');
          return;
        }

        bleed = val;
        updateBleedToggle();
        BL.renderSheets();
      });
    }

    // Initial render
    updateSheetToggle();
    updateBleedToggle();
  }

  function updateSheetToggle() {
    var segSheet = document.getElementById('segSheet');
    if (!segSheet) return;
    var btns = segSheet.querySelectorAll('button[data-v]');
    btns.forEach(function(btn) {
      btn.setAttribute('aria-pressed', btn.dataset.v === BL.S.sheet);
    });
  }

  function updateBleedToggle() {
    var segBleed = document.getElementById('segBleed');
    if (!segBleed) return;
    var btns = segBleed.querySelectorAll('button[data-v]');
    btns.forEach(function(btn) {
      btn.setAttribute('aria-pressed', parseInt(btn.dataset.v, 10) === bleed);
    });
  }

  BL.setupSheets = setupSheets;
  BL.updateSheetToggle = updateSheetToggle;

})();
