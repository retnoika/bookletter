/**
 * Bookletter — DOM rendering of a page
 * Shared by editor, thumbnails, and (later) print sheets.
 */
(function() {
  'use strict';
  var BL = window.BL;

  // ============ Helpers ============
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  BL.el = el;

  // System font stacks (no web fonts)
  var FONTS = {
    sans: 'system-ui, -apple-system, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Mono", monospace'
  };
  BL.FONTS = FONTS;

  // ============ Render a layer ============
  function renderLayer(layer, opts) {
    opts = opts || {};
    // Tolerate both 'edit' and 'editable' keys — a mismatch here silently
    // produces an empty canvas with no placeholder/selection, hard to debug.
    var isEdit = opts.edit || opts.editable;
    var mm = opts.mm || 1;

    var wrap = el('div', 'layer');
    wrap.dataset.id = layer.id;
    wrap.dataset.kind = layer.kind;

    // Position and size in mm via CSS calc
    wrap.style.left = 'calc(var(--mm) * ' + layer.x + ')';
    wrap.style.top = 'calc(var(--mm) * ' + layer.y + ')';
    wrap.style.width = 'calc(var(--mm) * ' + layer.w + ')';
    wrap.style.height = 'calc(var(--mm) * ' + layer.h + ')';

    if (layer.rot !== 0) {
      wrap.style.transform = 'rotate(' + layer.rot + 'deg)';
    }
    if (layer.opacity < 1) {
      wrap.style.opacity = layer.opacity;
    }

    if (layer.kind === 'photo') {
      if (layer.src) {
        var img = el('img');
        img.src = layer.src;
        img.alt = '';
        img.draggable = false;
        img.style.objectFit = layer.fit === 'contain' ? 'contain' : 'cover';
        img.style.objectPosition = layer.px + '% ' + layer.py + '%';
        wrap.appendChild(img);
      } else if (isEdit) {
        var btn = el('button', 'ph');
        btn.type = 'button';
        btn.textContent = '+ Add image';
        wrap.appendChild(btn);
      }
    } else if (layer.kind === 'text') {
      var tx = el('div', 'tx');
      tx.style.fontSize = 'calc(var(--mm) * ' + layer.size + ')';
      tx.style.fontFamily = FONTS[layer.font] || FONTS.sans;
      tx.style.textAlign = layer.align;
      tx.style.fontWeight = layer.bold ? '700' : '400';
      tx.style.lineHeight = String(layer.line);
      tx.style.color = layer.color;

      if (isEdit) {
        tx.contentEditable = 'plaintext-only';
        if (tx.contentEditable !== 'plaintext-only') {
          tx.contentEditable = 'true';
        }
        tx.dataset.ph = 'Type here';
        tx.textContent = layer.text;
      } else {
        tx.textContent = layer.text;
      }
      wrap.appendChild(tx);
    } else {
      // Unknown layer kind - skip rendering
      return null;
    }

    // Selection indicator for editor
    if (isEdit && opts.sel === layer.id) {
      wrap.classList.add('sel');
    }

    return wrap;
  }

  // ============ Render a page ============
  function renderPage(pageIdx, opts) {
    opts = opts || {};
    // Tolerate both 'edit' and 'editable' keys (see renderLayer comment)
    var isEdit = opts.edit || opts.editable;
    var page = BL.S.pages[pageIdx];
    if (!page) return el('div', 'pg');

    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var safe = BL.S.safe || 8;

    var pg = el('div', 'pg' + (isEdit ? ' edit' : ''));
    pg.style.background = page.bg;

    // Auto text color for dark backgrounds
    var textColor = BL.lum(page.bg) < 0.45 ? '#f1f6f2' : '#17261f';
    pg.style.color = textColor;

    // Render layers in z-order (array order = z-order, last is topmost)
    for (var i = 0; i < page.layers.length; i++) {
      var layer = page.layers[i];
      var layerEl = renderLayer(layer, opts);
      if (layerEl) pg.appendChild(layerEl);
    }

    // Safe-area guide (two sides only based on imposition)
    if (isEdit && BL.S.guide && BL.pageSafeBands) {
      var bands = BL.pageSafeBands(pageIdx, BL.S.pages.length, BL.S.orient, BL.S.sheet, BL.S.safe);
      // Draw lines only on unsafe sides with non-zero bands
      if (bands.top > 0) {
        var lineTop = el('div', 'guide guide-top');
        lineTop.style.setProperty('--band', bands.top);
        pg.appendChild(lineTop);
      }
      if (bands.right > 0) {
        var lineRight = el('div', 'guide guide-right');
        lineRight.style.setProperty('--band', bands.right);
        pg.appendChild(lineRight);
      }
      if (bands.bottom > 0) {
        var lineBottom = el('div', 'guide guide-bottom');
        lineBottom.style.setProperty('--band', bands.bottom);
        pg.appendChild(lineBottom);
      }
      if (bands.left > 0) {
        var lineLeft = el('div', 'guide guide-left');
        lineLeft.style.setProperty('--band', bands.left);
        pg.appendChild(lineLeft);
      }
    }

    // Page number (only for interior pages 2-7)
    if (opts.nums && pageIdx > 0 && pageIdx < 7) {
      var pn = el('div', 'pn');
      pn.textContent = pageIdx + 1;
      pg.appendChild(pn);
    }

    return pg;
  }

  BL.renderPage = renderPage;
  BL.renderLayer = renderLayer;

})();
