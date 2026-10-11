/**
 * Bookletter — boot + wiring; exposes test API on window.BL
 */
(function() {
  'use strict';
  var BL = window.BL;

  // ============ Toast ============
  var toastTimer = null;

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    
    el.textContent = msg;
    el.classList.add('on');
    
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      el.classList.remove('on');
    }, 3200);
  }

  BL.toast = toast;

  // ============ Page strip rendering ============
  function renderStrip() {
    var strip = document.getElementById('strip');
    if (!strip) return;
    
    strip.innerHTML = '';
    
    for (var i = 0; i < 8; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb';
      btn.setAttribute('aria-current', i === BL.cur);
      btn.dataset.page = i;
      
      var box = document.createElement('div');
      box.className = 'box';
      box.style.setProperty('--mm', '0.55px');
      box.appendChild(BL.renderPage(i, {}));
      
      var lbl = document.createElement('div');
      lbl.className = 'lbl';
      lbl.textContent = BL.PAGE_LABELS[i];
      
      btn.appendChild(box);
      btn.appendChild(lbl);
      
      btn.addEventListener('click', (function(idx) {
        return function() {
          BL.cur = idx;
          BL.sel = null;
          BL.renderAll();
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
    
    // Remove existing handles before clearing (they're inside the container)
    var oldHandles = container.querySelector('.layer-handles');
    if (oldHandles) oldHandles.remove();
    
    container.innerHTML = '';
    container.appendChild(BL.renderPage(BL.cur, { edit: true, sel: BL.sel, nums: BL.S.nums }));
    BL.fitEditor();
    
    // Render handles for selected layer
    if (BL.renderHandles) BL.renderHandles();
  }

  BL.renderEditor = renderEditor;

  // ============ Tools panel rendering ============
  function renderTools() {
    // Page title
    var toolHead = document.getElementById('toolHead');
    if (toolHead) {
      toolHead.textContent = 'Page ' + (BL.cur + 1);
    }
    
    var toolSub = document.getElementById('toolSub');
    if (toolSub) {
      if (BL.cur === 0) {
        toolSub.textContent = 'Front cover';
      } else if (BL.cur === 7) {
        toolSub.textContent = 'Back cover';
      } else if (BL.cur % 2 === 1) {
        toolSub.textContent = 'Inside, left-hand page';
      } else {
        toolSub.textContent = 'Inside, right-hand page';
      }
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
    var swatches = document.getElementById('swatches');
    if (swatches) {
      renderSwatches();
    }
  }

  // Background colors from prototype
  var BGS = ['#ffffff', '#f1f5ee', '#e0eed3', '#f7ecc4', '#dcebf1', '#f4dcd5', '#1f3a2c', '#17261f'];

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
    html += '<input type="color" id="customBg" value="' + page.bg + '" title="Custom color">';
    
    swatches.innerHTML = html;
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
        btns[i].setAttribute('aria-pressed', btns[i].dataset.v === BL.S.orient);
      }
    }
    
    // Toggles
    var tGuide = document.getElementById('tGuide');
    if (tGuide) {
      tGuide.setAttribute('aria-pressed', BL.S.guide);
    }
    
    var tNums = document.getElementById('tNums');
    if (tNums) {
      tNums.setAttribute('aria-pressed', BL.S.nums);
    }
  }

  BL.updateTopBar = updateTopBar;

  // ============ Render all ============
  function renderAll() {
    updateTopBar();
    renderStrip();
    renderTools();
    renderEditor();
    BL.renderInspector();
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
        BL.save();
      });
    }
  }

  function setupTools() {
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
    
    // Add layer buttons
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
      BL.setupPersist();
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
