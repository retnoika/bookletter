/**
 * Bookletter — selection, inspector, keyboard, inline text editing, photo loading
 * Pointer gestures for drag/resize/rotate are in step 2.
 */
(function() {
  'use strict';
  var BL = window.BL;

  // ============ Selection ============
  function selectLayer(id) {
    BL.sel = id;
    updateSelectionUI();
    updateLayersPanelSelection();
    if (BL.renderHandles) BL.renderHandles();
    BL.renderInspector();
  }

  function deselect() {
    BL.sel = null;
    updateSelectionUI();
    updateLayersPanelSelection();
    if (BL.renderHandles) BL.renderHandles();
    BL.renderInspector();
  }

  function updateSelectionUI() {
    var layers = document.querySelectorAll('#editorPage .layer');
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      if (el.dataset.id === BL.sel) {
        el.classList.add('sel');
      } else {
        el.classList.remove('sel');
      }
    }
  }

  // ============ Layers Panel ============
  // Thumbnail cache: layerId -> data URL
  var thumbCache = {};
  
  function updateLayersPanelSelection() {
    var rows = document.querySelectorAll('.layer-row');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.dataset.id === BL.sel) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    }
  }
  
  function getLayerName(layer, index) {
    if (layer.kind === 'text') {
      // Use first few words of text content
      var text = (layer.text || '').trim();
      if (text.length > 0) {
        // Take first ~30 chars, cut at word boundary
        if (text.length <= 30) return text;
        var cut = text.substring(0, 30);
        var space = cut.lastIndexOf(' ');
        if (space > 15) cut = cut.substring(0, space);
        return cut + '…';
      }
      return 'Text ' + (index + 1);
    } else if (layer.kind === 'photo') {
      if (layer.src) {
        // Try to extract filename from data URL or blob URL
        var name = layer.fileName;
        if (name && name.length <= 24) {
          // Remove extension
          var dot = name.lastIndexOf('.');
          if (dot > 0) name = name.substring(0, dot);
          return name;
        }
      }
      return 'Photo ' + (index + 1);
    }
    return 'Layer ' + (index + 1);
  }
  
  function generateThumbnail(layer, callback) {
    var cacheKey = layer.id + '_' + (layer.src || '') + '_' + (layer.color || '');
    if (thumbCache[cacheKey]) {
      callback(thumbCache[cacheKey]);
      return;
    }
    
    if (layer.kind === 'photo' && layer.src) {
      // Create thumbnail from image
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 104;
        var ctx = canvas.getContext('2d');
        
        // Cover-fit the image
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var scale = Math.max(80 / iw, 104 / ih);
        var sw = iw * scale, sh = ih * scale;
        var sx = (80 - sw) / 2, sy = (104 - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);
        
        var dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        thumbCache[cacheKey] = dataUrl;
        callback(dataUrl);
      };
      img.onerror = function() {
        callback(null);
      };
      img.src = layer.src;
    } else {
      callback(null);
    }
  }
  
  function renderLayersPanel() {
    var listEl = document.getElementById('layersList');
    var orderEl = document.getElementById('layersOrder');
    if (!listEl || !orderEl) return;
    
    var page = BL.S.pages[BL.cur];
    if (!page) return;
    
    var layers = page.layers || [];
    
    // Empty state
    if (layers.length === 0) {
      listEl.innerHTML = '<div class="layers-empty">' +
        '<div class="layers-empty-text">Nothing on this page yet</div>' +
        '<div class="layers-empty-actions">' +
        '<button data-add="photo">' + BL.icon('photo', {size: 16}) + ' Image</button>' +
        '<button data-add="text">' + BL.icon('typography', {size: 16}) + ' Text</button>' +
        '</div></div>';
      orderEl.innerHTML = '';
      return;
    }
    
    // Render layers list (reversed: top = front of stack)
    var html = '';
    for (var i = layers.length - 1; i >= 0; i--) {
      var layer = layers[i];
      var name = getLayerName(layer, i);
      var typeLabel = layer.kind === 'photo' ? 'Photo' : 'Text';
      var selected = layer.id === BL.sel ? ' selected' : '';
      
      html += '<div class="layer-row' + selected + '" data-id="' + layer.id + '" data-index="' + i + '" tabindex="0">';
      html += '<div class="layer-grip" data-grip="' + layer.id + '">' + BL.icon('grip-vertical', {size: 16}) + '</div>';
      html += '<div class="layer-thumb" data-thumb="' + layer.id + '">';
      
      if (layer.kind === 'text') {
        // Text thumbnail: "Aa" in layer's color and font
        var color = layer.color || '#333';
        var fontFamily = layer.font === 'heading' ? 'var(--f-disp)' : 'var(--f-ui)';
        html += '<span class="layer-thumb-text" style="color:' + color + ';font-family:' + fontFamily + '">Aa</span>';
      } else if (layer.kind === 'photo' && layer.src) {
        html += '<img src="" alt="" data-load-thumb="' + layer.id + '">';
      } else {
        // Empty photo placeholder
        html += BL.icon('photo', {size: 20});
      }
      
      html += '</div>';
      html += '<div class="layer-info">';
      html += '<div class="layer-name">' + escapeHtml(name) + '</div>';
      html += '<div class="layer-type">' + typeLabel + '</div>';
      html += '</div>';
      html += '</div>';
    }
    listEl.innerHTML = html;
    
    // Render order buttons
    orderEl.innerHTML = 
      '<button data-act="front" aria-label="Move to front" title="Move to front">' + BL.icon('chevrons-up', {size: 18}) + '</button>' +
      '<button data-act="forward" aria-label="Bring forward" title="Bring forward">' + BL.icon('arrow-up', {size: 18}) + '</button>' +
      '<button data-act="back" aria-label="Send backward" title="Send backward">' + BL.icon('arrow-down', {size: 18}) + '</button>' +
      '<button data-act="bottom" aria-label="Send to back" title="Send to back">' + BL.icon('chevrons-down', {size: 18}) + '</button>';
    
    // Load photo thumbnails asynchronously
    var thumbEls = listEl.querySelectorAll('[data-load-thumb]');
    for (var j = 0; j < thumbEls.length; j++) {
      (function(el) {
        var layerId = el.dataset.loadThumb;
        var layer = BL.findLayer(layerId);
        if (layer) {
          generateThumbnail(layer, function(dataUrl) {
            if (dataUrl && el.parentNode) {
              el.src = dataUrl;
            }
          });
        }
      })(thumbEls[j]);
    }
  }
  
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  // Drag reorder state
  var dragState = null;
  
  function handleLayersPanelPointerDown(e) {
    var grip = e.target.closest('[data-grip]');
    if (grip) {
      // Start drag from grip
      e.preventDefault();
      var row = grip.closest('.layer-row');
      if (!row) return;
      
      dragState = {
        id: row.dataset.id,
        startY: e.clientY,
        rowHeight: row.offsetHeight,
        originalIndex: parseInt(row.dataset.index, 10),
        moved: false,
        undoPushed: false
      };
      row.classList.add('dragging');
      row.setPointerCapture(e.pointerId);
      return;
    }
    
    // Click on row (not grip) to select
    var row = e.target.closest('.layer-row');
    if (row) {
      selectLayer(row.dataset.id);
    }
    
    // Empty state add buttons
    var addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      if (addBtn.dataset.add === 'photo') {
        addPhotoLayer();
      } else if (addBtn.dataset.add === 'text') {
        addTextLayer();
      }
    }
  }
  
  function handleLayersPanelPointerMove(e) {
    if (!dragState) return;
    
    var listEl = document.getElementById('layersList');
    if (!listEl) return;
    
    var rows = listEl.querySelectorAll('.layer-row');
    var dragRow = listEl.querySelector('[data-id="' + dragState.id + '"]');
    if (!dragRow) return;
    
    // Clear all drop indicators
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('drag-over-top', 'drag-over-bottom');
    }
    
    // Find target row
    var rect = listEl.getBoundingClientRect();
    var y = e.clientY - rect.top;
    var targetRow = null;
    var insertBefore = true;
    
    for (var j = 0; j < rows.length; j++) {
      var rowRect = rows[j].getBoundingClientRect();
      var rowMid = rowRect.top + rowRect.height / 2 - rect.top;
      if (y < rowMid) {
        targetRow = rows[j];
        insertBefore = true;
        break;
      } else if (j === rows.length - 1) {
        targetRow = rows[j];
        insertBefore = false;
      }
    }
    
    if (targetRow && targetRow !== dragRow) {
      dragState.moved = true;
      if (insertBefore) {
        targetRow.classList.add('drag-over-top');
      } else {
        targetRow.classList.add('drag-over-bottom');
      }
    }
  }
  
  function handleLayersPanelPointerUp(e) {
    if (!dragState) return;
    
    var listEl = document.getElementById('layersList');
    if (!listEl) return;
    
    var dragRow = listEl.querySelector('[data-id="' + dragState.id + '"]');
    if (dragRow) {
      dragRow.classList.remove('dragging');
      dragRow.releasePointerCapture(e.pointerId);
    }
    
    // Clear all indicators
    var rows = listEl.querySelectorAll('.layer-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('drag-over-top', 'drag-over-bottom');
    }
    
    if (!dragState.moved) {
      dragState = null;
      return;
    }
    
    // Find target position
    var rect = listEl.getBoundingClientRect();
    var y = e.clientY - rect.top;
    var targetIndex = -1;
    
    // List is reversed: visual top = array end (front)
    for (var j = 0; j < rows.length; j++) {
      if (rows[j].dataset.id === dragState.id) continue;
      var rowRect = rows[j].getBoundingClientRect();
      var rowMid = rowRect.top + rowRect.height / 2 - rect.top;
      var rowIndex = parseInt(rows[j].dataset.index, 10);
      
      if (y < rowMid) {
        // Insert after this row in array (since list is reversed)
        targetIndex = rowIndex + 1;
        break;
      }
    }
    
    // If didn't find target, insert at bottom (index 0)
    if (targetIndex === -1) {
      targetIndex = 0;
    }
    
    var fromIndex = dragState.originalIndex;
    
    if (targetIndex !== fromIndex && targetIndex !== fromIndex + 1) {
      // Push undo once per drag
      BL.pushUndo();
      
      // Perform the move
      var layers = BL.S.pages[BL.cur].layers;
      var layer = layers.splice(fromIndex, 1)[0];
      
      // Adjust target if removing from before it
      if (fromIndex < targetIndex) targetIndex--;
      
      layers.splice(targetIndex, 0, layer);
      
      BL.renderEditor();
      renderLayersPanel();
      BL.save();
    }
    
    dragState = null;
  }
  
  function handleLayersPanelKeyDown(e) {
    var row = e.target.closest('.layer-row');
    if (!row) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectLayer(row.dataset.id);
    }
  }
  
  function handleLayersOrderClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    
    var layer = BL.findLayer(BL.sel);
    if (!layer) return;
    
    var act = btn.dataset.act;
    
    if (act === 'front') {
      moveLayerToFront();
      renderLayersPanel();
    } else if (act === 'forward') {
      moveLayerForward();
      renderLayersPanel();
    } else if (act === 'back') {
      moveLayerBack();
      renderLayersPanel();
    } else if (act === 'bottom') {
      moveLayerToBottom();
      renderLayersPanel();
    }
  }
  
  function setupLayersPanel() {
    var panel = document.querySelector('.layers-panel');
    if (!panel) return;
    
    panel.addEventListener('pointerdown', handleLayersPanelPointerDown);
    panel.addEventListener('pointermove', handleLayersPanelPointerMove);
    panel.addEventListener('pointerup', handleLayersPanelPointerUp);
    panel.addEventListener('pointercancel', handleLayersPanelPointerUp);
    panel.addEventListener('keydown', handleLayersPanelKeyDown);
    
    var orderEl = document.getElementById('layersOrder');
    if (orderEl) {
      orderEl.addEventListener('click', handleLayersOrderClick);
    }
  }
  
  BL.renderLayersPanel = renderLayersPanel;
  BL.setupLayersPanel = setupLayersPanel;

  BL.selectLayer = selectLayer;
  BL.deselect = deselect;

  // ============ Layer click handler ============
  function onLayerClick(e) {
    var wrap = e.target.closest('.layer');
    if (!wrap) return;
    
    // If clicking placeholder button, trigger file picker
    var phBtn = e.target.closest('.ph');
    if (phBtn) {
      selectLayer(wrap.dataset.id);
      BL.openPhotoPicker();
      return;
    }
    
    selectLayer(wrap.dataset.id);
  }

  // ============ Photo handling ============
  var MAX_IMAGE_SIZE = 3000;
  var JPEG_QUALITY = 0.92;

  function readImage(file) {
    return new Promise(function(resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function() {
        var scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      img.onerror = function() {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image'));
      };
      img.src = url;
    });
  }

  BL.readImage = readImage;

  function openPhotoPicker() {
    var input = document.getElementById('filePhoto');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  BL.openPhotoPicker = openPhotoPicker;

  function handlePhotoSelect(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    
    var layer = BL.findLayer(BL.sel);
    if (!layer || layer.kind !== 'photo') return;
    
    BL.pushUndo();
    readImage(file).then(function(dataUrl) {
      layer.src = dataUrl;
      layer.fileName = file.name;
      layer.px = 50;
      layer.py = 50;
      BL.renderEditor();
      renderLayersPanel();
      BL.renderInspector();
      BL.renderStrip();
      BL.save();
    }).catch(function(err) {
      BL.toast('Could not read that image.');
    });
  }

  // ============ Bulk fill ============
  function naturalSort(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }

  function bulkFill(files) {
    var list = Array.prototype.slice.call(files).sort(naturalSort);
    var filled = 0;
    var total = list.length;
    
    function findEmptyPhotoSlot() {
      for (var pi = 0; pi < BL.S.pages.length; pi++) {
        var page = BL.S.pages[pi];
        for (var li = 0; li < page.layers.length; li++) {
          var layer = page.layers[li];
          if (layer.kind === 'photo' && !layer.src) {
            return { pageIdx: pi, layer: layer };
          }
        }
      }
      return null;
    }
    
    BL.pushUndo();
    
    function processNext(idx) {
      if (idx >= list.length) {
        BL.renderAll();
        BL.save();
        if (filled < total) {
          BL.toast('Placed ' + filled + ' of ' + total + '. No empty image boxes left: add more photo frames or switch some pages to multi-panel layouts.');
        } else {
          BL.toast('Placed ' + filled + ' image' + (filled === 1 ? '' : 's') + ' in page order.');
        }
        return;
      }
      
      var slot = findEmptyPhotoSlot();
      if (!slot) {
        // No more empty slots
        BL.renderAll();
        BL.save();
        BL.toast('Placed ' + filled + ' of ' + total + '. No empty image boxes left: add more photo frames or switch some pages to multi-panel layouts.');
        return;
      }
      
      readImage(list[idx]).then(function(dataUrl) {
        slot.layer.src = dataUrl;
        slot.layer.fileName = list[idx].name;
        slot.layer.px = 50;
        slot.layer.py = 50;
        filled++;
        processNext(idx + 1);
      }).catch(function() {
        processNext(idx + 1);
      });
    }
    
    processNext(0);
  }

  BL.bulkFill = bulkFill;

  // ============ Drop handler ============
  function handleDrop(e) {
    e.preventDefault();
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    // Find which layer was dropped on
    var layerEl = e.target.closest('.layer');
    if (layerEl && layerEl.dataset.kind === 'photo') {
      var layer = BL.findLayer(layerEl.dataset.id);
      if (layer) {
        var file = Array.prototype.slice.call(files).find(function(f) {
          return f.type.startsWith('image/');
        });
        if (file) {
          BL.pushUndo();
          readImage(file).then(function(dataUrl) {
            layer.src = dataUrl;
            layer.fileName = file.name;
            layer.px = 50;
            layer.py = 50;
            BL.selectLayer(layer.id);
            BL.renderEditor();
            renderLayersPanel();
            BL.renderInspector();
            BL.renderStrip();
            BL.save();
          }).catch(function() {
            BL.toast('Could not read that image.');
          });
        }
      }
    } else {
      // Drop on page background - create new photo layer
      var imageFiles = Array.prototype.slice.call(files).filter(function(f) {
        return f.type.startsWith('image/');
      });
      if (imageFiles.length > 0) {
        BL.pushUndo();
        var dims = BL.pageDims();
        var safe = BL.S.safe || 8;
        var newLayer = BL.newPhotoLayer(safe, safe, dims[0] - 2 * safe, dims[1] - 2 * safe);
        BL.S.pages[BL.cur].layers.push(newLayer);
        
        readImage(imageFiles[0]).then(function(dataUrl) {
          newLayer.src = dataUrl;
          newLayer.fileName = imageFiles[0].name;
          BL.selectLayer(newLayer.id);
          BL.renderEditor();
          renderLayersPanel();
          BL.renderInspector();
          BL.renderStrip();
          BL.save();
        }).catch(function() {
          BL.toast('Could not read that image.');
        });
      }
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  // ============ Inspector rendering ============
  function renderInspector() {
    var box = document.getElementById('inspector');
    var labelEl = document.getElementById('inspectorLabel');
    var titleEl = document.getElementById('inspectorTitle');
    if (!box) return;
    
    var layer = BL.findLayer(BL.sel);
    if (!layer) {
      if (labelEl) labelEl.textContent = 'SELECTED PAGE';
      if (titleEl) titleEl.innerHTML = 'Add a photo';
      box.innerHTML = '<p class="hint" style="margin:0">Click a layer on the page to edit it.</p>';
      return;
    }
    
    // Update header based on layer type
    if (labelEl) labelEl.textContent = 'SELECTED LAYER';
    if (titleEl) {
      if (layer.kind === 'photo') {
        titleEl.innerHTML = layer.src ? 'Photo layer' : 'Empty photo';
      } else if (layer.kind === 'text') {
        titleEl.innerHTML = 'Text layer';
      } else {
        titleEl.innerHTML = 'Layer';
      }
    }
    
    var html = '';
    
    // ===== Geometry section: X/Y, W/H, Rotation/Opacity =====
    html += '<div class="insp-section">';
    
    // X and Y row
    html += '<div class="insp-grid">';
    html += '<div class="insp-field"><span class="insp-field-label">X</span>';
    html += '<div class="insp-input-wrap"><input type="number" inputmode="decimal" data-prop="x" value="' + layer.x.toFixed(1) + '" step="0.1"><span class="insp-unit">mm</span></div></div>';
    html += '<div class="insp-field"><span class="insp-field-label">Y</span>';
    html += '<div class="insp-input-wrap"><input type="number" inputmode="decimal" data-prop="y" value="' + layer.y.toFixed(1) + '" step="0.1"><span class="insp-unit">mm</span></div></div>';
    html += '</div>';
    
    // W and H row
    html += '<div class="insp-grid">';
    html += '<div class="insp-field"><span class="insp-field-label">W</span>';
    html += '<div class="insp-input-wrap"><input type="number" inputmode="decimal" data-prop="w" value="' + layer.w.toFixed(1) + '" step="0.1" min="1"><span class="insp-unit">mm</span></div></div>';
    html += '<div class="insp-field"><span class="insp-field-label">H</span>';
    html += '<div class="insp-input-wrap"><input type="number" inputmode="decimal" data-prop="h" value="' + layer.h.toFixed(1) + '" step="0.1" min="1"><span class="insp-unit">mm</span></div></div>';
    html += '</div>';
    
    // Rotation and Opacity row
    html += '<div class="insp-grid">';
    html += '<div class="insp-field"><span class="insp-field-label">Rotation</span>';
    html += '<div class="insp-input-wrap"><input type="number" inputmode="decimal" data-prop="rot" value="' + layer.rot + '" step="1"><span class="insp-unit">°</span></div></div>';
    html += '<div class="insp-field"><span class="insp-field-label">Opacity</span>';
    html += '<div class="insp-input-wrap"><input type="number" inputmode="decimal" data-prop="opacity" value="' + layer.opacity.toFixed(2) + '" step="0.05" min="0" max="1"></div></div>';
    html += '</div>';
    
    html += '</div>';
    
    // ===== Kind-specific controls =====
    if (layer.kind === 'photo') {
      html += '<div class="insp-section">';
      html += '<div class="insp-actions single">';
      html += '<button class="primary" data-act="pick">' + (layer.src ? 'Replace image' : 'Choose image') + '</button>';
      html += '</div>';
      if (layer.src) {
        html += '<div class="insp-row" style="margin-top:12px"><span>Scale</span>';
        html += '<div class="seg2">';
        html += '<button data-act="fit" data-v="cover" aria-pressed="' + (layer.fit === 'cover') + '">Fill</button>';
        html += '<button data-act="fit" data-v="contain" aria-pressed="' + (layer.fit === 'contain') + '">Fit</button>';
        html += '</div></div>';
        html += '<button class="ghost" data-act="clearimg">Remove image</button>';
        if (layer.fit === 'cover') {
          var panMode = BL.photoPanMode ? BL.photoPanMode() : false;
          html += '<div class="insp-row" style="margin-top:8px"><span>Pan</span>';
          html += '<div class="seg2">';
          html += '<button data-act="panmode" data-v="false" aria-pressed="' + (!panMode) + '">Off</button>';
          html += '<button data-act="panmode" data-v="true" aria-pressed="' + (panMode) + '">On</button>';
          html += '</div></div>';
          html += '<p class="hint">Alt+drag or enable Pan to reposition.</p>';
        } else {
          html += '<p class="hint">Fit shows the whole image.</p>';
        }
      } else {
        html += '<p class="hint">Drop an image onto the layer.</p>';
      }
      html += '</div>';
    } else if (layer.kind === 'text') {
      html += '<div class="insp-section">';
      html += '<div class="insp-row"><span>Font</span>';
      html += '<div class="seg2">';
      html += '<button data-act="font" data-v="sans" aria-pressed="' + (layer.font === 'sans') + '">Sans</button>';
      html += '<button data-act="font" data-v="serif" aria-pressed="' + (layer.font === 'serif') + '">Serif</button>';
      html += '<button data-act="font" data-v="mono" aria-pressed="' + (layer.font === 'mono') + '">Mono</button>';
      html += '</div></div>';
      html += '<div class="insp-row"><span>Size</span><input type="number" inputmode="decimal" data-prop="size" value="' + layer.size.toFixed(1) + '" step="0.5" min="1" max="100"></div>';
      html += '<div class="insp-row"><span>Align</span>';
      html += '<div class="seg2">';
      html += '<button data-act="align" data-v="left" aria-pressed="' + (layer.align === 'left') + '">Left</button>';
      html += '<button data-act="align" data-v="center" aria-pressed="' + (layer.align === 'center') + '">Center</button>';
      html += '<button data-act="align" data-v="right" aria-pressed="' + (layer.align === 'right') + '">Right</button>';
      html += '</div></div>';
      html += '<div class="insp-row"><span>Weight</span>';
      html += '<div class="seg2">';
      html += '<button data-act="bold" data-v="false" aria-pressed="' + (!layer.bold) + '">Regular</button>';
      html += '<button data-act="bold" data-v="true" aria-pressed="' + (layer.bold) + '">Bold</button>';
      html += '</div></div>';
      html += '<div class="insp-row"><span>Color</span><button type="button" class="insp-color-btn" data-act="color" style="background:' + layer.color + '" title="' + layer.color + '"></button></div>';
      html += '<div class="insp-row"><span>Line ht</span><input type="number" inputmode="decimal" data-prop="line" value="' + layer.line.toFixed(2) + '" step="0.1" min="0.8" max="3"></div>';
      html += '</div>';
    }
    
    // ===== Duplicate and Delete =====
    html += '<div class="insp-section">';
    html += '<div class="insp-actions">';
    html += '<button data-act="duplicate">Duplicate</button>';
    html += '<button class="danger" data-act="delete">Delete</button>';
    html += '</div>';
    html += '</div>';
    
    box.innerHTML = html;
  }

  BL.renderInspector = renderInspector;

  // ============ Inspector event handlers ============
  function handleInspectorClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    
    var layer = BL.findLayer(BL.sel);
    if (!layer) return;
    
    var act = btn.dataset.act;
    var val = btn.dataset.v;
    
    BL.pushUndo();
    
    if (act === 'pick') {
      BL.openPhotoPicker();
      return;
    } else if (act === 'fit') {
      layer.fit = val;
    } else if (act === 'clearimg') {
      layer.src = null;
    } else if (act === 'font') {
      layer.font = val;
    } else if (act === 'align') {
      layer.align = val;
    } else if (act === 'bold') {
      layer.bold = val === 'true';
    } else if (act === 'color') {
      // Open in-app color picker for text color
      BL.openColorPicker({
        anchor: btn,
        color: layer.color || '#000000',
        onApply: function(hex) {
          BL.pushUndo();
          layer.color = hex;
          BL.renderEditor();
          BL.renderInspector();
          BL.renderStrip();
          BL.save();
        }
      });
      return;
    } else if (act === 'panmode') {
      if (BL.setPhotoPanMode) BL.setPhotoPanMode(val === 'true');
      BL.renderInspector();
      return;
    } else if (act === 'duplicate') {
      duplicateLayer();
      return;
    } else if (act === 'delete') {
      deleteSelectedLayer();
      return;
    } else if (act === 'front') {
      moveLayerToFront();
      return;
    } else if (act === 'forward') {
      moveLayerForward();
      return;
    } else if (act === 'back') {
      moveLayerBack();
      return;
    } else if (act === 'bottom') {
      moveLayerToBottom();
      return;
    } else {
      return;
    }
    
    BL.renderEditor();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  function handleInspectorInput(e) {
    var input = e.target;
    if (!input.dataset.prop) return;
    
    var layer = BL.findLayer(BL.sel);
    if (!layer) return;
    
    var prop = input.dataset.prop;
    var val;
    
    if (input.type === 'number') {
      val = parseFloat(input.value);
      if (isNaN(val)) return;
    } else if (input.type === 'color') {
      val = input.value;
    } else {
      val = input.value;
    }
    
    // Validate strokeWidth minimum
    if (prop === 'strokeWidth' && val < 0.25) {
      val = 0.25;
      input.value = val;
    }
    
    BL.pushUndo();
    layer[prop] = val;
    BL.renderEditor();
    BL.renderStrip();
    BL.save();
  }

  // ============ Layer operations ============
  function deleteSelectedLayer() {
    if (!BL.sel) return;
    var idx = BL.findLayerIndex(BL.sel);
    if (idx === -1) return;
    
    BL.pushUndo();
    BL.S.pages[BL.cur].layers.splice(idx, 1);
    BL.sel = null;
    BL.renderEditor();
    renderLayersPanel();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  function duplicateLayer() {
    var layer = BL.findLayer(BL.sel);
    if (!layer) return;
    
    BL.pushUndo();
    var copy = BL.clone(layer);
    copy.id = BL.genId();
    copy.x += 5;
    copy.y += 5;
    BL.S.pages[BL.cur].layers.push(copy);
    BL.sel = copy.id;
    BL.renderEditor();
    renderLayersPanel();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  function moveLayerToFront() {
    var idx = BL.findLayerIndex(BL.sel);
    if (idx === -1) return;
    var layers = BL.S.pages[BL.cur].layers;
    if (idx === layers.length - 1) return;
    
    BL.pushUndo();
    var layer = layers.splice(idx, 1)[0];
    layers.push(layer);
    BL.renderEditor();
    renderLayersPanel();
    BL.save();
  }

  function moveLayerForward() {
    var idx = BL.findLayerIndex(BL.sel);
    if (idx === -1) return;
    var layers = BL.S.pages[BL.cur].layers;
    if (idx === layers.length - 1) return;
    
    BL.pushUndo();
    var tmp = layers[idx];
    layers[idx] = layers[idx + 1];
    layers[idx + 1] = tmp;
    BL.renderEditor();
    renderLayersPanel();
    BL.save();
  }

  function moveLayerBack() {
    var idx = BL.findLayerIndex(BL.sel);
    if (idx === -1 || idx === 0) return;
    var layers = BL.S.pages[BL.cur].layers;
    
    BL.pushUndo();
    var tmp = layers[idx];
    layers[idx] = layers[idx - 1];
    layers[idx - 1] = tmp;
    BL.renderEditor();
    renderLayersPanel();
    BL.save();
  }

  function moveLayerToBottom() {
    var idx = BL.findLayerIndex(BL.sel);
    if (idx === -1 || idx === 0) return;
    var layers = BL.S.pages[BL.cur].layers;
    
    BL.pushUndo();
    var layer = layers.splice(idx, 1)[0];
    layers.unshift(layer);
    BL.renderEditor();
    renderLayersPanel();
    BL.save();
  }

  BL.deleteSelectedLayer = deleteSelectedLayer;
  BL.duplicateLayer = duplicateLayer;

  // ============ Add layer buttons ============
  function addPhotoLayer() {
    BL.pushUndo();
    var dims = BL.pageDims();
    var safe = BL.S.safe || 8;
    var layer = BL.newPhotoLayer(safe, safe, dims[0] - 2 * safe, dims[1] - 2 * safe);
    BL.S.pages[BL.cur].layers.push(layer);
    BL.sel = layer.id;
    BL.renderEditor();
    renderLayersPanel();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  function addTextLayer() {
    BL.pushUndo();
    var dims = BL.pageDims();
    var safe = BL.S.safe || 8;
    var layer = BL.newTextLayer(safe, safe + 20, dims[0] - 2 * safe, 40);
    BL.S.pages[BL.cur].layers.push(layer);
    BL.sel = layer.id;
    BL.renderEditor();
    renderLayersPanel();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  BL.addPhotoLayer = addPhotoLayer;
  BL.addTextLayer = addTextLayer;

  // ============ Inline text editing ============
  function handleTextDblClick(e) {
    var layerEl = e.target.closest('.layer');
    if (!layerEl || layerEl.dataset.kind !== 'text') return;
    
    var tx = layerEl.querySelector('.tx');
    if (!tx) return;
    
    tx.focus();
  }

  function handleTextInput(e) {
    var tx = e.target;
    if (!tx.classList.contains('tx')) return;
    
    var layerEl = tx.closest('.layer');
    if (!layerEl) return;
    
    var layer = BL.findLayer(layerEl.dataset.id);
    if (!layer) return;
    
    layer.text = tx.innerText.replace(/\n$/, '');
    if (!tx.textContent.trim()) {
      tx.innerHTML = '';
    }
    BL.renderStrip();
    BL.save();
  }

  function handleTextBlur(e) {
    var tx = e.target;
    if (!tx.classList.contains('tx')) return;
    
    var layerEl = tx.closest('.layer');
    if (!layerEl) return;
    
    var layer = BL.findLayer(layerEl.dataset.id);
    if (!layer) return;
    
    // Remove empty text layers
    if (!layer.text.trim()) {
      var idx = BL.findLayerIndex(layer.id);
      if (idx !== -1) {
        BL.pushUndo();
        BL.S.pages[BL.cur].layers.splice(idx, 1);
        if (BL.sel === layer.id) {
          BL.sel = null;
        }
        BL.renderEditor();
        BL.renderInspector();
        BL.renderStrip();
        BL.save();
      }
    }
  }

  function handleTextKeydown(e) {
    var tx = e.target;
    if (!tx.classList.contains('tx')) return;
    
    if (e.key === 'Escape') {
      tx.blur();
      e.preventDefault();
    }
  }

  // ============ Keyboard shortcuts ============
  function handleKeydown(e) {
    // Guard against non-element targets (e.g. document)
    var target = e.target;
    if (!target || typeof target.closest !== 'function') {
      return;
    }
    
    // Don't intercept when editing text
    if (target.closest('.tx') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // Still handle Escape for text
      if (e.key === 'Escape' && target.closest('.tx')) {
        target.blur();
        e.preventDefault();
      }
      return;
    }
    
    var mod = e.ctrlKey || e.metaKey;
    
    if ((e.key === 'Delete' || e.key === 'Backspace') && BL.sel) {
      e.preventDefault();
      deleteSelectedLayer();
    } else if (e.key === 'Escape') {
      deselect();
    } else if (e.key === 'z' && mod && !e.shiftKey) {
      e.preventDefault();
      if (BL.undo()) {
        BL.renderAll();
        BL.save();
      }
    } else if ((e.key === 'z' && mod && e.shiftKey) || (e.key === 'y' && mod)) {
      e.preventDefault();
      if (BL.redo()) {
        BL.renderAll();
        BL.save();
      }
    } else if (e.key === 'd' && mod && BL.sel) {
      e.preventDefault();
      duplicateLayer();
    } else if (e.key === 's' && mod) {
      e.preventDefault();
      BL.saveProject();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (BL.sel) {
        e.preventDefault();
        nudgeLayer(e);
      }
    }
  }

  function nudgeLayer(e) {
    var layer = BL.findLayer(BL.sel);
    if (!layer) return;
    
    var amt = 1; // 1mm default
    if (e.shiftKey) amt = 5;
    if (e.altKey) amt = 0.1;
    
    BL.pushUndo();
    
    if (e.key === 'ArrowUp') {
      layer.y -= amt;
    } else if (e.key === 'ArrowDown') {
      layer.y += amt;
    } else if (e.key === 'ArrowLeft') {
      layer.x -= amt;
    } else if (e.key === 'ArrowRight') {
      layer.x += amt;
    }
    
    BL.renderEditor();
    BL.renderInspector();
    BL.save();
  }

  // ============ Zoom controls ============
  var zoomLevel = 0; // -2 to +2, 0 = fit
  var BASE_SCALE = 2.4;

  function fitEditor() {
    // If in spread mode, delegate to fitEditorSpread
    var stage = document.getElementById('canvasStage');
    if (stage && stage.classList.contains('spread-view')) {
      return fitEditorSpread();
    }
    
    var canvas = document.querySelector('.canvas-wrap');
    var editorPage = document.getElementById('editorPage');
    if (!canvas || !editorPage) return;
    
    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var availW = canvas.clientWidth - 40 || 600;
    var availH = window.innerHeight - 280;
    
    var fitMm = Math.min(availW / pw, availH / ph, 3.4);
    var mm;
    
    if (zoomLevel === 0) {
      mm = Math.max(1.1, fitMm);
    } else {
      mm = Math.max(0.8, fitMm * Math.pow(1.3, zoomLevel));
    }
    
    editorPage.style.setProperty('--mm', mm + 'px');
    editorPage.style.setProperty('--pw', pw);
    editorPage.style.setProperty('--ph', ph);
    
    var cap = document.getElementById('pageCap');
    if (cap) {
      cap.textContent = 'Page ' + (BL.cur + 1) + ' of ' + BL.S.pages.length + ' · A5 · ' + pw + ' × ' + ph + ' mm';
    }
    
    return mm;
  }

  // Fit editor for spread view (two pages side by side)
  function fitEditorSpread() {
    var canvas = document.querySelector('.canvas-wrap');
    var stage = document.getElementById('canvasStage');
    var editorPage = document.getElementById('editorPage');
    if (!canvas || !stage || !editorPage) return;
    
    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var spreadWidth = pw * 2 + 4;  // Two pages + gap (in mm)
    var availW = canvas.clientWidth - 40 || 600;
    var availH = window.innerHeight - 280;
    
    var fitMm = Math.min(availW / spreadWidth, availH / ph, 3.4);
    var mm;
    
    if (zoomLevel === 0) {
      mm = Math.max(0.8, fitMm);
    } else {
      mm = Math.max(0.6, fitMm * Math.pow(1.3, zoomLevel));
    }
    
    // Apply same scale to all spread elements
    editorPage.style.setProperty('--mm', mm + 'px');
    editorPage.style.setProperty('--pw', pw);
    editorPage.style.setProperty('--ph', ph);
    
    var partners = stage.querySelectorAll('.spread-partner');
    partners.forEach(function(p) {
      p.style.setProperty('--mm', mm + 'px');
      p.style.setProperty('--pw', pw);
      p.style.setProperty('--ph', ph);
    });
    
    // Set blank placeholder size to match page
    var blanks = stage.querySelectorAll('.spread-blank');
    blanks.forEach(function(b) {
      b.style.width = (pw * mm) + 'px';
      b.style.height = (ph * mm) + 'px';
    });
    
    // Update caption for spread
    updateSpreadCaption(mm);
    
    return mm;
  }
  
  function updateSpreadCaption(mm) {
    var cap = document.getElementById('pageCap');
    if (!cap) return;
    
    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var total = BL.S.pages.length;
    var cur = BL.cur;
    
    // Get spread info
    var spread = getSpreadInfoForCaption(cur, total);
    var text;
    
    if (spread.leftPage === null) {
      // Front cover alone
      text = 'Page 1 of ' + total;
    } else if (spread.rightPage === null) {
      // Back cover alone
      text = 'Page ' + total + ' of ' + total;
    } else {
      // Interior spread
      text = 'Pages ' + (spread.leftPage + 1) + '–' + (spread.rightPage + 1) + ' of ' + total;
    }
    
    cap.textContent = text + ' · A5 · ' + pw + ' × ' + ph + ' mm';
  }
  
  // Duplicate of getSpreadInfo for caption (avoid circular dependency)
  function getSpreadInfoForCaption(curPage, total) {
    if (curPage === 0) {
      return { leftPage: null, rightPage: 0 };
    }
    if (curPage === total - 1) {
      return { leftPage: total - 1, rightPage: null };
    }
    var pageNum = curPage + 1;
    if (pageNum % 2 === 0) {
      return { leftPage: curPage, rightPage: curPage + 1 };
    } else {
      return { leftPage: curPage - 1, rightPage: curPage };
    }
  }
  
  BL.fitEditorSpread = fitEditorSpread;

  function zoomIn() {
    if (zoomLevel < 2) {
      zoomLevel++;
      fitEditor();
    }
  }

  function zoomOut() {
    if (zoomLevel > -2) {
      zoomLevel--;
      fitEditor();
    }
  }

  function zoomFit() {
    zoomLevel = 0;
    fitEditor();
  }

  BL.fitEditor = fitEditor;
  BL.zoomIn = zoomIn;
  BL.zoomOut = zoomOut;
  BL.zoomFit = zoomFit;

  // ============ Setup ============
  function setupEditor() {
    // Photo file input
    var filePhoto = document.getElementById('filePhoto');
    if (filePhoto) {
      filePhoto.addEventListener('change', handlePhotoSelect);
    }
    
    // Bulk fill input
    var fileMany = document.getElementById('fileMany');
    if (fileMany) {
      fileMany.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length) {
          BL.bulkFill(e.target.files);
        }
      });
    }
    
    // Editor page event delegation
    var editorPage = document.getElementById('editorPage');
    if (editorPage) {
      editorPage.addEventListener('click', onLayerClick);
      editorPage.addEventListener('dblclick', handleTextDblClick);
      editorPage.addEventListener('input', handleTextInput);
      editorPage.addEventListener('blur', handleTextBlur, true);
      editorPage.addEventListener('keydown', handleTextKeydown);
      editorPage.addEventListener('drop', handleDrop);
      editorPage.addEventListener('dragover', handleDragOver);
    }
    
    // Inspector event delegation
    var inspector = document.getElementById('inspector');
    if (inspector) {
      inspector.addEventListener('click', handleInspectorClick);
      inspector.addEventListener('input', handleInspectorInput);
    }
    
    // Layers panel
    setupLayersPanel();
    
    // Global keyboard
    document.addEventListener('keydown', handleKeydown);
    
    // Resize handler
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        fitEditor();
        BL.renderStrip();
      }, 120);
    });
  }

  BL.setupEditor = setupEditor;
  BL.handlePhotoSelect = handlePhotoSelect;

})();
