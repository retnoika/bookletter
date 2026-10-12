/**
 * Bookletter — Tabler Icons helper
 * Inline SVG icons with stroke="currentColor" for color inheritance.
 * Icons are 16x16, stroke-width 1.75, round caps/joins.
 * Licensed under MIT (see assets/icons/LICENSE).
 */
(function() {
  'use strict';
  var BL = window.BL = window.BL || {};

  // Icon paths (extracted from Tabler Icons, adjusted for 16x16)
  var ICONS = {
    'eye': '<path d="M6.67 8a1.33 1.33 0 1 0 2.66 0a1.33 1.33 0 0 0 -2.66 0"/><path d="M14 8c-1.6 2.67 -3.6 4 -6 4c-2.4 0 -4.4 -1.33 -6 -4c1.6 -2.67 3.6 -4 6 -4c2.4 0 4.4 1.33 6 4"/>',
    'adjustments-horizontal': '<path d="M9.33 5.33h5.34"/><path d="M1.33 5.33h2.67"/><path d="M12 10.67h2.67"/><path d="M1.33 10.67h5.34"/><circle cx="6" cy="5.33" r="1.33"/><circle cx="10" cy="10.67" r="1.33"/>',
    'download': '<path d="M2.67 10.67v1.33a2 2 0 0 0 2 2h6.66a2 2 0 0 0 2 -2v-1.33"/><path d="M8 2.67v8"/><path d="M5.33 8l2.67 2.67l2.67 -2.67"/>',
    'chevron-down': '<path d="M4 6l4 4l4 -4"/>',
    'chevron-up': '<path d="M4 10l4 -4l4 4"/>',
    'chevrons-up': '<path d="M4.67 7.33l3.33 -3.33l3.33 3.33"/><path d="M4.67 11.33l3.33 -3.33l3.33 3.33"/>',
    'chevrons-down': '<path d="M4.67 4.67l3.33 3.33l3.33 -3.33"/><path d="M4.67 8.67l3.33 3.33l3.33 -3.33"/>',
    'arrow-up': '<path d="M8 3.33l0 9.33"/><path d="M12 7.33l-4 -4"/><path d="M4 7.33l4 -4"/>',
    'arrow-down': '<path d="M8 3.33l0 9.33"/><path d="M12 8.67l-4 4"/><path d="M4 8.67l4 4"/>',
    'photo': '<path d="M2 4.67a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v6.66a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><circle cx="5.33" cy="5.33" r="0.67"/><path d="M2.67 10l2 -2a.95 .95 0 0 1 1.27 0l2.73 2.67"/><path d="M8.67 9.33l0.66 -0.66a.95 .95 0 0 1 1.27 0l2.07 2"/>',
    'typography': '<path d="M2.67 5.33v-1.33a1.33 1.33 0 0 1 1.33 -1.33h8a1.33 1.33 0 0 1 1.33 1.33v1.33"/><path d="M5.33 13.33h5.34"/><path d="M8 2.67v10.66"/>',
    'eraser': '<path d="M12.47 5.86l-4.33 -4.33a1.33 1.33 0 0 0 -1.89 0l-4.72 4.72a1.33 1.33 0 0 0 0 1.89l3.17 3.17"/><path d="M7.33 13.33h7.34"/><path d="M5.97 8.63l4.7 -4.7"/>',
    'border-style': '<path d="M2.67 6v-2a1.33 1.33 0 0 1 1.33 -1.33h2"/><path d="M10 2.67h2a1.33 1.33 0 0 1 1.33 1.33v2"/><path d="M13.33 10v2a1.33 1.33 0 0 1 -1.33 1.33h-2"/><path d="M6 13.33h-2a1.33 1.33 0 0 1 -1.33 -1.33v-2"/><path d="M8 2.67v0.01"/><path d="M8 13.33v0.01"/>',
    'numbers': '<path d="M2.67 4.67l2.66 -1.34v9.34"/><path d="M8 5.33a1.33 1.33 0 1 1 2.67 0c0 .67 -.27 1.07 -1.34 2l-2 2h4"/>',
    'file': '<path d="M9.33 2.67h-4a1.33 1.33 0 0 0 -1.33 1.33v8a1.33 1.33 0 0 0 1.33 1.33h5.34a1.33 1.33 0 0 0 1.33 -1.33v-6z"/><path d="M9.33 2.67v3.33h3.34"/>',
    'book-2': '<path d="M12 2.67h-6a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h6"/><path d="M12 2.67v10.66"/><path d="M8 6h1.33"/><path d="M8 8.67h1.33"/>',
    'zoom-out': '<circle cx="7.33" cy="7.33" r="4.66"/><path d="M14 14l-2.87 -2.87"/><path d="M5.33 7.33h4"/>',
    'zoom-in': '<circle cx="7.33" cy="7.33" r="4.66"/><path d="M14 14l-2.87 -2.87"/><path d="M7.33 5.33v4"/><path d="M5.33 7.33h4"/>',
    'arrows-maximize': '<path d="M10.67 2.67h2.66v2.66"/><path d="M13.33 2.67l-4 4"/><path d="M5.33 13.33h-2.66v-2.66"/><path d="M2.67 13.33l4 -4"/>',
    'magnet': '<path d="M2.67 8a5.33 5.33 0 0 0 10.66 0"/><path d="M2.67 4v4"/><path d="M6 4v4"/><path d="M10 4v4"/><path d="M13.33 4v4"/><path d="M2.67 2.67h3.33v1.33h-3.33z"/><path d="M10 2.67h3.33v1.33h-3.33z"/>'
  };

  /**
   * Returns an inline SVG icon string.
   * @param {string} name - Icon name
   * @param {Object} [opts] - Options
   * @param {string} [opts.class] - Additional CSS class
   * @param {string} [opts.label] - Accessible label (omit for decorative icons)
   * @param {number} [opts.size] - Icon size in pixels (default 16)
   * @returns {string} SVG markup
   */
  BL.icon = function(name, opts) {
    opts = opts || {};
    var paths = ICONS[name];
    if (!paths) {
      console.error('BL.icon: MISSING ICON "' + name + '" — add it to js/05-icons.js and assets/icons/');
      return '<!-- MISSING: ' + name + ' -->';
    }

    var size = opts.size || 16;
    var cls = 'icon' + (opts.class ? ' ' + opts.class : '');
    var aria = opts.label
      ? 'role="img" aria-label="' + opts.label + '"'
      : 'aria-hidden="true" focusable="false"';

    return '<svg class="' + cls + '" xmlns="http://www.w3.org/2000/svg" ' +
      'width="' + size + '" height="' + size + '" viewBox="0 0 16 16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.75" ' +
      'stroke-linecap="round" stroke-linejoin="round" ' + aria + '>' +
      paths + '</svg>';
  };

  // Export icon names for reference
  BL.ICON_NAMES = Object.keys(ICONS);

})();
