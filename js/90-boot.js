/**
 * Bookletter — boot + wiring; exposes test API on window.BL
 */
(function() {
  'use strict';
  var BL = window.BL;

  // ============ View mode ============
  var viewMode = 'page';  // 'page' or 'spread'

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

  // ============ Page strip rendering ============
  function renderStrip() {
    var strip = document.getElementById('strip');
    if (!strip) return;
    
    strip.innerHTML = '';
    
    for (var i = 0; i < BL.S.pages.length; i++) {
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
  }

  BL.renderStrip = renderStrip;

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
    
    // Remove spread pages if any
    var spreads = stage.querySelectorAll('.spread-page');
    for (var i = 0; i < spreads.length; i++) {
      spreads[i].remove();
    }
    
    // Remove existing handles
    var oldHandles = container.querySelector('.layer-handles');
    if (oldHandles) oldHandles.remove();
    
    container.innerHTML = '';
    container.style.display = 'block';
    container.appendChild(BL.renderPage(BL.cur, { edit: true, sel: BL.sel, nums: BL.S.nums }));
    BL.fitEditor();
    
    // Render handles for selected layer
    if (BL.renderHandles) BL.renderHandles();
  }

  function renderSpreadView(stage, container) {
    stage.classList.add('spread-view');
    container.style.display = 'none';
    
    // Remove existing spread pages
    var existing = stage.querySelectorAll('.spread-page');
    for (var i = 0; i < existing.length; i++) {
      existing[i].remove();
    }
    
    // Compute spread pages dynamically: page 1 alone, pairs 2-3, 4-5, ..., page N alone
    var N = BL.S.pages.length;
    var spreads = [[0]];
    for (var si = 1; si < N - 1; si += 2) {
      spreads.push([si, si + 1]);
    }
    spreads.push([N - 1]);
    var currentSpread = null;
    for (var s = 0; s < spreads.length; s++) {
      if (spreads[s].indexOf(BL.cur) !== -1) {
        currentSpread = spreads[s];
        break;
      }
    }
    
    if (!currentSpread) currentSpread = [BL.cur];
    
    var dims = BL.pageDims();
    var scale = Math.min(
      (stage.clientWidth - 40) / (dims[0] * currentSpread.length + 4),
      (stage.clientHeight - 40) / dims[1]
    ) || 1;
    
    for (var p = 0; p < currentSpread.length; p++) {
      var pageIdx = currentSpread[p];
      var div = document.createElement('div');
      div.className = 'spread-page' + (pageIdx === BL.cur ? ' current' : '');
      div.style.width = (dims[0] * scale) + 'px';
      div.style.height = (dims[1] * scale) + 'px';
      div.style.setProperty('--mm', scale + 'px');
      div.appendChild(BL.renderPage(pageIdx, { nums: BL.S.nums }));
      
      div.addEventListener('click', (function(idx) {
        return function() {
          BL.cur = idx;
          BL.sel = null;
          viewMode = 'page';
          renderAll();
        };
      })(pageIdx));
      
      stage.appendChild(div);
    }
  }

  BL.renderEditor = renderEditor;

  // ============ Tools panel rendering ============
  function renderTools() {
    // Editing label
    var editingLabel = document.getElementById('editingLabel');
    if (editingLabel) {
      editingLabel.textContent = 'EDITING / ' + String(BL.cur + 1).padStart(2, '0') + ' OF ' + String(BL.S.pages.length).padStart(2, '0');
    }
    
    // Page title
    var toolHead = document.getElementById('toolHead');
    if (toolHead) {
      toolHead.textContent = getPageTitle(BL.cur);
    }
    
    // Page caption
    var pageCap = document.getElementById('pageCap');
    if (pageCap) {
      var labels = getPageLabel(BL.cur);
      pageCap.textContent = String(BL.cur + 1).padStart(2, '0') + ' ' + labels.join(' ').toLowerCase().replace(/\b\w/g, function(l) { return l.toUpperCase(); });
    }
    
    // Sheet page name
    var sheetPageName = document.getElementById('sheetPageName');
    if (sheetPageName) {
      sheetPageName.textContent = getPageTitle(BL.cur).replace('.', '');
    }
    
    // Pager
    var pager = document.getElementById('pager');
    if (pager) {
      pager.textContent = '‹ ' + String(BL.cur + 1).padStart(2, '0') + ' / ' + String(BL.S.pages.length).padStart(2, '0') + ' ›';
    }
    
    // Page range label
    var pageRangeLabel = document.getElementById('pageRangeLabel');
    if (pageRangeLabel) {
      pageRangeLabel.textContent = '01—' + String(BL.S.pages.length).padStart(2, '0');
    }
    
    // Layout templates
    var layouts = document.getElementById('layouts');
    if (layouts) {
      layouts.innerHTML = '';
      for (var i = 0; i < BL.TEMPLATE_ORDER.length; i++) {
        var id = BL.TEMPLATE_ORDER[i];
        var tpl = BL.TEMPLATES[id];
        var btn = document.createElement('button');
        btn.className = 'lay';
        btn.dataset.id = id;
        btn.title = tpl.name;
        btn.setAttribute('aria-label', tpl.name);
        btn.innerHTML = BL.templateIcon(id);
        layouts.appendChild(btn);
      }
    }
    
    // Background swatches
    renderSwatches();
    
    // View mode toggle
    updateViewToggle();
    
    // Inspector labels
    updateInspectorLabels();
    
    // Print plan
    renderPrintPlan();
  }

  // New color palette
  var BGS = ['#FFFFFF', '#F3EADC', '#F8D97A', '#C7E67D', '#F6AA83', '#A8D9F9', '#1F3A2C', '#17261F'];

  function renderSwatches() {
    var swatches = document.getElementById('swatches');
    if (!swatches) return;
    
    var page = BL.S.pages[BL.cur];
    var html = '';
    
    for (var i = 0; i < BGS.length; i++) {
      var c = BGS[i];
      html += '<button data-c="' + c + '" style="background:' + c + '" aria-label="Background ' + c + '" aria-pressed="' + (page.bg === c) + '"></button>';
    }
    
    // Custom color input
    html += '<button data-c="custom" style="background:linear-gradient(135deg, #fff 50%, ' + page.bg + ' 50%)" aria-label="Custom color"></button>';
    html += '<input type="color" id="customBg" value="' + page.bg + '" style="display:none">';
    
    swatches.innerHTML = html;
  }

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

  function updateInspectorLabels() {
    var inspectorLabel = document.getElementById('inspectorLabel');
    var inspectorTitle = document.getElementById('inspectorTitle');
    
    if (BL.sel && BL.S.pages[BL.cur]) {
      var layer = BL.findLayer(BL.sel);
      if (layer && inspectorLabel && inspectorTitle) {
        inspectorLabel.textContent = 'SELECTED LAYER';
        if (layer.kind === 'photo') {
          inspectorTitle.textContent = layer.src ? 'Photo' : 'Add a photo';
        } else if (layer.kind === 'text') {
          inspectorTitle.textContent = 'Text';
        } else if (layer.kind === 'shape') {
          inspectorTitle.textContent = 'Shape';
        }
      }
    } else {
      if (inspectorLabel) inspectorLabel.textContent = 'SELECTED PAGE';
      if (inspectorTitle) inspectorTitle.textContent = 'Select a layer';
    }
  }

  function renderPrintPlan() {
    var sheetCount = BL.S.pages.length / 8;
    var pageCount = BL.S.pages.length;
    
    // Print plan label
    var printPlanLabel = document.getElementById('printPlanLabel');
    if (printPlanLabel) {
      printPlanLabel.textContent = '0' + sheetCount + ' / ' + BL.S.sheet + ' PRINT PLAN';
    }
    
    // Print plan title
    var printPlanTitle = document.getElementById('printPlanTitle');
    if (printPlanTitle) {
      var sheetWord = sheetCount === 1 ? 'One sheet' : sheetCount + ' sheets';
      var pageWord = pageCount === 8 ? 'Eight' : pageCount === 16 ? 'Sixteen' : 'Twenty-four';
      printPlanTitle.innerHTML = sheetWord + '.<br><span class="accent">' + pageWord + ' A5 pages.</span>';
    }
    
    // Imposition diagram - show all sheets
    var diagram = document.getElementById('impositionDiagram');
    if (diagram) {
      var html = '';
      for (var k = 1; k <= sheetCount; k++) {
        var imp = BL.computeImposition(k, pageCount);
        if (sheetCount > 1) {
          html += '<div class="sheet-label">Sheet ' + k + '</div>';
        }
        for (var r = 0; r < imp.side1.length; r++) {
          for (var c = 0; c < imp.side1[r].length; c++) {
            var pageNum = imp.side1[r][c];
            var isRot = r === imp.rotatedRow;
            html += '<div class="cell' + (isRot ? ' rot' : '') + '">' + pageNum + '</div>';
          }
        }
      }
      diagram.innerHTML = html;
    }
  }

  BL.renderTools = renderTools;

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
  }

  BL.updateTopBar = updateTopBar;

  // ============ Render all ============
  function renderAll() {
    updateTopBar();
    renderStrip();
    renderTools();
    renderPrintPlan();
    renderEditor();
    BL.renderInspector();
    if (BL.renderSheets) BL.renderSheets();
    if (BL.updateSteps) BL.updateSteps();
    if (BL.renderSafetyPanel) BL.renderSafetyPanel();
  }

  BL.renderAll = renderAll;

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
          // Shrinking: confirm before deleting pages
          var toDelete = oldCount - newCount;
          if (!confirm('Changing to ' + newCount + ' pages will delete pages ' + (newCount + 1) + '–' + oldCount + '. Continue?')) {
            return;
          }
        }
        
        BL.pushUndo();
        
        if (newCount > oldCount) {
          // Growing: add pages
          for (var i = oldCount; i < newCount; i++) {
            BL.S.pages.push(BL.newPage());
          }
        } else {
          // Shrinking: remove pages
          BL.S.pages.length = newCount;
          if (BL.cur >= newCount) BL.cur = newCount - 1;
          BL.sel = null;
        }
        
        BL.S.pageCount = newCount;
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
    
    // Sheets overlay button
    var bSheets = document.getElementById('bSheets');
    if (bSheets) {
      bSheets.addEventListener('click', function() {
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
    
    // Escape to close overlay
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('sheetsOverlay');
        if (overlay && !overlay.hidden) {
          overlay.hidden = true;
        }
      }
    });
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
          var customBg = document.getElementById('customBg');
          if (customBg) customBg.click();
          return;
        }
        
        BL.pushUndo();
        BL.S.pages[BL.cur].bg = btn.dataset.c;
        renderSwatches();
        renderEditor();
        renderStrip();
        BL.save();
      });
      
      swatches.addEventListener('input', function(e) {
        if (e.target.id !== 'customBg') return;
        
        BL.pushUndo();
        BL.S.pages[BL.cur].bg = e.target.value;
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
    
    var bAddShape = document.getElementById('bAddShape');
    if (bAddShape) {
      bAddShape.addEventListener('click', BL.addShapeLayer);
    }
    
    // Add layer buttons (center toolbar)
    var bAddPhotoAlt = document.getElementById('bAddPhotoAlt');
    if (bAddPhotoAlt) {
      bAddPhotoAlt.addEventListener('click', BL.addPhotoLayer);
    }
    
    var bAddTextAlt = document.getElementById('bAddTextAlt');
    if (bAddTextAlt) {
      bAddTextAlt.addEventListener('click', BL.addTextLayer);
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
  }

  // ============ Test API ============
  // Exposed on window.BL for automated testing
  // Already exposed: BL.S, BL.cur, BL.sel, BL.applyTemplate, BL.exportState, BL.importState, etc.

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
