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
    BL.renderInspector();
  }

  function deselect() {
    BL.sel = null;
    updateSelectionUI();
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
      layer.px = 50;
      layer.py = 50;
      BL.renderEditor();
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
      for (var pi = 0; pi < 8; pi++) {
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
            layer.px = 50;
            layer.py = 50;
            BL.selectLayer(layer.id);
            BL.renderEditor();
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
          BL.selectLayer(newLayer.id);
          BL.renderEditor();
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
    if (!box) return;
    
    var layer = BL.findLayer(BL.sel);
    if (!layer) {
      box.innerHTML = '<p class="hint" style="margin:0">Click a layer on the page to edit it.</p>';
      return;
    }
    
    var html = '';
    
    // Common controls: position, size, rotation, opacity
    html += '<div class="insp-section">';
    html += '<div class="insp-row"><label>X <input type="number" data-prop="x" value="' + layer.x.toFixed(1) + '" step="0.1"> mm</label>';
    html += '<label>Y <input type="number" data-prop="y" value="' + layer.y.toFixed(1) + '" step="0.1"> mm</label></div>';
    html += '<div class="insp-row"><label>W <input type="number" data-prop="w" value="' + layer.w.toFixed(1) + '" step="0.1" min="1"> mm</label>';
    html += '<label>H <input type="number" data-prop="h" value="' + layer.h.toFixed(1) + '" step="0.1" min="1"> mm</label></div>';
    html += '<div class="insp-row"><label>Rotation <input type="number" data-prop="rot" value="' + layer.rot + '" step="1">°</label>';
    html += '<label>Opacity <input type="number" data-prop="opacity" value="' + layer.opacity.toFixed(2) + '" step="0.05" min="0" max="1"></label></div>';
    html += '</div>';
    
    // Layer order buttons
    html += '<div class="insp-section">';
    html += '<div class="acts">';
    html += '<button class="btn sm" data-act="front">To front</button>';
    html += '<button class="btn sm" data-act="forward">Forward</button>';
    html += '<button class="btn sm" data-act="back">Back</button>';
    html += '<button class="btn sm" data-act="bottom">To back</button>';
    html += '</div>';
    html += '</div>';
    
    // Kind-specific controls
    if (layer.kind === 'photo') {
      html += '<div class="insp-section">';
      html += '<button class="btn big" data-act="pick">' + (layer.src ? 'Replace image' : 'Choose image') + '</button>';
      if (layer.src) {
        html += '<div class="insp-row" style="margin-top:10px"><span>Scale</span>';
        html += '<div class="seg2">';
        html += '<button data-act="fit" data-v="cover" aria-pressed="' + (layer.fit === 'cover') + '">Fill</button>';
        html += '<button data-act="fit" data-v="contain" aria-pressed="' + (layer.fit === 'contain') + '">Fit</button>';
        html += '</div></div>';
        html += '<button class="btn ghost" data-act="clearimg">Remove image</button>';
        html += '<p class="hint">' + (layer.fit === 'cover' ? 'Drag the image to reposition it (coming soon).' : 'Fit shows the whole image with margins.') + '</p>';
      } else {
        html += '<p class="hint">You can also drop an image file onto the layer.</p>';
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
      html += '<div class="insp-row"><span>Size (mm)</span><input type="number" data-prop="size" value="' + layer.size.toFixed(1) + '" step="0.5" min="1" max="100"></div>';
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
      html += '<div class="insp-row"><span>Color</span><input type="color" data-prop="color" value="' + layer.color + '"></div>';
      html += '<div class="insp-row"><span>Line height</span><input type="number" data-prop="line" value="' + layer.line.toFixed(2) + '" step="0.1" min="0.8" max="3"></div>';
      html += '</div>';
    } else if (layer.kind === 'shape') {
      html += '<div class="insp-section">';
      html += '<div class="insp-row"><span>Shape</span>';
      html += '<div class="shape-picker">';
      for (var i = 0; i < BL.SHAPE_NAMES.length; i++) {
        var name = BL.SHAPE_NAMES[i];
        html += '<button class="shape-btn" data-act="shape" data-v="' + name + '" aria-pressed="' + (layer.shape === name) + '" title="' + name + '">';
        html += '<svg viewBox="0 0 100 100">' + BL.SHAPES[name] + '</svg>';
        html += '</button>';
      }
      html += '</div></div>';
      html += '<div class="insp-row"><span>Fill</span><input type="color" data-prop="color" value="' + layer.color + '"></div>';
      html += '<div class="insp-row"><span>Stroke color</span><input type="color" data-prop="stroke" value="' + (layer.stroke || '#000000') + '"></div>';
      html += '<div class="insp-row"><span>Stroke width (mm)</span><input type="number" data-prop="strokeWidth" value="' + layer.strokeWidth.toFixed(2) + '" step="0.1" min="0.25" max="10"></div>';
      html += '</div>';
    }
    
    // Duplicate and delete
    html += '<div class="insp-section">';
    html += '<div class="acts">';
    html += '<button class="btn" data-act="duplicate">Duplicate</button>';
    html += '<button class="btn danger" data-act="delete">Delete</button>';
    html += '</div></div>';
    
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
    } else if (act === 'shape') {
      layer.shape = val;
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
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  function addShapeLayer() {
    BL.pushUndo();
    var dims = BL.pageDims();
    var cx = dims[0] / 2;
    var cy = dims[1] / 2;
    var layer = BL.newShapeLayer(cx - 20, cy - 20, 40, 40);
    BL.S.pages[BL.cur].layers.push(layer);
    BL.sel = layer.id;
    BL.renderEditor();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  BL.addPhotoLayer = addPhotoLayer;
  BL.addTextLayer = addTextLayer;
  BL.addShapeLayer = addShapeLayer;

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
    var canvas = document.querySelector('.canvas');
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
    
    var cap = document.getElementById('pageCap');
    if (cap) {
      cap.textContent = 'Page ' + (BL.cur + 1) + ' of 8 · A5 ' + pw + ' × ' + ph + ' mm';
    }
    
    return mm;
  }

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
