/**
 * Bookletter — boot + wiring; exposes test API on window.BL
 */
(function() {
  'use strict';
  var BL = window.BL;

  // ============ View mode ============
  var viewMode = 'page';  // 'page' or 'spread'
  
  // ============ Active sheet (1-based) ============
  var activeSheet = 1;

  // ============ Toast ============
  var toastTimer = null;

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    
    el.textContent = msg;
    el.classList.add('show');
    
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      el.classList.remove('show');
    }, 3200);
  }

  BL.toast = toast;

  // ============ Page labels ============
  function getPageLabel(idx) {
    var total = BL.S.pages.length;
    if (idx === 0) return ['FRONT', 'COVER'];
    if (idx === total - 1) return ['BACK', 'COVER'];
    return ['PAGE', String(idx + 1)];
  }

  function getPageTitle(idx) {
    var total = BL.S.pages.length;
    if (idx === 0) return 'Front cover.';
    if (idx === total - 1) return 'Back cover.';
    return 'Page ' + (idx + 1) + '.';
  }

  // ============ Get active sheet from current page ============
  function getSheetForPage(pageIdx) {
    return Math.floor(pageIdx / 8) + 1;
  }

  // ============ Sheet tabs rendering ============
  function renderSheetTabs() {
    var container = document.getElementById('sheetTabs');
    if (!container) return;
    
    var sheetCount = BL.S.pages.length / 8;
    container.innerHTML = '';
    
    for (var k = 1; k <= sheetCount; k++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sheet-tab' + (k === activeSheet ? ' active' : '');
      btn.textContent = 'Sheet ' + k;
      btn.dataset.sheet = k;
      btn.addEventListener('click', (function(sheetNum) {
        return function() {
          activeSheet = sheetNum;
          // Switch to first page of this sheet
          BL.cur = (sheetNum - 1) * 8;
          BL.sel = null;
          renderAll();
        };
      })(k));
      container.appendChild(btn);
    }
  }

  // ============ Page strip rendering (filtered by active sheet) ============
  function renderStrip() {
    var strip = document.getElementById('strip');
    if (!strip) return;
    
    // Update activeSheet based on current page
    activeSheet = getSheetForPage(BL.cur);
    
    strip.innerHTML = '';
    
    // Only show pages for the active sheet
    var startPage = (activeSheet - 1) * 8;
    var endPage = Math.min(startPage + 8, BL.S.pages.length);
    
    for (var i = startPage; i < endPage; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (i === BL.cur ? ' sel' : '');
      btn.dataset.page = i;
      
      var pg = document.createElement('div');
      pg.className = 'thumb-pg';
      pg.style.setProperty('--mm', '0.5px');
      pg.appendChild(BL.renderPage(i, {}));
      
      var num = document.createElement('div');
      num.className = 'thumb-num';
      num.textContent = String(i + 1).padStart(2, '0');
      
      var lbl = document.createElement('div');
      lbl.className = 'thumb-label';
      var labels = getPageLabel(i);
      lbl.innerHTML = labels[0] + '<br>' + labels[1];
      
      btn.appendChild(pg);
      btn.appendChild(num);
      btn.appendChild(lbl);
      
      btn.addEventListener('click', (function(idx) {
        return function() {
          BL.cur = idx;
          BL.sel = null;
          viewMode = 'page';
          renderAll();
        };
      })(i));
      
      strip.appendChild(btn);
    }
    
    // Update page range label
    var rangeLabel = document.getElementById('pageRangeLabel');
    if (rangeLabel) {
      var start = String(startPage + 1).padStart(2, '0');
      var end = String(endPage).padStart(2, '0');
      rangeLabel.textContent = start + '—' + end;
    }
    
    // Update filmstrip scroll arrows
    updateFilmstripArrows();
  }

  BL.renderStrip = renderStrip;
  
  // ============ Filmstrip scroll arrows ============
  function updateFilmstripArrows() {
    var strip = document.getElementById('strip');
    var prevBtn = document.getElementById('stripPrev');
    var nextBtn = document.getElementById('stripNext');
    if (!strip || !prevBtn || !nextBtn) return;
    
    var canScrollLeft = strip.scrollLeft > 0;
    var canScrollRight = strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1;
    
    prevBtn.hidden = !canScrollLeft;
    nextBtn.hidden = !canScrollRight;
  }
  
  function setupFilmstripScroll() {
    var strip = document.getElementById('strip');
    var prevBtn = document.getElementById('stripPrev');
    var nextBtn = document.getElementById('stripNext');
    if (!strip) return;
    
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        strip.scrollBy({ left: -150, behavior: 'smooth' });
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        strip.scrollBy({ left: 150, behavior: 'smooth' });
      });
    }
    
    strip.addEventListener('scroll', updateFilmstripArrows);
  }

  // ============ Editor rendering ============
  function renderEditor() {
    var container = document.getElementById('editorPage');
    if (!container) return;
    
    var stage = document.getElementById('canvasStage');
    
    if (viewMode === 'spread') {
      renderSpreadView(stage, container);
    } else {
      renderPageView(stage, container);
    }
  }

  function renderPageView(stage, container) {
    stage.classList.remove('spread-view');
    container.innerHTML = '';
    container.appendChild(BL.renderPage(BL.cur, { edit: true }));
    BL.fitEditor();
  }

  function renderSpreadView(stage, container) {
    stage.classList.add('spread-view');
    
    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var pageCount = BL.S.pages.length;
    
    var existing = stage.querySelectorAll('.spread-page');
    existing.forEach(function(el) { el.remove(); });
    
    var spreads = getSpreadPages(BL.cur, pageCount);
    
    spreads.forEach(function(pageIdx, i) {
      var page = document.createElement('div');
      page.className = 'spread-page' + (pageIdx === BL.cur ? ' current' : '');
      page.style.setProperty('--mm', '1.8px');
      page.appendChild(BL.renderPage(pageIdx, {}));
      page.addEventListener('click', function() {
        BL.cur = pageIdx;
        BL.sel = null;
        renderAll();
      });
      
      if (i === 0) {
        stage.insertBefore(page, container);
      } else {
        stage.appendChild(page);
      }
    });
    
    container.innerHTML = '';
    container.appendChild(BL.renderPage(BL.cur, { edit: true }));
    BL.fitEditor();
  }

  function getSpreadPages(curPage, total) {
    // For spreads, show left and right pages
    if (curPage === 0) {
      // Front cover is alone on right
      return [0];
    }
    if (curPage === total - 1) {
      // Back cover is alone on left
      return [total - 1];
    }
    // Interior spreads
    if (curPage % 2 === 1) {
      // Odd page is on right, even page is on left
      return [curPage - 1, curPage];
    } else {
      // Even page is on left, odd page is on right
      return [curPage, curPage + 1];
    }
  }

  BL.renderEditor = renderEditor;

  // ============ Render layout templates ============
  function renderTools() {
    var layouts = document.getElementById('layouts');
    if (!layouts) return;
    
    layouts.innerHTML = '';
    
    for (var i = 0; i < BL.TEMPLATE_ORDER.length; i++) {
      var tplId = BL.TEMPLATE_ORDER[i];
      var tpl = BL.TEMPLATES[tplId];
      if (!tpl) continue;
      
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lay';
      btn.dataset.id = tplId;
      btn.title = tpl.name;
      
      var ico = document.createElement('div');
      ico.className = 'ico';
      var inner = document.createElement('div');
      inner.className = 'in' + (tpl.bleed ? ' b' : '');
      
      // Create slot visualizations
      if (tpl.slots) {
        tpl.slots.forEach(function(slot) {
          var el = document.createElement('i');
          var r = slot.rect;
          el.style.left = (r[0] * 100) + '%';
          el.style.top = (r[1] * 100) + '%';
          el.style.width = (r[2] * 100) + '%';
          el.style.height = (r[3] * 100) + '%';
          if (slot.kind === 'text') el.className = 'text';
          inner.appendChild(el);
        });
      }
      
      ico.appendChild(inner);
      btn.appendChild(ico);
      layouts.appendChild(btn);
    }
  }

  // ============ Render background swatches (5 presets + custom) ============
  function renderSwatches() {
    var container = document.getElementById('swatches');
    if (!container) return;
    
    // 5 preset colours: white, cream, yellow, blue, near-black
    var presets = ['#ffffff', '#f5f0e6', '#fef3c0', '#d0e4f0', '#2a2a2a'];
    
    container.innerHTML = '';
    var currentBg = BL.S.pages[BL.cur].bg || '#ffffff';
    
    presets.forEach(function(color) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.backgroundColor = color;
      btn.dataset.c = color;
      btn.setAttribute('aria-pressed', color === currentBg);
      container.appendChild(btn);
    });
    
    // Custom picker button
    var customBtn = document.createElement('button');
    customBtn.type = 'button';
    customBtn.dataset.c = 'custom';
    var isCustom = presets.indexOf(currentBg) === -1;
    customBtn.setAttribute('aria-pressed', isCustom);
    if (isCustom) {
      customBtn.style.backgroundColor = currentBg;
    }
    container.appendChild(customBtn);
  }

  BL.renderSwatches = renderSwatches;

  // ============ Render imposition diagram ============
  // Shows 2x2 grid of side 1 panel numbers for the active sheet
  function renderImpositionDiagram(container, sheetIdx) {
    if (!container) return;
    
    // Get imposition from the single source of truth (js/imposition.js)
    var imp = BL.computeImposition(sheetIdx, BL.S.pages.length);
    var side1 = imp.side1;
    var rotatedRow = imp.rotatedRow;
    
    // Build 2x2 grid: top row then bottom row, left to right
    var html = '';
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        var pageNum = side1[r][c];
        var isRotated = r === rotatedRow;
        html += '<div class="cell' + (isRotated ? ' rot' : '') + '">' + pageNum + '</div>';
      }
    }
    container.innerHTML = html;
  }
  
  BL.renderImpositionDiagram = renderImpositionDiagram;

  // ============ Render print plan ============
  function renderPrintPlan() {
    var sheetCount = BL.S.pages.length / 8;
    
    // Update print plan label
    var planLabel = document.getElementById('printPlanLabel');
    if (planLabel) {
      planLabel.textContent = String(sheetCount).padStart(2, '0') + ' / A3 PRINT PLAN';
    }
    
    // Update print plan title
    var planTitle = document.getElementById('printPlanTitle');
    if (planTitle) {
      var sheetWord = sheetCount === 1 ? 'sheet' : 'sheets';
      var pageWord = BL.S.pages.length + ' A5 pages';
      planTitle.innerHTML = sheetCount + ' ' + sheetWord + '.<br><span class="accent">' + pageWord + '.</span>';
    }
    
    // Render imposition diagram
    var diagram = document.getElementById('impositionDiagram');
    if (diagram && BL.renderImpositionDiagram) {
      BL.renderImpositionDiagram(diagram, activeSheet);
    }
  }

  BL.renderPrintPlan = renderPrintPlan;

  // ============ Update page caption ============
  function updatePageCap() {
    var cap = document.getElementById('pageCap');
    if (!cap) return;
    
    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var pageNum = BL.cur + 1;
    var total = BL.S.pages.length;
    
    // Format: 'Page x of y · A5 · 148 × 210 mm' (landscape: 210 × 148 mm)
    cap.textContent = 'Page ' + pageNum + ' of ' + total + ' · A5 · ' + pw + ' × ' + ph + ' mm';
  }

  // ============ Update view toggle ============
  function updateViewToggle() {
    var segView = document.getElementById('segView');
    if (!segView) return;
    
    var btns = segView.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var isActive = btns[i].dataset.v === viewMode;
      btns[i].classList.toggle('active', isActive);
      btns[i].setAttribute('aria-pressed', isActive);
    }
  }

  // ============ Top bar controls ============
  function updateTopBar() {
    // Title
    var titleInput = document.getElementById('titleInput');
    if (titleInput) {
      titleInput.value = BL.S.title;
    }
    
    // Orientation
    var segOrient = document.getElementById('segOrient');
    if (segOrient) {
      var btns = segOrient.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var isActive = btns[i].dataset.v === BL.S.orient;
        btns[i].classList.toggle('active', isActive);
        btns[i].setAttribute('aria-pressed', isActive);
      }
    }
    
    // Sheet
    var segSheet = document.getElementById('segSheet');
    if (segSheet) {
      var btns = segSheet.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var isActive = btns[i].dataset.v === BL.S.sheet;
        btns[i].classList.toggle('active', isActive);
        btns[i].setAttribute('aria-pressed', isActive);
      }
    }
    
    // Bleed
    var segBleed = document.getElementById('segBleed');
    if (segBleed && BL.getBleed !== undefined) {
      var btns = segBleed.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var isActive = parseInt(btns[i].dataset.v, 10) === BL.getBleed();
        btns[i].classList.toggle('active', isActive);
        btns[i].setAttribute('aria-pressed', isActive);
      }
    }
    
    // Page count segment
    var segPages = document.getElementById('segPages');
    if (segPages) {
      var btns = segPages.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var isActive = parseInt(btns[i].dataset.v, 10) === BL.S.pages.length;
        btns[i].classList.toggle('active', isActive);
        btns[i].setAttribute('aria-pressed', isActive);
      }
    }
    
    // Toggles
    var tGuide = document.getElementById('tGuide');
    if (tGuide) {
      tGuide.setAttribute('aria-pressed', BL.S.guide);
      tGuide.classList.toggle('active', BL.S.guide);
    }
    
    var tNums = document.getElementById('tNums');
    if (tNums) {
      tNums.setAttribute('aria-pressed', BL.S.nums);
      tNums.classList.toggle('active', BL.S.nums);
    }
    
    // Update page heading
    var toolHead = document.getElementById('toolHead');
    if (toolHead) {
      toolHead.textContent = getPageTitle(BL.cur);
    }
    
    // Update page caption
    updatePageCap();
  }

  BL.updateTopBar = updateTopBar;

  // ============ Render all ============
  function renderAll() {
    updateTopBar();
    renderSheetTabs();
    renderStrip();
    renderTools();
    renderSwatches();
    renderPrintPlan();
    renderEditor();
    BL.renderInspector();
    if (BL.renderLayersPanel) BL.renderLayersPanel();
    if (BL.renderSheets) BL.renderSheets();
    if (BL.updateSteps) BL.updateSteps();
    if (BL.renderSafetyPanel) BL.renderSafetyPanel();
    updateViewToggle();
  }

  BL.renderAll = renderAll;

  // ============ Dropdown menu handling ============
  var openDropdown = null;
  
  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(function(menu) {
      menu.hidden = true;
    });
    document.querySelectorAll('.dropdown-trigger, .btn-split-caret').forEach(function(btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
    openDropdown = null;
  }
  
  function openDropdownMenu(dropdown, trigger) {
    closeAllDropdowns();
    var menu = dropdown.querySelector('.dropdown-menu');
    if (menu) {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      openDropdown = dropdown;
      // Focus first item
      var firstItem = menu.querySelector('.dropdown-item');
      if (firstItem) firstItem.focus();
    }
  }
  
  function setupDropdowns() {
    // Options dropdown
    var optionsDropdown = document.getElementById('optionsDropdown');
    var bOptions = document.getElementById('bOptions');
    if (optionsDropdown && bOptions) {
      bOptions.addEventListener('click', function(e) {
        e.stopPropagation();
        if (openDropdown === optionsDropdown) {
          closeAllDropdowns();
        } else {
          openDropdownMenu(optionsDropdown, bOptions);
        }
      });
      
      optionsDropdown.addEventListener('click', function(e) {
        var item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        var action = item.dataset.action;
        closeAllDropdowns();
        
        if (action === 'open') {
          var fileJson = document.getElementById('fileJson');
          if (fileJson) {
            fileJson.value = '';
            fileJson.click();
          }
        } else if (action === 'save-json') {
          BL.saveProject();
        } else if (action === 'new') {
          BL.newBooklet();
        }
      });
    }
    
    // Save dropdown
    var saveDropdown = document.getElementById('saveDropdown');
    var bSaveCaret = document.getElementById('bSaveCaret');
    var saveMenu = document.getElementById('saveMenu');
    
    if (saveDropdown && bSaveCaret) {
      bSaveCaret.addEventListener('click', function(e) {
        e.stopPropagation();
        if (openDropdown === saveDropdown) {
          closeAllDropdowns();
        } else {
          // Populate save menu
          populateSaveMenu();
          openDropdownMenu(saveDropdown, bSaveCaret);
        }
      });
    }
    
    // Preview button (opens sheets overlay)
    var bPreview = document.getElementById('bPreview');
    if (bPreview) {
      bPreview.addEventListener('click', function() {
        var overlay = document.getElementById('sheetsOverlay');
        if (overlay) {
          overlay.hidden = false;
          if (BL.renderSheets) BL.renderSheets();
        }
      });
    }
    
    // Close sheets overlay
    var bCloseSheets = document.getElementById('bCloseSheets');
    if (bCloseSheets) {
      bCloseSheets.addEventListener('click', function() {
        var overlay = document.getElementById('sheetsOverlay');
        if (overlay) overlay.hidden = true;
      });
    }
    
    // Close dropdowns on click outside or Escape
    document.addEventListener('click', function(e) {
      if (openDropdown && !openDropdown.contains(e.target)) {
        closeAllDropdowns();
      }
    });
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (openDropdown) {
          closeAllDropdowns();
          e.preventDefault();
        } else {
          var overlay = document.getElementById('sheetsOverlay');
          if (overlay && !overlay.hidden) {
            overlay.hidden = true;
          }
        }
      }
    });
  }
  
  // ============ Populate Save dropdown menu ============
  function populateSaveMenu() {
    var menu = document.getElementById('saveMenu');
    if (!menu) return;
    
    menu.innerHTML = '';
    
    // Save as PDF
    var pdfItem = document.createElement('button');
    pdfItem.className = 'dropdown-item';
    pdfItem.textContent = 'Save as PDF';
    pdfItem.addEventListener('click', function() {
      closeAllDropdowns();
      if (BL.doPrint) BL.doPrint();
    });
    menu.appendChild(pdfItem);
    
    // PNG exports - one per sheet side
    var sheetCount = BL.S.pages.length / 8;
    for (var k = 1; k <= sheetCount; k++) {
      for (var side = 1; side <= 2; side++) {
        var pngItem = document.createElement('button');
        pngItem.className = 'dropdown-item';
        pngItem.textContent = 'Save PNG — Sheet ' + k + ' ' + (side === 1 ? 'front' : 'back');
        pngItem.dataset.sheet = k;
        pngItem.dataset.side = side;
        pngItem.addEventListener('click', function(e) {
          var sheetIdx = parseInt(e.target.dataset.sheet, 10);
          var sideNum = parseInt(e.target.dataset.side, 10);
          closeAllDropdowns();
          if (BL.exportSheet) BL.exportSheet(sheetIdx, sideNum);
        });
        menu.appendChild(pngItem);
      }
    }
    
    // Save project file
    var jsonItem = document.createElement('button');
    jsonItem.className = 'dropdown-item';
    jsonItem.textContent = 'Save project file (.json)';
    jsonItem.addEventListener('click', function() {
      closeAllDropdowns();
      BL.saveProject();
    });
    menu.appendChild(jsonItem);
  }

  // ============ Event handlers ============
  function setupTopBar() {
    // Title input
    var titleInput = document.getElementById('titleInput');
    if (titleInput) {
      titleInput.addEventListener('input', function() {
        BL.S.title = titleInput.value;
        BL.save();
      });
      titleInput.addEventListener('blur', function() {
        if (!BL.S.title.trim()) {
          BL.S.title = 'untitled booklet';
          titleInput.value = BL.S.title;
        }
      });
    }
    
    // Orientation segment
    var segOrient = document.getElementById('segOrient');
    if (segOrient) {
      segOrient.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        BL.pushUndo();
        BL.S.orient = btn.dataset.v;
        renderAll();
        BL.save();
      });
    }
    
    // Sheet segment
    var segSheet = document.getElementById('segSheet');
    if (segSheet) {
      segSheet.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        BL.pushUndo();
        BL.S.sheet = btn.dataset.v;
        renderAll();
        BL.save();
      });
    }
    
    // Bleed segment
    var segBleed = document.getElementById('segBleed');
    if (segBleed) {
      segBleed.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var val = parseInt(btn.dataset.v, 10);
        if (val > 0 && BL.canBleed && !BL.canBleed()) {
          BL.toast('Bleed requires SRA3 stock. A3 has only 0.5mm spare per side.');
          return;
        }
        if (BL.setBleed) BL.setBleed(val);
        renderAll();
        BL.save();
      });
    }
    
    // Page count segment
    var segPages = document.getElementById('segPages');
    if (segPages) {
      segPages.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var newCount = parseInt(btn.dataset.v, 10);
        if (!BL.VALID_PAGE_COUNTS || BL.VALID_PAGE_COUNTS.indexOf(newCount) === -1) return;
        var oldCount = BL.S.pages.length;
        if (newCount === oldCount) return;
        
        if (newCount < oldCount) {
          var diff = oldCount - newCount;
          if (!confirm('Changing to ' + newCount + ' pages will delete pages ' + (newCount + 1) + '-' + oldCount + '. Continue?')) {
            return;
          }
        }
        
        BL.pushUndo();
        
        if (newCount > oldCount) {
          // Add pages
          for (var i = oldCount; i < newCount; i++) {
            BL.S.pages.push(BL.newPage());
          }
        } else {
          // Remove pages
          BL.S.pages.length = newCount;
          if (BL.cur >= newCount) {
            BL.cur = newCount - 1;
          }
        }
        
        activeSheet = getSheetForPage(BL.cur);
        renderAll();
        BL.save();
      });
    }
    
    // Guide toggle
    var tGuide = document.getElementById('tGuide');
    if (tGuide) {
      tGuide.addEventListener('click', function() {
        BL.S.guide = !BL.S.guide;
        updateTopBar();
        renderEditor();
        BL.save();
      });
    }
    
    // Page numbers toggle
    var tNums = document.getElementById('tNums');
    if (tNums) {
      tNums.addEventListener('click', function() {
        BL.S.nums = !BL.S.nums;
        updateTopBar();
        renderStrip();
        renderEditor();
        if (BL.renderSheets) BL.renderSheets();
        BL.save();
      });
    }
    
    // Print button (Save as PDF)
    var bPrint = document.getElementById('bPrint');
    if (bPrint) {
      bPrint.addEventListener('click', function() {
        if (BL.doPrint) BL.doPrint();
      });
    }
    
    // Setup dropdowns
    setupDropdowns();
  }

  function setupTools() {
    // View mode toggle
    var segView = document.getElementById('segView');
    if (segView) {
      segView.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        viewMode = btn.dataset.v;
        renderEditor();
        updateViewToggle();
      });
    }
    
    // Layout templates
    var layouts = document.getElementById('layouts');
    if (layouts) {
      layouts.addEventListener('click', function(e) {
        var btn = e.target.closest('.lay');
        if (!btn) return;
        
        BL.pushUndo();
        var addedIds = BL.applyTemplate(btn.dataset.id, BL.cur);
        if (addedIds.length > 0) {
          BL.sel = addedIds[0];
        }
        renderTools();
        renderEditor();
        BL.renderInspector();
        renderStrip();
        BL.save();
      });
    }
    
    // Background swatches
    var swatches = document.getElementById('swatches');
    if (swatches) {
      swatches.addEventListener('click', function(e) {
        var btn = e.target.closest('button[data-c]');
        if (!btn) return;
        
        if (btn.dataset.c === 'custom') {
          // Open in-app color picker (works on iOS Safari)
          BL.openColorPicker({
            anchor: btn,
            color: BL.S.pages[BL.cur].bg || '#FFFFFF',
            onApply: function(hex) {
              BL.pushUndo();
              BL.S.pages[BL.cur].bg = hex;
              renderSwatches();
              renderEditor();
              renderStrip();
              BL.save();
            }
          });
          return;
        }
        
        BL.pushUndo();
        BL.S.pages[BL.cur].bg = btn.dataset.c;
        renderSwatches();
        renderEditor();
        renderStrip();
        BL.save();
      });
    }
    
    
    // Add layer buttons (left rail)
    var bAddPhoto = document.getElementById('bAddPhoto');
    if (bAddPhoto) {
      bAddPhoto.addEventListener('click', BL.addPhotoLayer);
    }
    
    var bAddText = document.getElementById('bAddText');
    if (bAddText) {
      bAddText.addEventListener('click', BL.addTextLayer);
    }
    
    // Add layer buttons (center toolbar)
    var bAddPhotoAlt = document.getElementById('bAddPhotoAlt');
    if (bAddPhotoAlt) {
      bAddPhotoAlt.addEventListener('click', BL.addPhotoLayer);
    }
    
    // Clear page button
    var bClear = document.getElementById('bClear');
    if (bClear) {
      bClear.addEventListener('click', function() {
        BL.pushUndo();
        BL.S.pages[BL.cur].layers = [];
        BL.sel = null;
        renderEditor();
        BL.renderInspector();
        renderStrip();
        BL.save();
      });
    }
    
    // Zoom controls
    var zoomOut = document.getElementById('zoomOut');
    if (zoomOut) {
      zoomOut.addEventListener('click', BL.zoomOut);
    }
    
    var zoomFit = document.getElementById('zoomFit');
    if (zoomFit) {
      zoomFit.addEventListener('click', BL.zoomFit);
    }
    
    var zoomIn = document.getElementById('zoomIn');
    if (zoomIn) {
      zoomIn.addEventListener('click', BL.zoomIn);
    }
    
    // Snap toggle
    var snapToggle = document.getElementById('snapToggle');
    if (snapToggle) {
      snapToggle.addEventListener('click', function() {
        var pressed = snapToggle.getAttribute('aria-pressed') === 'true';
        snapToggle.setAttribute('aria-pressed', !pressed);
        snapToggle.classList.toggle('active', !pressed);
        if (BL.setSnapping) BL.setSnapping(!pressed);
      });
    }
    
    // Setup filmstrip scroll
    setupFilmstripScroll();
  }

  // ============ Test API ============
  // Exposed on window.BL for automated testing
  BL.getActiveSheet = function() { return activeSheet; };
  BL.setActiveSheet = function(s) { activeSheet = s; renderAll(); };

  // ============ Boot ============
  function boot() {
    BL.loadSaved().then(function(saved) {
      if (saved) {
        // Merge with defaults
        var defaults = BL.defaultState();
        BL.S = {
          v: saved.v || defaults.v,
          title: saved.title || defaults.title,
          orient: saved.orient || defaults.orient,
          sheet: saved.sheet || defaults.sheet,
          guide: saved.guide !== undefined ? saved.guide : defaults.guide,
          safe: saved.safe !== undefined ? saved.safe : defaults.safe,
          nums: saved.nums !== undefined ? saved.nums : defaults.nums,
          pages: saved.pages
        };
      }
      
      activeSheet = getSheetForPage(BL.cur);
      
      setupTopBar();
      setupTools();
      BL.setupEditor();
      if (BL.setupGestures) BL.setupGestures();
      if (BL.setupSheets) BL.setupSheets();
      BL.setupPersist();
      if (BL.setupExport) BL.setupExport();
      renderAll();
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
