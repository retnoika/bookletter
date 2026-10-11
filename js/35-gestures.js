/**
 * Bookletter — direct manipulation gestures
 * Move, resize, rotate layers; snap guides; photo pan; touch gestures.
 * All geometry in millimetres via the --mm scale factor.
 */
(function() {
  'use strict';
  var BL = window.BL;

  // ============ Gesture state ============
  var gesture = null;  // Active gesture or null
  var snapEnabled = true;
  var photoPanMode = false;  // Inspector toggle for touch pan
  var SNAP_THRESHOLD = 2;  // mm
  var MIN_SIZE = 3;  // mm minimum layer size
  var HANDLE_SIZE = 10;  // px visible handle
  var HANDLE_HIT = 44;  // px touch hit area

  // ============ Snap toggle ============
  BL.snapEnabled = function() { return snapEnabled; };
  BL.toggleSnap = function() { snapEnabled = !snapEnabled; updateSnapToggle(); };
  BL.photoPanMode = function() { return photoPanMode; };
  BL.setPhotoPanMode = function(v) { photoPanMode = v; };

  function updateSnapToggle() {
    var btn = document.getElementById('snapToggle');
    if (btn) btn.setAttribute('aria-pressed', snapEnabled);
  }

  // ============ Get mm scale factor ============
  function getMm() {
    var pg = document.querySelector('#editorPage .pg');
    if (!pg) return 2.4;
    var cs = getComputedStyle(pg);
    var mmStr = cs.getPropertyValue('--mm') || '2.4px';
    return parseFloat(mmStr) || 2.4;
  }
  BL.getMm = getMm;

  // ============ Layer bounds in mm ============
  function getLayerBounds(layer) {
    return {
      left: layer.x,
      top: layer.y,
      right: layer.x + layer.w,
      bottom: layer.y + layer.h,
      cx: layer.x + layer.w / 2,
      cy: layer.y + layer.h / 2
    };
  }

  // ============ Snap guides container ============
  function getSnapContainer() {
    var pg = document.querySelector('#editorPage .pg');
    if (!pg) return null;
    var container = pg.querySelector('.snap-guides');
    if (!container) {
      container = document.createElement('div');
      container.className = 'snap-guides';
      pg.appendChild(container);
    }
    return container;
  }

  function clearSnapGuides() {
    var container = getSnapContainer();
    if (container) container.innerHTML = '';
  }

  function drawSnapGuide(type, pos) {
    var container = getSnapContainer();
    if (!container) return;
    var mm = getMm();
    var guide = document.createElement('div');
    guide.className = 'snap-guide snap-' + type;
    if (type === 'v') {
      guide.style.left = (pos * mm) + 'px';
    } else {
      guide.style.top = (pos * mm) + 'px';
    }
    container.appendChild(guide);
  }

  // ============ Calculate snap targets ============
  function getSnapTargets(excludeId) {
    var page = BL.S.pages[BL.cur];
    var dims = BL.pageDims();
    var safe = BL.S.safe || 8;
    
    var vSnaps = [
      safe,                    // left margin
      dims[0] - safe,          // right margin
      dims[0] / 2              // center
    ];
    var hSnaps = [
      safe,                    // top margin
      dims[1] - safe,          // bottom margin
      dims[1] / 2              // center
    ];
    
    // Add other layers' edges and centers
    for (var i = 0; i < page.layers.length; i++) {
      var layer = page.layers[i];
      if (layer.id === excludeId) continue;
      var b = getLayerBounds(layer);
      vSnaps.push(b.left, b.right, b.cx);
      hSnaps.push(b.top, b.bottom, b.cy);
    }
    
    return { v: vSnaps, h: hSnaps };
  }

  function findSnap(value, targets) {
    for (var i = 0; i < targets.length; i++) {
      if (Math.abs(value - targets[i]) <= SNAP_THRESHOLD) {
        return targets[i];
      }
    }
    return null;
  }

  // ============ Apply snapping ============
  function applySnap(layer, originalBounds) {
    if (!snapEnabled) return { snappedX: false, snappedY: false };
    
    var targets = getSnapTargets(layer.id);
    var b = getLayerBounds(layer);
    var snappedX = false, snappedY = false;
    
    clearSnapGuides();
    
    // Try snapping left edge, right edge, or center X
    var leftSnap = findSnap(b.left, targets.v);
    var rightSnap = findSnap(b.right, targets.v);
    var cxSnap = findSnap(b.cx, targets.v);
    
    if (leftSnap !== null) {
      layer.x = leftSnap;
      snappedX = true;
      drawSnapGuide('v', leftSnap);
    } else if (rightSnap !== null) {
      layer.x = rightSnap - layer.w;
      snappedX = true;
      drawSnapGuide('v', rightSnap);
    } else if (cxSnap !== null) {
      layer.x = cxSnap - layer.w / 2;
      snappedX = true;
      drawSnapGuide('v', cxSnap);
    }
    
    // Try snapping top edge, bottom edge, or center Y
    var topSnap = findSnap(b.top, targets.h);
    var bottomSnap = findSnap(b.bottom, targets.h);
    var cySnap = findSnap(b.cy, targets.h);
    
    if (topSnap !== null) {
      layer.y = topSnap;
      snappedY = true;
      drawSnapGuide('h', topSnap);
    } else if (bottomSnap !== null) {
      layer.y = bottomSnap - layer.h;
      snappedY = true;
      drawSnapGuide('h', bottomSnap);
    } else if (cySnap !== null) {
      layer.y = cySnap - layer.h / 2;
      snappedY = true;
      drawSnapGuide('h', cySnap);
    }
    
    return { snappedX: snappedX, snappedY: snappedY };
  }

  // ============ Render handles for selected layer ============
  function renderHandles() {
    var pg = document.querySelector('#editorPage .pg');
    if (!pg) return;
    
    // Remove existing handles
    var old = pg.querySelectorAll('.layer-handles');
    for (var i = 0; i < old.length; i++) old[i].remove();
    
    if (!BL.sel) return;
    
    var layer = BL.findLayer(BL.sel);
    if (!layer) return;
    
    var mm = getMm();
    var handles = document.createElement('div');
    handles.className = 'layer-handles';
    handles.dataset.layerId = layer.id;
    
    // Position handles container
    handles.style.left = (layer.x * mm) + 'px';
    handles.style.top = (layer.y * mm) + 'px';
    handles.style.width = (layer.w * mm) + 'px';
    handles.style.height = (layer.h * mm) + 'px';
    if (layer.rot !== 0) {
      handles.style.transform = 'rotate(' + layer.rot + 'deg)';
    }
    
    // 8 resize handles: corners + edges
    var positions = [
      { cls: 'nw', cursor: 'nwse-resize' },
      { cls: 'n', cursor: 'ns-resize' },
      { cls: 'ne', cursor: 'nesw-resize' },
      { cls: 'e', cursor: 'ew-resize' },
      { cls: 'se', cursor: 'nwse-resize' },
      { cls: 's', cursor: 'ns-resize' },
      { cls: 'sw', cursor: 'nesw-resize' },
      { cls: 'w', cursor: 'ew-resize' }
    ];
    
    for (var j = 0; j < positions.length; j++) {
      var h = document.createElement('div');
      h.className = 'handle resize-handle ' + positions[j].cls;
      h.dataset.handle = positions[j].cls;
      h.style.cursor = positions[j].cursor;
      handles.appendChild(h);
    }
    
    // Rotate handle above top edge
    var rotHandle = document.createElement('div');
    rotHandle.className = 'handle rotate-handle';
    rotHandle.dataset.handle = 'rotate';
    rotHandle.style.cursor = 'grab';
    handles.appendChild(rotHandle);
    
    // Rotate handle connector line
    var rotLine = document.createElement('div');
    rotLine.className = 'rotate-line';
    handles.appendChild(rotLine);
    
    pg.appendChild(handles);
  }

  BL.renderHandles = renderHandles;

  // ============ Update handles position during drag ============
  function updateHandlesPosition(layer) {
    var handles = document.querySelector('#editorPage .layer-handles');
    if (!handles) return;
    
    var mm = getMm();
    handles.style.left = (layer.x * mm) + 'px';
    handles.style.top = (layer.y * mm) + 'px';
    handles.style.width = (layer.w * mm) + 'px';
    handles.style.height = (layer.h * mm) + 'px';
    if (layer.rot !== 0) {
      handles.style.transform = 'rotate(' + layer.rot + 'deg)';
    } else {
      handles.style.transform = '';
    }
  }

  // ============ Update layer element position (cheap update during drag) ============
  function updateLayerPosition(layer) {
    var layerEl = document.querySelector('#editorPage .layer[data-id="' + layer.id + '"]');
    if (!layerEl) return;
    
    var mm = getMm();
    layerEl.style.left = (layer.x * mm) + 'px';
    layerEl.style.top = (layer.y * mm) + 'px';
    layerEl.style.width = (layer.w * mm) + 'px';
    layerEl.style.height = (layer.h * mm) + 'px';
    
    if (layer.rot !== 0) {
      layerEl.style.transform = 'rotate(' + layer.rot + 'deg)';
    } else {
      layerEl.style.transform = '';
    }
    
    updateHandlesPosition(layer);
  }

  // ============ Photo pan helpers ============
  function clampPhotoPan(layer, px, py) {
    // For cover fit, clamp so image never leaves frame empty
    // px/py are 0-100 percentages of the available pan range
    return {
      px: Math.max(0, Math.min(100, px)),
      py: Math.max(0, Math.min(100, py))
    };
  }

  function updatePhotoPan(layer) {
    var layerEl = document.querySelector('#editorPage .layer[data-id="' + layer.id + '"]');
    if (!layerEl) return;
    var img = layerEl.querySelector('img');
    if (img) {
      img.style.objectPosition = layer.px + '% ' + layer.py + '%';
    }
  }

  // ============ Start gesture ============
  function startGesture(type, layer, e) {
    var mm = getMm();
    
    gesture = {
      type: type,
      layerId: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      mm: mm,
      original: BL.clone(layer),
      undoPushed: false
    };
    
    // For resize, store which handle
    if (type === 'resize') {
      gesture.handle = e.target.dataset.handle;
      gesture.aspectRatio = layer.w / layer.h;
    }
    
    // For rotate, compute center in screen coords
    if (type === 'rotate') {
      var handles = document.querySelector('#editorPage .layer-handles');
      if (handles) {
        var rect = handles.getBoundingClientRect();
        gesture.centerX = rect.left + rect.width / 2;
        gesture.centerY = rect.top + rect.height / 2;
        gesture.startAngle = Math.atan2(e.clientY - gesture.centerY, e.clientX - gesture.centerX);
        gesture.startRot = layer.rot;
      }
    }
    
    // For photo pan
    if (type === 'pan') {
      gesture.startPx = layer.px;
      gesture.startPy = layer.py;
    }
    
    // Push undo snapshot
    BL.pushUndo();
    gesture.undoPushed = true;
    
    // Set pointer capture if available
    if (e.target.setPointerCapture) {
      try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    }
    
    document.body.style.cursor = getCursorForGesture(type, gesture.handle);
  }

  function getCursorForGesture(type, handle) {
    if (type === 'move') return 'move';
    if (type === 'rotate') return 'grabbing';
    if (type === 'pan') return 'grabbing';
    if (type === 'resize') {
      var cursors = {
        nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize',
        n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize'
      };
      return cursors[handle] || 'move';
    }
    return 'default';
  }

  // ============ Move gesture ============
  function doMove(e) {
    var layer = BL.findLayer(gesture.layerId);
    if (!layer) return;
    
    var dx = (e.clientX - gesture.startX) / gesture.mm;
    var dy = (e.clientY - gesture.startY) / gesture.mm;
    
    layer.x = gesture.original.x + dx;
    layer.y = gesture.original.y + dy;
    
    applySnap(layer, gesture.original);
    updateLayerPosition(layer);
    updateInspectorFields(layer);
  }

  // ============ Resize gesture ============
  function doResize(e, shiftKey) {
    var layer = BL.findLayer(gesture.layerId);
    if (!layer) return;
    
    var dx = (e.clientX - gesture.startX) / gesture.mm;
    var dy = (e.clientY - gesture.startY) / gesture.mm;
    var h = gesture.handle;
    var o = gesture.original;
    
    var newX = o.x, newY = o.y, newW = o.w, newH = o.h;
    
    // Determine which edges move
    var moveLeft = h.indexOf('w') >= 0;
    var moveRight = h.indexOf('e') >= 0;
    var moveTop = h.indexOf('n') >= 0;
    var moveBottom = h.indexOf('s') >= 0;
    
    if (moveRight) {
      newW = Math.max(MIN_SIZE, o.w + dx);
    }
    if (moveLeft) {
      var maxDx = o.w - MIN_SIZE;
      var clampedDx = Math.min(dx, maxDx);
      newX = o.x + clampedDx;
      newW = o.w - clampedDx;
    }
    if (moveBottom) {
      newH = Math.max(MIN_SIZE, o.h + dy);
    }
    if (moveTop) {
      var maxDy = o.h - MIN_SIZE;
      var clampedDy = Math.min(dy, maxDy);
      newY = o.y + clampedDy;
      newH = o.h - clampedDy;
    }
    
    // Shift = keep aspect ratio (corners only)
    if (shiftKey && (h === 'nw' || h === 'ne' || h === 'sw' || h === 'se')) {
      var ar = gesture.aspectRatio;
      if (Math.abs(dx) > Math.abs(dy)) {
        newH = newW / ar;
        if (moveTop) {
          newY = o.y + o.h - newH;
        }
      } else {
        newW = newH * ar;
        if (moveLeft) {
          newX = o.x + o.w - newW;
        }
      }
    }
    
    layer.x = newX;
    layer.y = newY;
    layer.w = Math.max(MIN_SIZE, newW);
    layer.h = Math.max(MIN_SIZE, newH);
    
    // Snap edges during resize
    if (snapEnabled) {
      var targets = getSnapTargets(layer.id);
      clearSnapGuides();
      
      if (moveRight) {
        var rightSnap = findSnap(layer.x + layer.w, targets.v);
        if (rightSnap !== null) {
          layer.w = rightSnap - layer.x;
          drawSnapGuide('v', rightSnap);
        }
      }
      if (moveLeft) {
        var leftSnap = findSnap(layer.x, targets.v);
        if (leftSnap !== null) {
          var oldRight = layer.x + layer.w;
          layer.x = leftSnap;
          layer.w = oldRight - leftSnap;
          drawSnapGuide('v', leftSnap);
        }
      }
      if (moveBottom) {
        var bottomSnap = findSnap(layer.y + layer.h, targets.h);
        if (bottomSnap !== null) {
          layer.h = bottomSnap - layer.y;
          drawSnapGuide('h', bottomSnap);
        }
      }
      if (moveTop) {
        var topSnap = findSnap(layer.y, targets.h);
        if (topSnap !== null) {
          var oldBottom = layer.y + layer.h;
          layer.y = topSnap;
          layer.h = oldBottom - topSnap;
          drawSnapGuide('h', topSnap);
        }
      }
    }
    
    updateLayerPosition(layer);
    updateInspectorFields(layer);
  }

  // ============ Rotate gesture ============
  function doRotate(e, shiftKey) {
    var layer = BL.findLayer(gesture.layerId);
    if (!layer) return;
    
    var angle = Math.atan2(e.clientY - gesture.centerY, e.clientX - gesture.centerX);
    var deltaAngle = (angle - gesture.startAngle) * (180 / Math.PI);
    var newRot = gesture.startRot + deltaAngle;
    
    // Normalize to -180 to 180
    while (newRot > 180) newRot -= 360;
    while (newRot < -180) newRot += 360;
    
    // Shift = snap to 15° increments
    if (shiftKey) {
      newRot = Math.round(newRot / 15) * 15;
    }
    
    layer.rot = Math.round(newRot * 10) / 10;  // Round to 1 decimal
    
    updateLayerPosition(layer);
    updateInspectorFields(layer);
  }

  // ============ Photo pan gesture ============
  function doPan(e) {
    var layer = BL.findLayer(gesture.layerId);
    if (!layer || layer.kind !== 'photo' || !layer.src || layer.fit !== 'cover') return;
    
    // px/py are percentages; we need to compute how much to shift based on image overflow
    // For simplicity, map pointer movement to percentage change
    // Approximate: larger movements = larger pan
    var dx = (e.clientX - gesture.startX);
    var dy = (e.clientY - gesture.startY);
    
    // Scale factor: move ~100px = ~50% pan shift
    var scale = 0.5;
    var newPx = gesture.startPx - dx * scale;
    var newPy = gesture.startPy - dy * scale;
    
    var clamped = clampPhotoPan(layer, newPx, newPy);
    layer.px = clamped.px;
    layer.py = clamped.py;
    
    updatePhotoPan(layer);
    updateInspectorFields(layer);
  }

  // ============ Update inspector fields live ============
  function updateInspectorFields(layer) {
    var inputs = document.querySelectorAll('#inspector input[data-prop]');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var prop = input.dataset.prop;
      if (layer[prop] !== undefined) {
        if (prop === 'rot') {
          input.value = layer[prop];
        } else if (typeof layer[prop] === 'number') {
          input.value = layer[prop].toFixed(1);
        }
      }
    }
  }

  // ============ End gesture ============
  function endGesture(cancelled) {
    if (!gesture) return;
    
    var layer = BL.findLayer(gesture.layerId);
    
    if (cancelled && layer) {
      // Restore original geometry
      layer.x = gesture.original.x;
      layer.y = gesture.original.y;
      layer.w = gesture.original.w;
      layer.h = gesture.original.h;
      layer.rot = gesture.original.rot;
      if (gesture.type === 'pan') {
        layer.px = gesture.original.px;
        layer.py = gesture.original.py;
      }
      // Pop the undo we pushed
      if (gesture.undoPushed) {
        BL.undo();
      }
    } else if (layer) {
      // Check if anything changed
      var o = gesture.original;
      var changed = layer.x !== o.x || layer.y !== o.y || 
                    layer.w !== o.w || layer.h !== o.h || 
                    layer.rot !== o.rot;
      if (gesture.type === 'pan') {
        changed = layer.px !== o.px || layer.py !== o.py;
      }
      
      if (!changed && gesture.undoPushed) {
        // Nothing changed, pop the undo
        BL.undo();
      }
    }
    
    clearSnapGuides();
    document.body.style.cursor = '';
    gesture = null;
    
    // Full re-render and save
    BL.renderEditor();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  // ============ Cancel gesture on Escape ============
  function cancelGesture() {
    if (gesture) {
      endGesture(true);
    }
  }

  BL.cancelGesture = cancelGesture;

  // ============ Pointer event handlers ============
  function onPointerDown(e) {
    // Ignore right-click
    if (e.button !== 0) return;
    
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    
    // Check for rotate handle
    if (target.dataset.handle === 'rotate') {
      var layerId = target.closest('.layer-handles').dataset.layerId;
      var layer = BL.findLayer(layerId);
      if (layer) {
        e.preventDefault();
        startGesture('rotate', layer, e);
        return;
      }
    }
    
    // Check for resize handle
    if (target.classList.contains('resize-handle')) {
      var layerId2 = target.closest('.layer-handles').dataset.layerId;
      var layer2 = BL.findLayer(layerId2);
      if (layer2) {
        e.preventDefault();
        startGesture('resize', layer2, e);
        return;
      }
    }
    
    // Check for layer body
    var layerEl = target.closest('.layer');
    if (layerEl) {
      var layer3 = BL.findLayer(layerEl.dataset.id);
      if (layer3) {
        // Select the layer
        BL.selectLayer(layer3.id);
        renderHandles();
        
        // Check for photo pan mode (Alt key or inspector toggle)
        var isPan = (e.altKey || photoPanMode) && 
                    layer3.kind === 'photo' && 
                    layer3.src && 
                    layer3.fit === 'cover';
        
        // Don't start gesture if clicking placeholder or text editing
        if (target.closest('.ph') || target.closest('.tx')) {
          return;
        }
        
        e.preventDefault();
        
        if (isPan) {
          startGesture('pan', layer3, e);
        } else {
          startGesture('move', layer3, e);
        }
        return;
      }
    }
    
    // Click on empty page area = deselect
    var pg = target.closest('.pg');
    if (pg && !layerEl) {
      BL.deselect();
      renderHandles();
    }
  }

  function onPointerMove(e) {
    if (!gesture) return;
    
    e.preventDefault();
    
    switch (gesture.type) {
      case 'move':
        doMove(e);
        break;
      case 'resize':
        doResize(e, e.shiftKey);
        break;
      case 'rotate':
        doRotate(e, e.shiftKey);
        break;
      case 'pan':
        doPan(e);
        break;
    }
  }

  function onPointerUp(e) {
    if (!gesture) return;
    endGesture(false);
  }

  function onPointerCancel(e) {
    if (!gesture) return;
    endGesture(true);
  }

  // ============ Touch gesture state ============
  var touchState = null;

  function getTouchCenter(touches) {
    var x = 0, y = 0;
    for (var i = 0; i < touches.length; i++) {
      x += touches[i].clientX;
      y += touches[i].clientY;
    }
    return { x: x / touches.length, y: y / touches.length };
  }

  function getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    var dx = touches[1].clientX - touches[0].clientX;
    var dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchAngle(touches) {
    if (touches.length < 2) return 0;
    return Math.atan2(
      touches[1].clientY - touches[0].clientY,
      touches[1].clientX - touches[0].clientX
    );
  }

  function onTouchStart(e) {
    var touches = e.touches;
    
    // Two-finger gesture on selected layer = pinch/rotate
    if (touches.length === 2 && BL.sel) {
      var layer = BL.findLayer(BL.sel);
      if (layer) {
        e.preventDefault();
        
        BL.pushUndo();
        
        touchState = {
          type: 'pinch-rotate',
          layerId: layer.id,
          original: BL.clone(layer),
          startDist: getTouchDistance(touches),
          startAngle: getTouchAngle(touches),
          startW: layer.w,
          startH: layer.h,
          startRot: layer.rot,
          center: getTouchCenter(touches)
        };
      }
    }
  }

  function onTouchMove(e) {
    if (!touchState) return;
    
    var touches = e.touches;
    if (touches.length < 2) return;
    
    e.preventDefault();
    
    var layer = BL.findLayer(touchState.layerId);
    if (!layer) return;
    
    if (touchState.type === 'pinch-rotate') {
      var dist = getTouchDistance(touches);
      var angle = getTouchAngle(touches);
      
      // Scale
      var scale = dist / touchState.startDist;
      layer.w = Math.max(MIN_SIZE, touchState.startW * scale);
      layer.h = Math.max(MIN_SIZE, touchState.startH * scale);
      
      // Rotate
      var deltaAngle = (angle - touchState.startAngle) * (180 / Math.PI);
      layer.rot = touchState.startRot + deltaAngle;
      while (layer.rot > 180) layer.rot -= 360;
      while (layer.rot < -180) layer.rot += 360;
      
      updateLayerPosition(layer);
      updateInspectorFields(layer);
    }
  }

  function onTouchEnd(e) {
    if (!touchState) return;
    
    var layer = BL.findLayer(touchState.layerId);
    if (layer) {
      var o = touchState.original;
      var changed = layer.w !== o.w || layer.h !== o.h || layer.rot !== o.rot;
      if (!changed) {
        BL.undo();
      }
    }
    
    touchState = null;
    
    BL.renderEditor();
    BL.renderInspector();
    BL.renderStrip();
    BL.save();
  }

  // ============ Keyboard handler for Escape during gesture ============
  function onKeyDown(e) {
    if (e.key === 'Escape' && gesture) {
      e.preventDefault();
      cancelGesture();
    }
  }

  // ============ Setup gesture handlers ============
  function setupGestures() {
    var editorPage = document.getElementById('editorPage');
    if (!editorPage) return;
    
    // Prevent default touch scrolling on the editor
    editorPage.style.touchAction = 'none';
    
    // Pointer events
    editorPage.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    
    // Touch events for two-finger gestures
    editorPage.addEventListener('touchstart', onTouchStart, { passive: false });
    editorPage.addEventListener('touchmove', onTouchMove, { passive: false });
    editorPage.addEventListener('touchend', onTouchEnd);
    
    // Escape key
    document.addEventListener('keydown', onKeyDown);
    
    // Add snap toggle button event
    var snapToggle = document.getElementById('snapToggle');
    if (snapToggle) {
      snapToggle.addEventListener('click', function() {
        BL.toggleSnap();
      });
    }
  }

  BL.setupGestures = setupGestures;

})();
