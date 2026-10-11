/**
 * Bookletter — layout templates
 * Templates define layout in relative coordinates (0-1), applied to page mm.
 */
(function() {
  'use strict';
  var BL = window.BL;
  // ============ Layout templates ============
  // Each slot: { kind, rect: [x%, y%, w%, h%], opts }
  // rect values 0-1, converted to mm when applied

  var TEMPLATES = {
    'img-full': {
      name: 'Full image',
      bleed: true,
      slots: [{ kind: 'photo', rect: [0, 0, 1, 1] }]
    },
    'img-cap': {
      name: 'Image + caption',
      slots: [
        { kind: 'photo', rect: [0, 0, 1, 0.8] },
        { kind: 'text', rect: [0, 0.84, 1, 0.16], opts: { size: 4.2 } }
      ]
    },
    'text': {
      name: 'Text only',
      slots: [{ kind: 'text', rect: [0, 0, 1, 1], opts: { size: 4.4 } }]
    },
    'title': {
      name: 'Title',
      slots: [{ kind: 'text', rect: [0, 0.3, 1, 0.4], opts: { size: 14, align: 'center', bold: true } }]
    },
    'two': {
      name: 'Two panels',
      slots: [
        { kind: 'photo', rect: [0, 0, 1, 0.485] },
        { kind: 'photo', rect: [0, 0.515, 1, 0.485] }
      ]
    },
    'three': {
      name: 'Three panels',
      slots: [
        { kind: 'photo', rect: [0, 0, 1, 0.485] },
        { kind: 'photo', rect: [0, 0.515, 0.485, 0.485] },
        { kind: 'photo', rect: [0.515, 0.515, 0.485, 0.485] }
      ]
    },
    'four': {
      name: 'Four panels',
      slots: [
        { kind: 'photo', rect: [0, 0, 0.485, 0.485] },
        { kind: 'photo', rect: [0.515, 0, 0.485, 0.485] },
        { kind: 'photo', rect: [0, 0.515, 0.485, 0.485] },
        { kind: 'photo', rect: [0.515, 0.515, 0.485, 0.485] }
      ]
    },
    'strip': {
      name: 'Three strips',
      slots: [
        { kind: 'photo', rect: [0, 0, 1, 0.31] },
        { kind: 'photo', rect: [0, 0.345, 1, 0.31] },
        { kind: 'photo', rect: [0, 0.69, 1, 0.31] }
      ]
    }
  };

  var TEMPLATE_ORDER = ['img-full', 'img-cap', 'text', 'title', 'two', 'three', 'four', 'strip'];

  BL.TEMPLATES = TEMPLATES;
  BL.TEMPLATE_ORDER = TEMPLATE_ORDER;

  // ============ Apply template ============
  // Replaces empty scaffolding (photo without src, text without content)
  // but keeps layers the user has already filled in or created.
  function isEmptyScaffolding(layer) {
    if (layer.kind === 'photo') {
      return !layer.src;
    } else if (layer.kind === 'text') {
      return !layer.text || layer.text.trim() === '';
    }
    // Shape layers are user artwork, never scaffolding
    return false;
  }

  function applyTemplate(templateId, pageIdx) {
    var tpl = TEMPLATES[templateId];
    if (!tpl) return [];

    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];
    var safe = BL.S.safe || 8;
    var innerW = pw - 2 * safe;
    var innerH = ph - 2 * safe;
    var baseX = tpl.bleed ? 0 : safe;
    var baseY = tpl.bleed ? 0 : safe;
    var areaW = tpl.bleed ? pw : innerW;
    var areaH = tpl.bleed ? ph : innerH;

    var page = BL.S.pages[pageIdx];

    // Remove empty scaffolding layers, keep user content
    var kept = [];
    for (var k = 0; k < page.layers.length; k++) {
      if (!isEmptyScaffolding(page.layers[k])) {
        kept.push(page.layers[k]);
      }
    }
    page.layers = kept;

    // Add new template slots
    var addedIds = [];
    for (var i = 0; i < tpl.slots.length; i++) {
      var slot = tpl.slots[i];
      var r = slot.rect;
      var x = baseX + r[0] * areaW;
      var y = baseY + r[1] * areaH;
      var w = r[2] * areaW;
      var h = r[3] * areaH;
      var layer;

      if (slot.kind === 'photo') {
        layer = BL.newPhotoLayer(x, y, w, h);
      } else if (slot.kind === 'text') {
        var opts = slot.opts || {};
        layer = BL.newTextLayer(x, y, w, h, opts);
      } else {
        // Skip unknown slot kinds (e.g., shape)
        continue;
      }

      page.layers.push(layer);
      addedIds.push(layer.id);
    }

    return addedIds;
  }

  BL.applyTemplate = applyTemplate;

  // ============ Template icon SVG ============
  function templateIcon(templateId) {
    var tpl = TEMPLATES[templateId];
    if (!tpl) return '';

    var html = '<span class="ico"><span class="in' + (tpl.bleed ? ' b' : '') + '">';
    for (var i = 0; i < tpl.slots.length; i++) {
      var slot = tpl.slots[i];
      var r = slot.rect;
      var cls = slot.kind === 'text' ? 'text' : '';
      html += '<i class="' + cls + '" style="left:' + (r[0] * 100) + '%;top:' + (r[1] * 100) + '%;width:' + (r[2] * 100) + '%;height:' + (r[3] * 100) + '%"></i>';
    }
    html += '</span></span>';
    return html;
  }

  BL.templateIcon = templateIcon;

})();
