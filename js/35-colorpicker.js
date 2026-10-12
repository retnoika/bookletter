/**
 * Bookletter - in-app color picker with wheel interface
 * Hue ring + saturation/brightness square, presets, recents, hex input.
 * Works on iOS Safari, touch and keyboard accessible.
 */
(function() {
  'use strict';
  var BL = window.BL = window.BL || {};

  // ============ Palette (designer tokens + paper presets) ============
  var PALETTE = [
    // Candy Pink (5)
    { hex: '#DE505B', name: 'Candy Pink 750' },
    { hex: '#E4717A', name: 'Candy Pink 500' },
    { hex: '#EA9299', name: 'Candy Pink 250' },
    { hex: '#F4C3C7', name: 'Candy Pink 100' },
    { hex: '#FDF5F5', name: 'Candy Pink 50' },
    // Cornflower Blue (5)
    { hex: '#505BDE', name: 'Cornflower Blue 750' },
    { hex: '#717AE4', name: 'Cornflower Blue 500' },
    { hex: '#9299EA', name: 'Cornflower Blue 250' },
    { hex: '#C3C7F4', name: 'Cornflower Blue 100' },
    { hex: '#F5F5FD', name: 'Cornflower Blue 50' },
    // Neutrals (5)
    { hex: '#161719', name: 'Near Black' },
    { hex: '#565A62', name: 'Dark Grey' },
    { hex: '#B0B3B9', name: 'Mid Grey' },
    { hex: '#D9DBDE', name: 'Light Grey' },
    { hex: '#FFFFFF', name: 'White' },
    // Paper presets (6)
    { hex: '#FFFFFF', name: 'White Paper' },
    { hex: '#FFFEF0', name: 'Cream' },
    { hex: '#FFF9C4', name: 'Yellow' },
    { hex: '#E3F2FD', name: 'Blue' },
    { hex: '#F5F5F5', name: 'Light Grey Paper' },
    { hex: '#263238', name: 'Near Black Paper' }
  ];

  var RECENT_KEY = 'bookletter-recent-colors';
  var MAX_RECENT = 8;

  // ============ State ============
  var pickerEl = null;
  var currentCallback = null;
  var originalColor = '';
  var currentHue = 0;       // 0-360
  var currentSat = 100;     // 0-100
  var currentBri = 50;      // 0-100 (brightness/value in HSB)
  var isDraggingRing = false;
  var isDraggingSquare = false;
  var triggerAnchor = null;  // Element that opened the picker, for focus return

  // ============ Color conversion (HSB/HSV model) ============
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16)
    };
  }

  function rgbToHex(r, g, b) {
    var toHex = function(x) {
      var h = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function rgbToHsb(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;
    var d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), b: Math.round(v * 100) };
  }

  function hsbToRgb(h, s, b) {
    h /= 360; s /= 100; b /= 100;
    var r, g, bl;
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = b * (1 - s);
    var q = b * (1 - f * s);
    var t = b * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = b; g = t; bl = p; break;
      case 1: r = q; g = b; bl = p; break;
      case 2: r = p; g = b; bl = t; break;
      case 3: r = p; g = q; bl = b; break;
      case 4: r = t; g = p; bl = b; break;
      case 5: r = b; g = p; bl = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(bl * 255) };
  }

  function hsbToHex(h, s, b) {
    var rgb = hsbToRgb(h, s, b);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function hexToHsb(hex) {
    var rgb = hexToRgb(hex);
    return rgbToHsb(rgb.r, rgb.g, rgb.b);
  }

  function isValidHex(str) {
    str = str.replace('#', '');
    return /^[0-9A-Fa-f]{6}$/.test(str) || /^[0-9A-Fa-f]{3}$/.test(str);
  }

  function normalizeHex(str) {
    str = str.replace('#', '').toUpperCase();
    if (str.length === 3) {
      str = str[0] + str[0] + str[1] + str[1] + str[2] + str[2];
    }
    return '#' + str;
  }

  // ============ Recent colors ============
  function getRecentColors() {
    try {
      var data = localStorage.getItem(RECENT_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function addRecentColor(hex) {
    hex = hex.toUpperCase();
    var recents = getRecentColors();
    // Remove if already present
    recents = recents.filter(function(c) { return c !== hex; });
    // Add to front
    recents.unshift(hex);
    // Limit to MAX_RECENT
    if (recents.length > MAX_RECENT) recents = recents.slice(0, MAX_RECENT);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
    } catch (e) {}
  }

  // ============ Build picker DOM ============
  function createPicker() {
    if (pickerEl) return pickerEl;

    var el = document.createElement('div');
    el.id = 'colorPicker';
    el.className = 'color-picker';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Color picker');

    var html = '';
    html += '<div class="cp-header"><span class="micro-label">Choose colour</span></div>';

    // Hue ring with center preview
    html += '<div class="cp-wheel-wrap">';
    html += '<div class="cp-ring" id="cpRing" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0" aria-valuetext="0 degrees">';
    html += '<div class="cp-ring-handle" id="cpRingHandle"></div>';
    html += '<div class="cp-ring-center" id="cpRingCenter"></div>';
    html += '</div>';
    html += '</div>';

    // Saturation/Brightness square
    html += '<div class="cp-square-wrap">';
    html += '<canvas class="cp-square" id="cpSquare" width="200" height="120" tabindex="0" role="slider" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" aria-valuetext="Saturation 100%, Brightness 50%"></canvas>';
    html += '<div class="cp-square-handle" id="cpSquareHandle"></div>';
    html += '</div>';

    // Hex input and preview
    html += '<div class="cp-preview-row">';
    html += '<div class="cp-preview" id="cpPreview"></div>';
    html += '<input type="text" id="cpHex" class="cp-hex" maxlength="7" placeholder="#FFFFFF" aria-label="Hex color value">';
    html += '</div>';

    // Recent colors (rendered dynamically)
    html += '<div class="cp-recents" id="cpRecents"></div>';

    // Preset swatches
    html += '<div class="cp-section-label micro-label">Presets</div>';
    html += '<div class="cp-swatches">';
    for (var i = 0; i < PALETTE.length; i++) {
      var c = PALETTE[i];
      var hsb = hexToHsb(c.hex);
      var isDark = hsb.b < 50;
      html += '<button type="button" class="cp-swatch' + (isDark ? ' dark' : '') + '" ';
      html += 'data-hex="' + c.hex + '" title="' + c.name + '" ';
      html += 'style="background:' + c.hex + '"></button>';
    }
    html += '</div>';

    // Print note
    html += '<div class="cp-note">Screen colour is not a proof—printed results depend on printer, ink and paper.</div>';

    // Actions
    html += '<div class="cp-actions">';
    html += '<button type="button" class="btn cp-cancel">Cancel</button>';
    html += '<button type="button" class="btn btn-primary cp-apply">Apply</button>';
    html += '</div>';

    el.innerHTML = html;
    document.body.appendChild(el);
    pickerEl = el;

    setupPickerEvents();
    return el;
  }

  function renderRecents() {
    var container = document.getElementById('cpRecents');
    if (!container) return;

    var recents = getRecentColors();
    if (recents.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';
    var html = '<div class="cp-section-label micro-label">Recent</div>';
    html += '<div class="cp-recents-row">';
    for (var i = 0; i < recents.length; i++) {
      var c = recents[i];
      var hsb = hexToHsb(c);
      var isDark = hsb.b < 50;
      html += '<button type="button" class="cp-swatch cp-recent' + (isDark ? ' dark' : '') + '" ';
      html += 'data-hex="' + c + '" title="Recent: ' + c + '" ';
      html += 'style="background:' + c + '"></button>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  // ============ Ring drawing and interaction ============
  function drawRing() {
    var ring = document.getElementById('cpRing');
    if (!ring) return;
    // The ring background is CSS conic-gradient, no canvas needed
  }

  function updateRingHandle() {
    var ring = document.getElementById('cpRing');
    var handle = document.getElementById('cpRingHandle');
    if (!ring || !handle) return;

    var rect = ring.getBoundingClientRect();
    var cx = rect.width / 2;
    var cy = rect.height / 2;
    var radius = (Math.min(rect.width, rect.height) / 2) - 12; // Handle on the ring

    // Hue: 0 at top, clockwise. CSS conic-gradient starts at top.
    // Angle in radians: 0 = top, clockwise
    var angle = (currentHue - 90) * Math.PI / 180;
    var hx = cx + radius * Math.cos(angle);
    var hy = cy + radius * Math.sin(angle);

    handle.style.left = hx + 'px';
    handle.style.top = hy + 'px';

    // Update aria
    ring.setAttribute('aria-valuenow', currentHue);
    ring.setAttribute('aria-valuetext', currentHue + ' degrees');
  }

  function updateRingCenter() {
    var center = document.getElementById('cpRingCenter');
    if (!center) return;
    var hex = hsbToHex(currentHue, currentSat, currentBri);
    center.style.background = hex;
  }

  function ringPointerToHue(x, y, ring) {
    var rect = ring.getBoundingClientRect();
    var cx = rect.width / 2;
    var cy = rect.height / 2;
    var dx = x - rect.left - cx;
    var dy = y - rect.top - cy;
    // Angle from center, 0 at right, counter-clockwise
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    // Convert: 0 at top, clockwise
    var hue = (angle + 90 + 360) % 360;
    return Math.round(hue);
  }

  // ============ Square drawing and interaction ============
  function drawSquare() {
    var canvas = document.getElementById('cpSquare');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    // Draw saturation gradient (white to pure hue)
    var hueColor = hsbToHex(currentHue, 100, 100);
    var gradH = ctx.createLinearGradient(0, 0, w, 0);
    gradH.addColorStop(0, '#FFFFFF');
    gradH.addColorStop(1, hueColor);
    ctx.fillStyle = gradH;
    ctx.fillRect(0, 0, w, h);

    // Draw brightness gradient (transparent to black)
    var gradV = ctx.createLinearGradient(0, 0, 0, h);
    gradV.addColorStop(0, 'rgba(0,0,0,0)');
    gradV.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, w, h);
  }

  function updateSquareHandle() {
    var canvas = document.getElementById('cpSquare');
    var handle = document.getElementById('cpSquareHandle');
    if (!canvas || !handle) return;

    var w = canvas.width;
    var h = canvas.height;
    // Saturation: 0 at left, 100 at right
    // Brightness: 100 at top, 0 at bottom
    var x = (currentSat / 100) * w;
    var y = ((100 - currentBri) / 100) * h;

    handle.style.left = x + 'px';
    handle.style.top = y + 'px';

    // Update aria
    canvas.setAttribute('aria-valuenow', currentSat);
    canvas.setAttribute('aria-valuetext', 'Saturation ' + currentSat + '%, Brightness ' + currentBri + '%');
  }

  function squarePointerToSB(x, y, canvas) {
    var rect = canvas.getBoundingClientRect();
    var px = x - rect.left;
    var py = y - rect.top;
    var w = canvas.width;
    var h = canvas.height;
    // Scale to canvas coordinates
    var scaleX = w / rect.width;
    var scaleY = h / rect.height;
    px *= scaleX;
    py *= scaleY;
    var sat = Math.max(0, Math.min(100, Math.round((px / w) * 100)));
    var bri = Math.max(0, Math.min(100, Math.round((1 - py / h) * 100)));
    return { s: sat, b: bri };
  }

  // ============ Update all displays ============
  function updateAllDisplays() {
    var hex = hsbToHex(currentHue, currentSat, currentBri);

    // Preview
    var preview = document.getElementById('cpPreview');
    if (preview) preview.style.background = hex;

    // Hex field
    var hexInput = document.getElementById('cpHex');
    if (hexInput && document.activeElement !== hexInput) {
      hexInput.value = hex.toUpperCase();
    }

    // Ring handle and center
    updateRingHandle();
    updateRingCenter();

    // Square (redraw for new hue)
    drawSquare();
    updateSquareHandle();
  }

  function setFromHex(hex) {
    if (!isValidHex(hex)) return false;
    hex = normalizeHex(hex);
    var hsb = hexToHsb(hex);
    currentHue = hsb.h;
    currentSat = hsb.s;
    currentBri = hsb.b;
    updateAllDisplays();
    return true;
  }

  // ============ Event handlers ============
  function setupPickerEvents() {
    var el = pickerEl;
    var ring = document.getElementById('cpRing');
    var square = document.getElementById('cpSquare');
    var hexInput = document.getElementById('cpHex');

    // Ring pointer events
    function onRingPointer(e) {
      var hue = ringPointerToHue(e.clientX, e.clientY, ring);
      currentHue = hue;
      updateAllDisplays();
    }

    ring.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      hexInput.blur(); // Allow hex field to update
      try { ring.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event */ }
      isDraggingRing = true;
      onRingPointer(e);
    });

    ring.addEventListener('pointermove', function(e) {
      if (isDraggingRing) {
        onRingPointer(e);
      }
    });

    ring.addEventListener('pointerup', function(e) {
      isDraggingRing = false;
      ring.releasePointerCapture(e.pointerId);
    });

    ring.addEventListener('pointercancel', function(e) {
      isDraggingRing = false;
    });

    // Ring keyboard
    ring.addEventListener('keydown', function(e) {
      var step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        currentHue = (currentHue + step) % 360;
        updateAllDisplays();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        currentHue = (currentHue - step + 360) % 360;
        updateAllDisplays();
        e.preventDefault();
      }
    });

    // Square pointer events
    function onSquarePointer(e) {
      var sb = squarePointerToSB(e.clientX, e.clientY, square);
      currentSat = sb.s;
      currentBri = sb.b;
      updateAllDisplays();
    }

    square.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      hexInput.blur(); // Allow hex field to update
      try { square.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event */ }
      isDraggingSquare = true;
      onSquarePointer(e);
    });

    square.addEventListener('pointermove', function(e) {
      if (isDraggingSquare) {
        onSquarePointer(e);
      }
    });

    square.addEventListener('pointerup', function(e) {
      isDraggingSquare = false;
      square.releasePointerCapture(e.pointerId);
    });

    square.addEventListener('pointercancel', function(e) {
      isDraggingSquare = false;
    });

    // Square keyboard
    square.addEventListener('keydown', function(e) {
      var step = e.shiftKey ? 10 : 1;
      var changed = false;
      if (e.key === 'ArrowRight') {
        currentSat = Math.min(100, currentSat + step);
        changed = true;
      } else if (e.key === 'ArrowLeft') {
        currentSat = Math.max(0, currentSat - step);
        changed = true;
      } else if (e.key === 'ArrowUp') {
        currentBri = Math.min(100, currentBri + step);
        changed = true;
      } else if (e.key === 'ArrowDown') {
        currentBri = Math.max(0, currentBri - step);
        changed = true;
      }
      if (changed) {
        updateAllDisplays();
        e.preventDefault();
      }
    });

    // Hex input
    hexInput.addEventListener('input', function() {
      var val = hexInput.value;
      if (isValidHex(val)) {
        setFromHex(val);
      }
    });

    hexInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        if (isValidHex(hexInput.value)) {
          applyCurrentColor();
          closePicker();
        }
      } else if (e.key === 'Escape') {
        closePicker();
      }
    });

    // Swatch and preset clicks
    el.addEventListener('click', function(e) {
      var swatch = e.target.closest('.cp-swatch');
      if (swatch) {
        var hex = swatch.dataset.hex;
        addRecentColor(hex);
        applyColor(hex);
        closePicker();
        return;
      }

      var cancel = e.target.closest('.cp-cancel');
      if (cancel) {
        closePicker();
        return;
      }

      var apply = e.target.closest('.cp-apply');
      if (apply) {
        applyCurrentColor();
        closePicker();
        return;
      }
    });

    // Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isPickerOpen()) {
        closePicker();
      }
    });

    // Click outside
    document.addEventListener('mousedown', function(e) {
      if (isPickerOpen() && !pickerEl.contains(e.target) && !e.target.closest('[data-open-picker]')) {
        closePicker();
      }
    });
  }

  function applyCurrentColor() {
    var hex = hsbToHex(currentHue, currentSat, currentBri);
    addRecentColor(hex);
    applyColor(hex);
  }

  function applyColor(hex) {
    if (currentCallback) {
      currentCallback(hex);
    }
  }

  // ============ Position picker ============
  function positionPicker(anchor) {
    var el = pickerEl;
    var anchorRect = anchor.getBoundingClientRect();
    var viewW = window.innerWidth;
    var viewH = window.innerHeight;

    // Get header height to avoid overlap
    var header = document.querySelector('.header');
    var headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    var minTop = Math.max(8, headerBottom + 8);

    // Reset to measure
    el.style.left = '0';
    el.style.top = '0';
    var pickerW = el.offsetWidth;
    var pickerH = el.offsetHeight;

    // Default: below and aligned left
    var left = anchorRect.left;
    var top = anchorRect.bottom + 8;

    // Flip up if not enough room below
    if (top + pickerH > viewH - 8) {
      top = anchorRect.top - pickerH - 8;
    }

    // Clamp to viewport, respecting header
    if (top < minTop) top = minTop;
    if (left + pickerW > viewW - 8) {
      left = viewW - pickerW - 8;
    }
    if (left < 8) left = 8;

    // Final clamp to ensure picker fits
    if (top + pickerH > viewH - 8) {
      top = viewH - pickerH - 8;
      // If still overlapping header, allow scrolling
      if (top < minTop) top = minTop;
    }

    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  // ============ Public API ============
  function openPicker(options) {
    createPicker();

    if (isPickerOpen()) {
      closePicker();
    }

    originalColor = options.color || '#FFFFFF';
    currentCallback = options.onApply;

    // Set initial values from color
    setFromHex(originalColor);

    // Render recents
    renderRecents();

    // Mark active swatch
    var swatches = pickerEl.querySelectorAll('.cp-swatch');
    var upperColor = originalColor.toUpperCase();
    for (var i = 0; i < swatches.length; i++) {
      var sw = swatches[i];
      sw.classList.toggle('active', sw.dataset.hex.toUpperCase() === upperColor);
    }

    // Store anchor selector for focus return (element may be re-rendered)
    if (options.anchor) {
      var a = options.anchor;
      if (a.id) {
        triggerAnchor = '#' + a.id;
      } else if (a.dataset && a.dataset.c) {
        triggerAnchor = '#swatches button[data-c="' + a.dataset.c + '"]';
      } else {
        triggerAnchor = null;
      }
    } else {
      triggerAnchor = null;
    }
    pickerEl.classList.add('open');
    positionPicker(options.anchor);
    // No autofocus - let user tap to focus (avoids iOS keyboard popup)
  }

  function closePicker() {
    if (pickerEl) {
      pickerEl.classList.remove('open');
    }
    // Return focus to trigger element after click event stack clears
    var selector = triggerAnchor;
    if (selector) {
      setTimeout(function() {
        var el = document.querySelector(selector);
        if (el && typeof el.focus === 'function') {
          el.focus();
        }
      }, 0);
    }
    currentCallback = null;
    isDraggingRing = false;
    isDraggingSquare = false;
    triggerAnchor = null;
  }

  function isPickerOpen() {
    return pickerEl && pickerEl.classList.contains('open');
  }

  // Export
  BL.openColorPicker = openPicker;
  BL.closeColorPicker = closePicker;
  BL.isColorPickerOpen = isPickerOpen;

})();
