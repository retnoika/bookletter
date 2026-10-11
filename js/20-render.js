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
      } else if (opts.edit) {
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

      if (opts.edit) {
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
    } else if (layer.kind === 'shape') {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.width = '100%';
      svg.style.height = '100%';

      var shapePath = BL.SHAPES[layer.shape] || BL.SHAPES.heart;
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = shapePath;
      var pathEl = g.firstChild;
      if (pathEl) {
        pathEl.setAttribute('fill', layer.color);
        if (layer.stroke && layer.strokeWidth >= 0.25) {
          pathEl.setAttribute('stroke', layer.stroke);
          // strokeWidth in mm, need to scale to viewBox units
          // viewBox 100x100, average of w/h in mm, scaled
          var avgMm = (layer.w + layer.h) / 2;
          var strokeVb = (layer.strokeWidth / avgMm) * 100;
          pathEl.setAttribute('stroke-width', strokeVb);
        }
        svg.appendChild(pathEl);
      }
      wrap.appendChild(svg);
    }

    // Selection indicator for editor
    if (opts.edit && opts.sel === layer.id) {
      wrap.classList.add('sel');
    }

    return wrap;
  }

  // ============ Render a page ============
  function renderPage(pageIdx, opts) {
    opts = opts || {};
    var page = BL.S.pages[pageIdx];
    if (!page) return el('div', 'pg');

    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var safe = BL.S.safe || 8;

    var pg = el('div', 'pg' + (opts.edit ? ' edit' : ''));
    pg.style.background = page.bg;

    // Auto text color for dark backgrounds
    var textColor = BL.lum(page.bg) < 0.45 ? '#f1f6f2' : '#17261f';
    pg.style.color = textColor;

    // Render layers in z-order (array order = z-order, last is topmost)
    for (var i = 0; i < page.layers.length; i++) {
      var layer = page.layers[i];
      var layerEl = renderLayer(layer, opts);
      pg.appendChild(layerEl);
    }

    // Margin guide
    if (opts.edit && BL.S.guide) {
      var guide = el('div', 'guide');
      pg.appendChild(guide);
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
