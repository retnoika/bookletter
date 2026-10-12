/**
 * Bookletter - in-app color picker
 * Replaces native <input type="color"> which doesn't work on iOS Safari.
 * Reusable for page background and text colour.
 */
(function() {
  'use strict';
  var BL = window.BL = window.BL || {};

  // ============ Palette ============
  // Design tokens from css/app.css + paper presets
  var PALETTE = [
    // Candy Pink row (5)
    { hex: '#DE505B', name: 'Candy Pink 750' },
    { hex: '#E4717A', name: 'Candy Pink 500' },
    { hex: '#EA9299', name: 'Candy Pink 250' },
    { hex: '#F4C3C7', name: 'Candy Pink 100' },
    { hex: '#FDF5F5', name: 'Candy Pink 50' },
    // Cornflower Blue row (5)
    { hex: '#505BDE', name: 'Cornflower Blue 750' },
    { hex: '#717AE4', name: 'Cornflower Blue 500' },
    { hex: '#9299EA', name: 'Cornflower Blue 250' },
    { hex: '#C3C7F4', name: 'Cornflower Blue 100' },
    { hex: '#F5F5FD', name: 'Cornflower Blue 50' },
    // Neutrals row (5)
    { hex: '#161719', name: 'Near Black' },
    { hex: '#565A62', name: 'Dark Grey' },
    { hex: '#B0B3B9', name: 'Mid Grey' },
    { hex: '#D9DBDE', name: 'Light Grey' },
    { hex: '#FFFFFF', name: 'White' },
    // Paper presets row (5)
    { hex: '#FFFFFF', name: 'White Paper' },
    { hex: '#FFFEF0', name: 'Cream' },
    { hex: '#FFF9C4', name: 'Yellow' },
    { hex: '#E3F2FD', name: 'Blue' },
    { hex: '#263238', name: 'Near Black Paper' }
  ];

  // ============ State ============
  var pickerEl = null;       // The picker DOM element
  var currentCallback = null; // Function to call with selected color
  var originalColor = '';    // Color before opening (for cancel)
  var livePreviewCb = null;  // Optional live preview callback

  // ============ Color conversion ============
  function hexToHsl(hex) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex(h, s, l) {
    h = h / 360; s = s / 100; l = l / 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    var toHex = function(x) {
      var hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function isValidHex(str) {
    str = str.replace('#', '');
    return /^[0-9A-Fa-f]{6}$/.test(str);
  }

  function normalizeHex(str) {
    str = str.replace('#', '').toUpperCase();
    if (str.length === 3) {
      str = str[0] + str[0] + str[1] + str[1] + str[2] + str[2];
    }
    return '#' + str;
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
    
    // Swatch grid - 5 columns, 4 rows
    html += '<div class="cp-swatches">';
    for (var i = 0; i < PALETTE.length; i++) {
      var c = PALETTE[i];
      var isDark = hexToHsl(c.hex).l < 50;
      html += '<button type="button" class="cp-swatch' + (isDark ? ' dark' : '') + '" ';
      html += 'data-hex="' + c.hex + '" title="' + c.name + '" ';
      html += 'style="background:' + c.hex + '"></button>';
    }
    html += '</div>';

    // HSL sliders
    html += '<div class="cp-sliders">';
    html += '<div class="cp-slider-row">';
    html += '<label class="micro-label">Hue</label>';
    html += '<input type="range" id="cpHue" min="0" max="360" value="0" class="cp-range cp-hue">';
    html += '</div>';
    html += '<div class="cp-slider-row">';
    html += '<label class="micro-label">Saturation</label>';
    html += '<input type="range" id="cpSat" min="0" max="100" value="100" class="cp-range cp-sat">';
    html += '</div>';
    html += '<div class="cp-slider-row">';
    html += '<label class="micro-label">Lightness</label>';
    html += '<input type="range" id="cpLit" min="0" max="100" value="50" class="cp-range cp-lit">';
    html += '</div>';
    html += '</div>';

    // Preview and hex input
    html += '<div class="cp-preview-row">';
    html += '<div class="cp-preview" id="cpPreview"></div>';
    html += '<input type="text" id="cpHex" class="cp-hex" maxlength="7" placeholder="#FFFFFF">';
    html += '</div>';

    // Actions
    html += '<div class="cp-actions">';
    html += '<button type="button" class="btn cp-cancel">Cancel</button>';
    html += '<button type="button" class="btn btn-primary cp-apply">Apply</button>';
    html += '</div>';

    el.innerHTML = html;
    document.body.appendChild(el);
    pickerEl = el;

    // Event listeners
    setupPickerEvents();

    return el;
  }

  function setupPickerEvents() {
    var el = pickerEl;

    // Swatch clicks
    el.addEventListener('click', function(e) {
      var swatch = e.target.closest('.cp-swatch');
      if (swatch) {
        var hex = swatch.dataset.hex;
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
        var hex = document.getElementById('cpHex').value;
        if (isValidHex(hex)) {
          applyColor(normalizeHex(hex));
        }
        closePicker();
        return;
      }
    });

    // Slider inputs
    var hueSlider = document.getElementById('cpHue');
    var satSlider = document.getElementById('cpSat');
    var litSlider = document.getElementById('cpLit');
    var hexInput = document.getElementById('cpHex');

    function updateFromSliders() {
      var h = parseInt(hueSlider.value, 10);
      var s = parseInt(satSlider.value, 10);
      var l = parseInt(litSlider.value, 10);
      var hex = hslToHex(h, s, l);
      hexInput.value = hex.toUpperCase();
      updatePreview(hex);
      updateSliderBackgrounds(h, s, l);
      if (livePreviewCb) livePreviewCb(hex);
    }

    hueSlider.addEventListener('input', updateFromSliders);
    satSlider.addEventListener('input', updateFromSliders);
    litSlider.addEventListener('input', updateFromSliders);

    // Hex input
    hexInput.addEventListener('input', function() {
      var val = hexInput.value;
      if (isValidHex(val)) {
        var hex = normalizeHex(val);
        var hsl = hexToHsl(hex);
        hueSlider.value = hsl.h;
        satSlider.value = hsl.s;
        litSlider.value = hsl.l;
        updatePreview(hex);
        updateSliderBackgrounds(hsl.h, hsl.s, hsl.l);
        if (livePreviewCb) livePreviewCb(hex);
      }
    });

    hexInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var val = hexInput.value;
        if (isValidHex(val)) {
          applyColor(normalizeHex(val));
          closePicker();
        }
      } else if (e.key === 'Escape') {
        closePicker();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && pickerEl && pickerEl.classList.contains('open')) {
        closePicker();
      }
    });

    // Close on click outside
    document.addEventListener('mousedown', function(e) {
      if (pickerEl && pickerEl.classList.contains('open')) {
        if (!pickerEl.contains(e.target) && !e.target.closest('[data-open-picker]')) {
          closePicker();
        }
      }
    });
  }

  function updatePreview(hex) {
    var preview = document.getElementById('cpPreview');
    if (preview) {
      preview.style.background = hex;
      // Add checkmark visibility based on lightness
      var hsl = hexToHsl(hex);
      preview.classList.toggle('dark', hsl.l < 50);
    }
  }

  function updateSliderBackgrounds(h, s, l) {
    var satSlider = document.getElementById('cpSat');
    var litSlider = document.getElementById('cpLit');
    
    // Saturation slider: show hue at 0% and 100% saturation
    if (satSlider) {
      var sat0 = hslToHex(h, 0, l);
      var sat100 = hslToHex(h, 100, l);
      satSlider.style.setProperty('--track-bg', 'linear-gradient(to right, ' + sat0 + ', ' + sat100 + ')');
    }
    
    // Lightness slider: show hue at 0%, 50%, 100% lightness
    if (litSlider) {
      var lit0 = hslToHex(h, s, 0);
      var lit50 = hslToHex(h, s, 50);
      var lit100 = hslToHex(h, s, 100);
      litSlider.style.setProperty('--track-bg', 'linear-gradient(to right, ' + lit0 + ', ' + lit50 + ', ' + lit100 + ')');
    }
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

    // Reset position to measure
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

    // Clamp to viewport
    if (top < 8) top = 8;
    if (left + pickerW > viewW - 8) {
      left = viewW - pickerW - 8;
    }
    if (left < 8) left = 8;

    // Final clamp for small screens
    if (top + pickerH > viewH - 8) {
      top = viewH - pickerH - 8;
    }

    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  // ============ Public API ============
  function openPicker(options) {
    // options: { anchor, color, onApply, onLivePreview }
    createPicker();

    // Close any existing
    if (pickerEl.classList.contains('open')) {
      closePicker();
    }

    originalColor = options.color || '#FFFFFF';
    currentCallback = options.onApply;
    livePreviewCb = options.onLivePreview || null;

    // Set initial values
    var hsl = hexToHsl(originalColor);
    document.getElementById('cpHue').value = hsl.h;
    document.getElementById('cpSat').value = hsl.s;
    document.getElementById('cpLit').value = hsl.l;
    document.getElementById('cpHex').value = originalColor.toUpperCase();
    updatePreview(originalColor);
    updateSliderBackgrounds(hsl.h, hsl.s, hsl.l);

    // Mark active swatch if exact match
    var swatches = pickerEl.querySelectorAll('.cp-swatch');
    for (var i = 0; i < swatches.length; i++) {
      var sw = swatches[i];
      sw.classList.toggle('active', sw.dataset.hex.toUpperCase() === originalColor.toUpperCase());
    }

    // Position and show
    pickerEl.classList.add('open');
    positionPicker(options.anchor);

    // Focus hex input for keyboard users
    setTimeout(function() {
      document.getElementById('cpHex').focus();
      document.getElementById('cpHex').select();
    }, 50);
  }

  function closePicker() {
    if (pickerEl) {
      pickerEl.classList.remove('open');
    }
    currentCallback = null;
    livePreviewCb = null;
  }

  function isPickerOpen() {
    return pickerEl && pickerEl.classList.contains('open');
  }

  // Export
  BL.openColorPicker = openPicker;
  BL.closeColorPicker = closePicker;
  BL.isColorPickerOpen = isPickerOpen;

})();
