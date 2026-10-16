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

  // ============ Pending create params (for guard dialog) ============
  var pendingCreateParams = null;

  // ============ Empty state (no booklet yet) ============
  var hasBooklet = false;
  
  function showEmptyState() {
    hasBooklet = false;
    var emptyState = document.getElementById('emptyState');
    var editorContent = document.getElementById('editorContent');
    var centerToolbar = document.querySelector('.center-toolbar');
    var toolHead = document.getElementById('toolHead');
    
    if (emptyState) emptyState.hidden = false;
    if (editorContent) editorContent.hidden = true;
    if (centerToolbar) centerToolbar.hidden = true;
    if (toolHead) toolHead.textContent = 'Your Booklet';
    
    // Disable Preview and Save as PDF
    var bPreview = document.getElementById('bPreview');
    var bPrint = document.getElementById('bPrint');
    var bSaveCaret = document.getElementById('bSaveCaret');
    
    if (bPreview) {
      bPreview.disabled = true;
      bPreview.title = 'Create a booklet first';
    }
    if (bPrint) {
      bPrint.disabled = true;
      bPrint.title = 'Create a booklet first';
    }
    if (bSaveCaret) {
      bSaveCaret.disabled = true;
    }
    
    // Hide left rail sections except Project Name
    var leftRail = document.querySelector('.rail-left');
    if (leftRail) {
      var sections = leftRail.querySelectorAll('.rail-section');
      sections.forEach(function(sec, idx) {
        // Keep first section (Project Name), hide others
        if (idx > 0) sec.hidden = true;
      });
      // Hide credit too
      var credit = leftRail.querySelector('.rail-credit');
      if (credit) credit.hidden = true;
    }
    
    // Hide right rail cards
    var rightRail = document.querySelector('.rail-right');
    if (rightRail) {
      var cards = rightRail.querySelectorAll('.rail-section');
      cards.forEach(function(card) {
        card.hidden = true;
      });
    }
  }
  
  function showEditor() {
    hasBooklet = true;
    var emptyState = document.getElementById('emptyState');
    var editorContent = document.getElementById('editorContent');
    var centerToolbar = document.querySelector('.center-toolbar');
    
    if (emptyState) emptyState.hidden = true;
    if (editorContent) editorContent.hidden = false;
    if (centerToolbar) centerToolbar.hidden = false;
    
    // Enable Preview and Save as PDF
    var bPreview = document.getElementById('bPreview');
    var bPrint = document.getElementById('bPrint');
    var bSaveCaret = document.getElementById('bSaveCaret');
    
    if (bPreview) {
      bPreview.disabled = false;
      bPreview.title = '';
    }
    if (bPrint) {
      bPrint.disabled = false;
      bPrint.title = '';
    }
    if (bSaveCaret) {
      bSaveCaret.disabled = false;
    }
    
    // Show left rail sections
    var leftRail = document.querySelector('.rail-left');
    if (leftRail) {
      var sections = leftRail.querySelectorAll('.rail-section');
      sections.forEach(function(sec) {
        sec.hidden = false;
      });
      var credit = leftRail.querySelector('.rail-credit');
      if (credit) credit.hidden = false;
    }
    
    // Show right rail cards
    var rightRail = document.querySelector('.rail-right');
    if (rightRail) {
      var cards = rightRail.querySelectorAll('.rail-section');
      cards.forEach(function(card) {
        card.hidden = false;
      });
    }
  }
  
  BL.hasBooklet = function() { return hasBooklet; };
  BL.showEditor = showEditor;
  BL.showEmptyState = showEmptyState;

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
    var pps = BL.pagesPerSheet();
    return Math.floor(pageIdx / pps) + 1;
  }

  // ============ Sheet tabs rendering ============
  function renderSheetTabs() {
    var container = document.getElementById('sheetTabs');
    if (!container) return;
    
    var pps = BL.pagesPerSheet();
    var sheetCount = Math.ceil(BL.S.pages.length / pps);
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
          var pps = BL.pagesPerSheet();
          BL.cur = (sheetNum - 1) * pps;
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
    var pps = BL.pagesPerSheet();
    var startPage = (activeSheet - 1) * pps;
    var endPage = Math.min(startPage + pps, BL.S.pages.length);
    
    for (var i = startPage; i < endPage; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (i === BL.cur ? ' sel' : '');
      btn.dataset.page = i;
      
      var pg = document.createElement('div');
      pg.className = 'thumb-pg';
      var dims = BL.pageDims();
      pg.style.setProperty('--mm', '0.5px');
      pg.style.setProperty('--pw', dims[0]);
      pg.style.setProperty('--ph', dims[1]);
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
          // Do NOT reset viewMode - preserve spread/page mode
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
    
    // Re-render handles after editor content is replaced
    if (BL.renderHandles) BL.renderHandles();
  }

  function renderPageView(stage, container) {
    stage.classList.remove('spread-view');
    
    // Clean up any spread elements from spread view
    var spreadEls = stage.querySelectorAll('.spread-partner, .spread-blank');
    spreadEls.forEach(function(el) { el.remove(); });
    
    container.innerHTML = '';
    container.appendChild(BL.renderPage(BL.cur, { edit: true }));
    BL.fitEditor();
  }

  function renderSpreadView(stage, container) {
    stage.classList.add('spread-view');
    
    var pageCount = BL.S.pages.length;
    var spread = getSpreadInfo(BL.cur, pageCount);
    
    // Remove any existing spread elements
    var existing = stage.querySelectorAll('.spread-partner, .spread-blank');
    existing.forEach(function(el) { el.remove(); });
    
    // Render left side
    var leftEl = null;
    if (spread.leftPage !== null) {
      if (spread.leftPage === BL.cur) {
        // Current page is on the left - render in editorPage
        leftEl = null;  // editorPage handles it
      } else {
        // Partner page on left
        leftEl = createPartnerPage(spread.leftPage);
      }
    } else {
      // Blank placeholder on left (for front cover)
      leftEl = createBlankPlaceholder();
    }
    
    // Render right side
    var rightEl = null;
    if (spread.rightPage !== null) {
      if (spread.rightPage === BL.cur) {
        // Current page is on the right - render in editorPage
        rightEl = null;  // editorPage handles it
      } else {
        // Partner page on right
        rightEl = createPartnerPage(spread.rightPage);
      }
    } else {
      // Blank placeholder on right (for back cover)
      rightEl = createBlankPlaceholder();
    }
    
    // Insert left element before editorPage
    if (leftEl) {
      stage.insertBefore(leftEl, container);
    }
    
    // Render current page in editorPage (editable)
    container.innerHTML = '';
    container.appendChild(BL.renderPage(BL.cur, { edit: true }));
    
    // Insert right element after editorPage
    if (rightEl) {
      // editorPage is already in stage; append after it
      if (container.nextSibling) {
        stage.insertBefore(rightEl, container.nextSibling);
      } else {
        stage.appendChild(rightEl);
      }
    }
    
    // Fit both pages with same scale
    BL.fitEditorSpread();
  }
  
  function createPartnerPage(pageIdx) {
    var el = document.createElement('div');
    el.className = 'spread-partner';
    el.dataset.page = pageIdx;
    el.appendChild(BL.renderPage(pageIdx, { edit: false }));
    el.addEventListener('click', function() {
      BL.cur = pageIdx;
      BL.sel = null;
      renderAll();
    });
    return el;
  }
  
  function createBlankPlaceholder() {
    var el = document.createElement('div');
    el.className = 'spread-blank';
    return el;
  }
  
  // Returns {leftPage, rightPage} where null means blank placeholder
  // Book spread logic:
  // - Page 1 (index 0): front cover, alone on right → {left: null, right: 0}
  // - Pages 2-3 (indices 1-2): page 2 left, page 3 right → {left: 1, right: 2}
  // - Pages 4-5 (indices 3-4): page 4 left, page 5 right → {left: 3, right: 4}
  // - Last page (index N-1): back cover, alone on left → {left: N-1, right: null}
  function getSpreadInfo(curPage, total) {
    // Front cover: alone on right
    if (curPage === 0) {
      return { leftPage: null, rightPage: 0 };
    }
    // Back cover: alone on left
    if (curPage === total - 1) {
      return { leftPage: total - 1, rightPage: null };
    }
    // Interior pages: even page numbers (odd indices) are verso (left),
    // odd page numbers (even indices > 0) are recto (right)
    // Page number = index + 1
    var pageNum = curPage + 1;  // 1-based page number
    if (pageNum % 2 === 0) {
      // Even page number = verso (left page)
      // Spread is [curPage, curPage + 1]
      return { leftPage: curPage, rightPage: curPage + 1 };
    } else {
      // Odd page number = recto (right page)
      // Spread is [curPage - 1, curPage]
      return { leftPage: curPage - 1, rightPage: curPage };
    }
  }

  BL.renderEditor = renderEditor;

  // ============ Render layout templates ============
  function renderTools() {
    var layouts = document.getElementById('layouts');
    if (!layouts) return;
    
    // Set page dimensions for tile aspect ratio
    var dims = BL.pageDims();
    layouts.style.setProperty('--pw', dims[0]);
    layouts.style.setProperty('--ph', dims[1]);
    
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
    var pps = BL.pagesPerSheet();
    var sheetCount = Math.ceil(BL.S.pages.length / pps);
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var booklet = BL.S.booklet || 'A5';
    
    // Update print plan label
    var planLabel = document.getElementById('printPlanLabel');
    if (planLabel) {
      planLabel.textContent = String(sheetCount).padStart(2, '0') + ' / ' + paper + ' PRINT PLAN';
    }
    
    // Update print plan title
    var planTitle = document.getElementById('printPlanTitle');
    if (planTitle) {
      var sheetWord = sheetCount === 1 ? 'sheet' : 'sheets';
      var pageWord = BL.S.pages.length + ' ' + booklet + ' pages';
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
    
    // Format: 'Page x of y · booklet · W × H mm'
    var booklet = BL.S.booklet || 'A5';
    cap.textContent = 'Page ' + pageNum + ' of ' + total + ' · ' + booklet + ' · ' + pw + ' × ' + ph + ' mm';
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
    
    var safeInput = document.getElementById('safeInput');
    if (safeInput) {
      safeInput.value = BL.S.safe;
    }
    
    // Sync rail checkboxes with state
    var chkGuide = document.getElementById('chkGuide');
    if (chkGuide) {
      chkGuide.checked = BL.S.guide;
    }
    
    var chkNums = document.getElementById('chkNums');
    if (chkNums) {
      chkNums.checked = BL.S.nums;
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
        } else if (action === 'clear') {
          showClearConfirm();
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
    var pps = BL.pagesPerSheet();
    var sheetCount = Math.ceil(BL.S.pages.length / pps);
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

  // ============ Paper/Booklet UI Helpers ============
  
  /**
   * Update booklet size options based on selected paper.
   * A4 paper only allows A5 booklet (A4 booklet on A4 paper is invalid).
   */
  function updateBookletOptions() {
    var segBooklet = document.getElementById('segBooklet');
    if (!segBooklet) return;
    
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var btns = segBooklet.querySelectorAll('button');
    var currentValid = false;
    
    btns.forEach(function(btn) {
      var booklet = btn.dataset.v;
      // A4 paper can only have A5 booklet
      var valid = !(paper === 'A4' && booklet === 'A4');
      btn.disabled = !valid;
      btn.setAttribute('aria-disabled', !valid);
      if (booklet === BL.S.booklet && valid) currentValid = true;
    });
    
    // If current booklet is now invalid, switch to A5
    if (!currentValid) {
      BL.S.booklet = 'A5';
    }
    
    // Update active state
    btns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.v === BL.S.booklet);
    });
  }
  
  /**
   * Update paper options based on selected booklet.
   * A4 booklet cannot use A4 paper.
   */
  function updatePaperOptions() {
    var segPaper = document.getElementById('segPaper');
    if (!segPaper) return;
    
    var booklet = BL.S.booklet || 'A5';
    var btns = segPaper.querySelectorAll('button');
    var currentValid = false;
    
    btns.forEach(function(btn) {
      var paper = btn.dataset.v;
      // A4 booklet cannot use A4 paper
      var valid = !(booklet === 'A4' && paper === 'A4');
      btn.disabled = !valid;
      btn.setAttribute('aria-disabled', !valid);
      if (paper === (BL.S.paper || BL.S.sheet) && valid) currentValid = true;
    });
    
    // If current paper is now invalid, switch to A3
    if (!currentValid) {
      BL.S.paper = 'A3';
      BL.S.sheet = 'A3';
    }
    
    // Update active state
    btns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.v === (BL.S.paper || BL.S.sheet));
    });
  }
  
  /**
   * Update page count buttons based on current format.
   * 2x2 format: 8/16/24 pages; 1x2 format: 4/8/12 pages.
   */
  function updatePageCountButtons() {
    var segPages = document.getElementById('segPages');
    if (!segPages) return;
    
    var validCounts = BL.validPageCounts();
    var pps = BL.pagesPerSheet();
    
    // Remove existing buttons and create new ones
    segPages.innerHTML = '';
    
    for (var i = 0; i < validCounts.length; i++) {
      var count = validCounts[i];
      var sheets = count / pps;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.v = count;
      btn.textContent = sheets; // Just the sheet number
      btn.classList.toggle('active', BL.S.pages.length === count);
      segPages.appendChild(btn);
    }
    
    // Update helper text
    updateSheetHelper();
  }
  
  /**
   * Update the helper text below sheet count buttons.
   */
  function updateSheetHelper() {
    var helper = document.getElementById('sheetHelper');
    if (!helper) return;
    
    var pps = BL.pagesPerSheet();
    var sheets = Math.ceil(BL.S.pages.length / pps);
    var pages = sheets * pps;
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    
    helper.textContent = sheets + ' sheet' + (sheets > 1 ? 's' : '') + 
      ' of ' + paper + ' gives you ' + pages + ' pages booklet';
  }
  
  /**
   * Update the feed note below booklet section.
   */
  function updateFeedNote() {
    var noteEl = document.getElementById('feedNote');
    if (!noteEl) return;
    
    var format = BL.getFormat();
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var paperO = BL.paperOrient();
    
    if (format === '1x2') {
      noteEl.textContent = 'Feed ' + paper + ' ' + paperO + '.';
      noteEl.style.display = '';
    } else {
      noteEl.style.display = 'none';
    }
  }
  
  /**
   * Update all segment UI states (now just page count and format display).
   */
  function updateSegmentStates() {
    // Page count
    updatePageCountButtons();
    
    // Format display (read-only line in rail)
    updateFormatDisplay();
  }
  
  BL.updateSegmentStates = updateSegmentStates;
  
  /**
   * Update the read-only format display in the rail.
   */
  function updateFormatDisplay() {
    var formatText = document.getElementById('formatText');
    if (!formatText) return;
    
    var paper = BL.S.paper || BL.S.sheet || 'A3';
    var booklet = BL.S.booklet || 'A5';
    var orient = BL.S.orient || 'portrait';
    var paperOrient = BL.paperOrient ? BL.paperOrient() : 'portrait';
    
    formatText.textContent = paper + ' paper → ' + booklet + ' ' + orient + ' · feed ' + paper + ' ' + paperOrient;
  }
  
  BL.updateFormatDisplay = updateFormatDisplay;
  
  // ============ Setup Panel ============
  var setupState = {
    paper: 'A3',
    booklet: 'A5',
    orient: 'portrait'
  };
  
  // Track if showing panel for first visit (no existing booklet)
  var setupIsFirstVisit = false;
  
  function showSetupPanel(isFirstVisit) {
    var overlay = document.getElementById('setupOverlay');
    if (overlay) {
      // Reset to defaults
      setupState.paper = 'A3';
      setupState.booklet = 'A5';
      setupState.orient = 'portrait';
      setupIsFirstVisit = !!isFirstVisit;
      updateSetupUI();
      updateSetupSummary();
      updateSetupSchematic();
      overlay.hidden = false;
    }
  }
  
  function hideSetupPanel() {
    var overlay = document.getElementById('setupOverlay');
    if (overlay) {
      overlay.hidden = true;
    }
  }
  
  function cancelSetup() {
    hideSetupPanel();
    if (setupIsFirstVisit) {
      // No existing booklet - return to empty state
      showEmptyState();
    }
    // Otherwise just close - existing booklet stays unchanged
  }
  
  BL.showSetupPanel = showSetupPanel;
  BL.hideSetupPanel = hideSetupPanel;
  BL.cancelSetup = cancelSetup;
  
  // ============ Clear Confirmation ============
  function showClearConfirm() {
    var overlay = document.getElementById('clearOverlay');
    if (overlay) overlay.hidden = false;
  }
  
  function hideClearConfirm() {
    var overlay = document.getElementById('clearOverlay');
    if (overlay) overlay.hidden = true;
  }
  
  function confirmClear() {
    // Clear project state
    var defaults = BL.defaultState();
    BL.S = {
      v: defaults.v,
      title: defaults.title,
      orient: defaults.orient,
      paper: defaults.paper,
      booklet: defaults.booklet,
      sheet: defaults.sheet,
      guide: defaults.guide,
      safe: defaults.safe,
      nums: defaults.nums,
      bleed: defaults.bleed,
      pages: []
    };
    BL.cur = 0;
    BL.sel = null;
    BL.clearHistory();
    
    // Clear autosave from localStorage and IndexedDB
    try { localStorage.removeItem('bookletter'); } catch(e) {}
    if (window.indexedDB) {
      try {
        var req = indexedDB.deleteDatabase('bookletter');
        req.onsuccess = function() {};
        req.onerror = function() {};
      } catch(e) {}
    }
    
    // Hide confirmation and show empty state
    hideClearConfirm();
    showEmptyState();
  }
  
  function setupClearConfirm() {
    var btnCancel = document.getElementById('clearCancel');
    var btnConfirm = document.getElementById('clearConfirm');
    var btnSaveFirst = document.getElementById('clearSaveFirst');
    
    if (btnCancel) {
      btnCancel.addEventListener('click', hideClearConfirm);
    }
    if (btnConfirm) {
      btnConfirm.addEventListener('click', confirmClear);
    }
    if (btnSaveFirst) {
      btnSaveFirst.addEventListener('click', function() {
        BL.saveProjectAsync().then(function() {
          confirmClear();
        }).catch(function() {
          // User cancelled save - do nothing, leave dialog open
        });
      });
    }
    
    // Escape key closes confirm
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('clearOverlay');
        if (overlay && !overlay.hidden) {
          e.preventDefault();
          hideClearConfirm();
        }
      }
    });
  }
  
  // ============ Content check (for guard dialogs) ============
  function hasContent() {
    // Check if title is not the default
    if (BL.S.title && BL.S.title !== 'untitled booklet') {
      return true;
    }
    // Check if any page has layers
    if (BL.S.pages && BL.S.pages.length > 0) {
      for (var i = 0; i < BL.S.pages.length; i++) {
        if (BL.S.pages[i].layers && BL.S.pages[i].layers.length > 0) {
          return true;
        }
      }
    }
    return false;
  }
  
  // ============ Replace Guard Dialog ============
  function showReplaceGuard() {
    var overlay = document.getElementById('replaceOverlay');
    if (overlay) overlay.hidden = false;
  }
  
  function hideReplaceGuard() {
    var overlay = document.getElementById('replaceOverlay');
    if (overlay) overlay.hidden = true;
    pendingCreateParams = null;
  }
  
  function doReplace() {
    if (!pendingCreateParams) return;
    var params = pendingCreateParams;
    pendingCreateParams = null;
    hideReplaceGuard();
    hideSetupPanel();
    createNewBooklet(params.paper, params.booklet, params.orient);
    showEditor();
  }
  
  function setupReplaceGuard() {
    var btnCancel = document.getElementById('replaceCancel');
    var btnConfirm = document.getElementById('replaceConfirm');
    var btnSaveFirst = document.getElementById('replaceSaveFirst');
    
    if (btnCancel) {
      btnCancel.addEventListener('click', hideReplaceGuard);
    }
    if (btnConfirm) {
      btnConfirm.addEventListener('click', doReplace);
    }
    if (btnSaveFirst) {
      btnSaveFirst.addEventListener('click', function() {
        BL.saveProjectAsync().then(function() {
          doReplace();
        }).catch(function() {
          // User cancelled save - do nothing, leave dialog open
        });
      });
    }
    
    // Escape key closes guard
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('replaceOverlay');
        if (overlay && !overlay.hidden) {
          e.preventDefault();
          hideReplaceGuard();
        }
      }
    });
  }
  
  function updateSetupUI() {
    // Update paper buttons
    var segPaper = document.getElementById('setupPaper');
    if (segPaper) {
      segPaper.querySelectorAll('button').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.v === setupState.paper);
      });
    }
    
    // Update booklet buttons (filter by paper)
    var segBooklet = document.getElementById('setupBooklet');
    if (segBooklet) {
      segBooklet.querySelectorAll('button').forEach(function(btn) {
        var bk = btn.dataset.v;
        // A3 offers A4 and A5; A4 offers A5 only
        var valid = setupState.paper === 'A3' || (setupState.paper === 'A4' && bk === 'A5');
        btn.disabled = !valid;
        btn.classList.toggle('active', btn.dataset.v === setupState.booklet && valid);
        
        // If current booklet is invalid for this paper, switch to largest valid
        if (btn.dataset.v === setupState.booklet && !valid) {
          setupState.booklet = 'A5'; // Always valid
        }
      });
      
      // Re-check active state after potential switch
      segBooklet.querySelectorAll('button').forEach(function(btn) {
        var bk = btn.dataset.v;
        var valid = setupState.paper === 'A3' || (setupState.paper === 'A4' && bk === 'A5');
        btn.classList.toggle('active', btn.dataset.v === setupState.booklet && valid);
      });
    }
    
    // Update orientation buttons
    var segOrient = document.getElementById('setupOrient');
    if (segOrient) {
      segOrient.querySelectorAll('button').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.v === setupState.orient);
      });
    }
  }
  
  function updateSetupSummary() {
    var summary = document.getElementById('setupSummary');
    if (!summary) return;
    
    var paper = setupState.paper;
    var booklet = setupState.booklet;
    var orient = setupState.orient;
    
    // Determine format
    var format = (booklet === 'A5' && paper === 'A3') ? '2x2' : '1x2';
    var pps = format === '2x2' ? 8 : 4;
    
    // Determine paper orientation (opposite for 1x2)
    var paperOrient = format === '1x2' 
      ? (orient === 'portrait' ? 'landscape' : 'portrait')
      : orient;
    
    // Build summary text
    var foldText = format === '2x2' 
      ? 'fold twice, slit once' 
      : 'one fold, no slit';
    
    summary.textContent = pps + ' ' + booklet + ' pages per sheet · ' + foldText + ' · feed ' + paper + ' ' + paperOrient;
  }

  function updateSetupSchematic() {
    var container = document.getElementById('setupSchematic');
    if (!container) return;
    
    var paper = setupState.paper;
    var booklet = setupState.booklet;
    var orient = setupState.orient;
    
    // Get geometry and imposition from the single source of truth
    var geo = BL.resolveGeometry(paper, booklet, orient);
    var format = geo.format;
    var pps = geo.pagesPerSheet;
    var imp = BL.computeImposition(1, pps, format);
    
    // Sheet dimensions for aspect ratio
    var sheetW = geo.sheetDims[0];
    var sheetH = geo.sheetDims[1];
    
    // Grid layout
    var gridCols = geo.grid.cols;
    var gridRows = geo.grid.rows;
    var rotatedRow = imp.rotatedRow;
    
    // SVG dimensions - scale to fit, max 100px on longest side
    var maxDim = 100;
    var scale = Math.min(maxDim / sheetW, maxDim / sheetH);
    var svgW = Math.round(sheetW * scale);
    var svgH = Math.round(sheetH * scale);
    
    // Colors from CSS tokens (read computed values)
    var guideColor = getComputedStyle(document.documentElement).getPropertyValue('--guide').trim() || '#717AE4';
    var lineColor = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#D9DBDE';
    var inkMuted = getComputedStyle(document.documentElement).getPropertyValue('--ink-muted').trim() || '#565A62';
    
    // Cell dimensions
    var cellW = svgW / gridCols;
    var cellH = svgH / gridRows;
    
    // Helper to render one side
    function renderSide(sideData, label) {
      var svg = '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg">';
      
      // Sheet outline
      svg += '<rect x="0.5" y="0.5" width="' + (svgW - 1) + '" height="' + (svgH - 1) + '" fill="white" stroke="' + lineColor + '" stroke-width="1"/>';
      
      // Fold lines
      if (gridCols === 2) {
        // Vertical fold at center
        svg += '<line x1="' + (svgW / 2) + '" y1="0" x2="' + (svgW / 2) + '" y2="' + svgH + '" stroke="' + guideColor + '" stroke-width="1" stroke-dasharray="3,2"/>';
      }
      if (gridRows === 2) {
        // Horizontal fold at center
        svg += '<line x1="0" y1="' + (svgH / 2) + '" x2="' + svgW + '" y2="' + (svgH / 2) + '" stroke="' + guideColor + '" stroke-width="1" stroke-dasharray="3,2"/>';
      }
      
      // Page numbers in cells
      var fontSize = Math.min(cellW, cellH) * 0.35;
      var rotGlyphSize = fontSize * 0.5;
      
      for (var r = 0; r < gridRows; r++) {
        for (var c = 0; c < gridCols; c++) {
          // Get page number - handle both array shapes
          var pageNum;
          if (sideData[r] && sideData[r][c] !== undefined) {
            pageNum = sideData[r][c];
          } else if (gridRows === 2 && gridCols === 1 && sideData[0]) {
            // Landscape 1x2: transpose [[4,1]] to [[4],[1]]
            pageNum = sideData[0][r];
          } else {
            pageNum = '?';
          }
          
          var cx = c * cellW + cellW / 2;
          var cy = r * cellH + cellH / 2;
          var isRotated = r === rotatedRow;
          
          // Page number (rotated 180° if in rotated row)
          if (isRotated) {
            svg += '<g transform="rotate(180 ' + cx + ' ' + cy + ')">';
          }
          svg += '<text x="' + cx + '" y="' + (cy + fontSize * 0.35) + '" font-family="system-ui, sans-serif" font-size="' + fontSize + '" fill="' + inkMuted + '" text-anchor="middle">' + pageNum + '</text>';
          if (isRotated) {
            svg += '</g>';
          }
          
          // Rotation glyph for rotated rows (small ↻ symbol)
          if (isRotated) {
            var glyphX = cx + cellW * 0.3;
            var glyphY = cy - cellH * 0.25;
            svg += '<text x="' + glyphX + '" y="' + glyphY + '" font-family="system-ui, sans-serif" font-size="' + rotGlyphSize + '" fill="' + guideColor + '" text-anchor="middle">↻</text>';
          }
        }
      }
      
      svg += '</svg>';
      return '<div class="setup-schematic-side"><span class="setup-schematic-label">' + label + '</span>' + svg + '</div>';
    }
    
    container.innerHTML = renderSide(imp.side1, 'Side 1') + renderSide(imp.side2, 'Side 2');
  }
  
  function setupSetupPanel() {
    var overlay = document.getElementById('setupOverlay');
    if (!overlay) return;
    
    // Paper segment
    var segPaper = document.getElementById('setupPaper');
    if (segPaper) {
      segPaper.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        setupState.paper = btn.dataset.v;
        // Default to largest valid booklet for this paper
        if (setupState.paper === 'A3') {
          setupState.booklet = 'A4'; // A4 is larger than A5
        } else {
          setupState.booklet = 'A5'; // Only A5 valid for A4 paper
        }
        updateSetupUI();
        updateSetupSummary();
        updateSetupSchematic();
      });
    }
    
    // Booklet segment
    var segBooklet = document.getElementById('setupBooklet');
    if (segBooklet) {
      segBooklet.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        setupState.booklet = btn.dataset.v;
        updateSetupUI();
        updateSetupSummary();
        updateSetupSchematic();
      });
    }
    
    // Orientation segment
    var segOrient = document.getElementById('setupOrient');
    if (segOrient) {
      segOrient.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        setupState.orient = btn.dataset.v;
        updateSetupUI();
        updateSetupSummary();
        updateSetupSchematic();
      });
    }
    
    // Cancel button
    var btnCancel = document.getElementById('setupCancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', cancelSetup);
    }
    
    // Create button - with content guard
    var btnCreate = document.getElementById('setupCreate');
    if (btnCreate) {
      btnCreate.addEventListener('click', function() {
        // If current booklet has content, show guard dialog
        if (hasBooklet && hasContent()) {
          pendingCreateParams = {
            paper: setupState.paper,
            booklet: setupState.booklet,
            orient: setupState.orient
          };
          showReplaceGuard();
        } else {
          // No content - replace silently
          createNewBooklet(setupState.paper, setupState.booklet, setupState.orient);
          hideSetupPanel();
          showEditor();
        }
      });
    }
    
    // Escape key closes panel
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('setupOverlay');
        if (overlay && !overlay.hidden) {
          e.preventDefault();
          cancelSetup();
        }
      }
    });
  }
  
  function createNewBooklet(paper, booklet, orient) {
    // Determine page count based on format
    var format = (booklet === 'A5' && paper === 'A3') ? '2x2' : '1x2';
    var pps = format === '2x2' ? 8 : 4;
    
    // Create new state
    var defaults = BL.defaultState();
    BL.S = {
      v: defaults.v,
      title: 'untitled booklet',
      orient: orient,
      paper: paper,
      booklet: booklet,
      sheet: paper,
      guide: defaults.guide,
      safe: defaults.safe,
      nums: defaults.nums,
      pages: []
    };
    
    // Add pages
    for (var i = 0; i < pps; i++) {
      BL.S.pages.push(BL.newPage());
    }
    
    BL.cur = 0;
    BL.sel = null;
    BL.clearHistory();
    activeSheet = 1;
    
    if (BL.updateSegmentStates) BL.updateSegmentStates();
    renderAll();
    BL.save();
    BL.toast('New booklet created.');
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
    
    // Setup panel handlers
    setupSetupPanel();
    setupClearConfirm();
    setupReplaceGuard();
    
    // Page count segment
    var segPages = document.getElementById('segPages');
    if (segPages) {
      segPages.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        var newCount = parseInt(btn.dataset.v, 10);
        var validCounts = BL.validPageCounts();
        if (validCounts.indexOf(newCount) === -1) return;
        var oldCount = BL.S.pages.length;
        if (newCount === oldCount) return;
        
        // Check for content on pages that would be removed
        if (newCount < oldCount) {
          var hasContent = false;
          var contentPages = [];
          for (var i = newCount; i < oldCount; i++) {
            if (BL.S.pages[i] && BL.S.pages[i].layers && BL.S.pages[i].layers.length > 0) {
              hasContent = true;
              contentPages.push(i + 1);
            }
          }
          if (hasContent) {
            var newSheets = newCount / BL.pagesPerSheet();
            var msg;
            if (contentPages.length <= 5) {
              // List pages explicitly
              var pageList;
              if (contentPages.length === 1) {
                pageList = 'page ' + contentPages[0];
              } else if (contentPages.length === 2) {
                pageList = 'pages ' + contentPages[0] + ' and ' + contentPages[1];
              } else {
                pageList = 'pages ' + contentPages.slice(0, -1).join(', ') + ' and ' + contentPages[contentPages.length - 1];
              }
              msg = 'Cannot reduce to ' + newSheets + ' sheet' + (newSheets > 1 ? 's' : '') + ': ' + pageList + ' ha' + (contentPages.length > 1 ? 've' : 's') + ' content. Clear them first.';
            } else {
              // Count and range
              var minPage = Math.min.apply(null, contentPages);
              var maxPage = Math.max.apply(null, contentPages);
              msg = 'Cannot reduce to ' + newSheets + ' sheet' + (newSheets > 1 ? 's' : '') + ': ' + contentPages.length + ' pages have content (pages ' + minPage + '-' + maxPage + '). Clear them first.';
            }
            BL.toast(msg);
            return;
          }
        }
        
        BL.pushUndo();
        
        if (newCount > oldCount) {
          for (var i = oldCount; i < newCount; i++) {
            BL.S.pages.push(BL.newPage());
          }
        } else {
          BL.S.pages.length = newCount;
          if (BL.cur >= newCount) {
            BL.cur = newCount - 1;
          }
        }
        
        activeSheet = getSheetForPage(BL.cur);
        if (BL.updateSegmentStates) BL.updateSegmentStates();
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
    
    // Safe margin input
    var safeInput = document.getElementById('safeInput');
    if (safeInput) {
      safeInput.value = BL.S.safe;
      safeInput.addEventListener('change', function() {
        var val = parseFloat(safeInput.value);
        if (isNaN(val)) {
          // Invalid input: restore previous value
          safeInput.value = BL.S.safe;
          return;
        }
        // Clamp to 0-20
        val = Math.max(0, Math.min(20, val));
        val = Math.round(val * 10) / 10; // one decimal
        BL.S.safe = val;
        safeInput.value = val;
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
    
    // Rail checkbox: Margin guide
    var chkGuide = document.getElementById('chkGuide');
    if (chkGuide) {
      chkGuide.checked = BL.S.guide;
      chkGuide.addEventListener('change', function() {
        BL.S.guide = chkGuide.checked;
        updateTopBar();
        renderEditor();
        BL.save();
      });
    }
    
    // Rail checkbox: Page numbers
    var chkNums = document.getElementById('chkNums');
    if (chkNums) {
      chkNums.checked = BL.S.nums;
      chkNums.addEventListener('change', function() {
        BL.S.nums = chkNums.checked;
        updateTopBar();
        renderStrip();
        renderEditor();
        if (BL.renderSheets) BL.renderSheets();
        BL.save();
      });
    }

    // Flip sheet backs toggle (device workaround)
    var tFlipBacks = document.getElementById('tFlipBacks');
    if (tFlipBacks) {
      // Initialize from localStorage
      var isOn = BL.getFlipSheetBacks();
      tFlipBacks.setAttribute('aria-pressed', isOn);
      tFlipBacks.classList.toggle('active', isOn);
      
      tFlipBacks.addEventListener('click', function() {
        var newVal = !BL.getFlipSheetBacks();
        BL.setFlipSheetBacks(newVal);
        tFlipBacks.setAttribute('aria-pressed', newVal);
        tFlipBacks.classList.toggle('active', newVal);
        if (BL.renderSheets) BL.renderSheets();
        if (BL.buildPrintArea) BL.buildPrintArea();
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
    
    // Create New button in empty state
    var btnCreateNew = document.getElementById('btnCreateNew');
    if (btnCreateNew) {
      btnCreateNew.addEventListener('click', function() {
        showSetupPanel(true);
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
        if (BL.renderLayersPanel) BL.renderLayersPanel();
        if (BL.renderHandles) BL.renderHandles();
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
        if (BL.renderLayersPanel) BL.renderLayersPanel();
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
      var isFirstVisit = !saved;
      
      if (saved) {
        // Merge with defaults (supports legacy projects with SRA3/bleed)
        var defaults = BL.defaultState();
        BL.S = {
          v: saved.v || defaults.v,
          title: saved.title || defaults.title,
          orient: saved.orient || defaults.orient,
          paper: saved.paper || saved.sheet || defaults.paper,
          booklet: saved.booklet || defaults.booklet,
          sheet: saved.sheet || saved.paper || defaults.sheet,
          guide: saved.guide !== undefined ? saved.guide : defaults.guide,
          safe: saved.safe !== undefined ? saved.safe : defaults.safe,
          nums: saved.nums !== undefined ? saved.nums : defaults.nums,
          bleed: saved.bleed !== undefined ? saved.bleed : 0,
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
      if (BL.updateSegmentStates) BL.updateSegmentStates();
      renderAll();
      
      // Show empty state for first-time visitors, editor for returning users
      if (isFirstVisit) {
        showEmptyState();
      } else {
        showEditor();
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
