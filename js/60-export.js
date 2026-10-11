/**
 * Bookletter — 300 DPI PNG export and print-safety checks
 * Export sheets as PNG by drawing (not DOM rasterisation).
 * Safety checks for margin crossings, low-res photos, thin strokes.
 */
(function() {
  'use strict';
  var BL = window.BL;

  // ============ Constants ============
  var DPI = 300;
  var PX_PER_MM = DPI / 25.4;  // 11.811023622...

  // ============ Compute export dimensions ============
  function exportDims() {
    var sheet = BL.sheetDims();
    var sw = sheet[0], sh = sheet[1];
    // Round to nearest integer pixel
    return {
      width: Math.round(sw * PX_PER_MM),
      height: Math.round(sh * PX_PER_MM)
    };
  }

  // ============ Load image and return Promise ============
  function loadImage(src) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = function() { reject(new Error('Failed to load image')); };
      img.src = src;
    });
  }

  // ============ Preload all images ============
  function collectImageSrcs() {
    var srcs = [];
    for (var p = 0; p < BL.S.pages.length; p++) {
      var page = BL.S.pages[p];
      for (var i = 0; i < page.layers.length; i++) {
        var layer = page.layers[i];
        if (layer.kind === 'photo' && layer.src) {
          if (srcs.indexOf(layer.src) === -1) {
            srcs.push(layer.src);
          }
        }
      }
    }
    return srcs;
  }

  function preloadImages(srcs) {
    var cache = {};
    var promises = srcs.map(function(src) {
      return loadImage(src).then(function(img) {
        cache[src] = img;
      }).catch(function() {
        // Ignore failed images
      });
    });
    return Promise.all(promises).then(function() {
      return cache;
    });
  }

  // ============ Draw a sheet to canvas (synchronous) ============
  function drawSheet(ctx, side, pxPerMm, imageCache) {
    var grid = side === 1 ? BL.IMPOSITION.side1 : BL.IMPOSITION.side2;
    var dims = BL.pageDims();
    var sheet = BL.sheetDims();
    var pw = dims[0], ph = dims[1];
    var sw = sheet[0], sh = sheet[1];

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sw * pxPerMm, sh * pxPerMm);

    // Cell offset
    var ox = (sw - 2 * pw) / 2;
    var oy = (sh - 2 * ph) / 2;

    // Draw each cell
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        var pageNum = grid[r][c];
        var pageIdx = pageNum - 1;
        var rotated = r === BL.IMPOSITION.rotatedRow;

        var cellX = ox + c * pw;
        var cellY = oy + r * ph;

        // Draw page content
        drawPage(ctx, pageIdx, cellX, cellY, pw, ph, rotated, pxPerMm, imageCache);
      }
    }

    // Draw marks if SRA3
    if (BL.S.sheet === 'SRA3') {
      drawMarks(ctx, ox, oy, pw, ph, pxPerMm);
    }
  }

  // ============ Draw a single page ============
  function drawPage(ctx, pageIdx, cellX, cellY, pw, ph, rotated, pxPerMm, imageCache) {
    var page = BL.S.pages[pageIdx];
    if (!page) return;

    ctx.save();

    // Transform for cell position and rotation
    var cx = cellX * pxPerMm;
    var cy = cellY * pxPerMm;
    var pxW = pw * pxPerMm;
    var pxH = ph * pxPerMm;

    if (rotated) {
      // Rotate 180° around cell center
      ctx.translate(cx + pxW / 2, cy + pxH / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-pxW / 2, -pxH / 2);
    } else {
      ctx.translate(cx, cy);
    }

    // Clip to page bounds
    ctx.beginPath();
    ctx.rect(0, 0, pxW, pxH);
    ctx.clip();

    // Page background
    ctx.fillStyle = page.bg || '#ffffff';
    ctx.fillRect(0, 0, pxW, pxH);

    // Draw layers in z-order
    for (var i = 0; i < page.layers.length; i++) {
      var layer = page.layers[i];
      drawLayer(ctx, layer, pxPerMm, imageCache);
    }

    // Page number (interior pages only)
    if (BL.S.nums && pageIdx > 0 && pageIdx < 7) {
      var numText = String(pageIdx + 1);
      var fontSize = 3 * pxPerMm;
      ctx.font = fontSize + 'px system-ui, sans-serif';
      ctx.fillStyle = BL.lum(page.bg) < 0.45 ? '#f1f6f2' : '#17261f';
      ctx.globalAlpha = 0.6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(numText, pxW / 2, pxH - 3.2 * pxPerMm);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ============ Draw a layer ============
  function drawLayer(ctx, layer, pxPerMm, imageCache) {
    var x = layer.x * pxPerMm;
    var y = layer.y * pxPerMm;
    var w = layer.w * pxPerMm;
    var h = layer.h * pxPerMm;

    ctx.save();

    // Apply layer rotation
    if (layer.rot !== 0) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(layer.rot * Math.PI / 180);
      ctx.translate(-w / 2, -h / 2);
      x = 0;
      y = 0;
    }

    // Apply opacity
    if (layer.opacity < 1) {
      ctx.globalAlpha = layer.opacity;
    }

    if (layer.kind === 'photo' && layer.src) {
      drawPhotoLayer(ctx, layer, x, y, w, h, imageCache);
    } else if (layer.kind === 'text') {
      drawTextLayer(ctx, layer, x, y, w, h, pxPerMm);
    } else if (layer.kind === 'shape') {
      drawShapeLayer(ctx, layer, x, y, w, h, pxPerMm);
    }

    ctx.restore();
  }

  // ============ Draw photo layer ============
  function drawPhotoLayer(ctx, layer, x, y, w, h, imageCache) {
    var img = imageCache ? imageCache[layer.src] : null;
    if (!img) return;

    var imgW = img.naturalWidth;
    var imgH = img.naturalHeight;

    var fit = layer.fit || 'cover';
    var px = layer.px !== undefined ? layer.px : 50;
    var py = layer.py !== undefined ? layer.py : 50;

    // Calculate draw dimensions based on fit
    var drawW, drawH, drawX, drawY;

    if (fit === 'contain') {
      // Fit entire image within bounds
      var scale = Math.min(w / imgW, h / imgH);
      drawW = imgW * scale;
      drawH = imgH * scale;
      drawX = x + (w - drawW) * (px / 100);
      drawY = y + (h - drawH) * (py / 100);
    } else {
      // Cover: fill bounds, crop excess
      var scale = Math.max(w / imgW, h / imgH);
      drawW = imgW * scale;
      drawH = imgH * scale;
      // px/py: 0 = left/top edge aligned, 100 = right/bottom aligned
      drawX = x - (drawW - w) * (px / 100);
      drawY = y - (drawH - h) * (py / 100);
    }

    // Clip to layer bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // ============ Draw text layer ============
  function drawTextLayer(ctx, layer, x, y, w, h, pxPerMm) {
    if (!layer.text) return;

    var fontSize = layer.size * pxPerMm;
    var fontWeight = layer.bold ? '700' : '400';
    var fontFamily = BL.FONTS[layer.font] || BL.FONTS.sans;
    ctx.font = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
    ctx.fillStyle = layer.color || '#17261f';
    ctx.textBaseline = 'top';

    var lineHeight = (layer.line || 1.3) * fontSize;
    var align = layer.align || 'left';

    // Word wrap
    var words = layer.text.split(/\s+/);
    var lines = [];
    var currentLine = '';

    for (var i = 0; i < words.length; i++) {
      var testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
      var metrics = ctx.measureText(testLine);
      if (metrics.width > w && currentLine) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Draw lines
    for (var j = 0; j < lines.length; j++) {
      var lineY = y + j * lineHeight;
      if (lineY + fontSize > y + h) break;  // Don't draw beyond bounds

      var lineX = x;
      if (align === 'center') {
        lineX = x + (w - ctx.measureText(lines[j]).width) / 2;
      } else if (align === 'right') {
        lineX = x + w - ctx.measureText(lines[j]).width;
      }

      ctx.fillText(lines[j], lineX, lineY);
    }
  }

  // ============ Draw shape layer ============
  function drawShapeLayer(ctx, layer, x, y, w, h, pxPerMm) {
    var shapePath = BL.SHAPES[layer.shape];
    if (!shapePath) return;

    // Parse SVG path and scale to layer size
    var pathMatch = shapePath.match(/d="([^"]+)"/);
    var circleMatch = shapePath.match(/<circle[^>]+>/);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w / 100, h / 100);

    var path = new Path2D();

    if (pathMatch) {
      path = new Path2D(pathMatch[1]);
    } else if (circleMatch) {
      // Handle circle shape
      var cxMatch = circleMatch[0].match(/cx="(\d+)"/);
      var cyMatch = circleMatch[0].match(/cy="(\d+)"/);
      var rMatch = circleMatch[0].match(/r="(\d+)"/);
      if (cxMatch && cyMatch && rMatch) {
        var cx = parseFloat(cxMatch[1]);
        var cy = parseFloat(cyMatch[1]);
        var r = parseFloat(rMatch[1]);
        path.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }

    ctx.fillStyle = layer.color || '#17261f';
    ctx.fill(path);

    if (layer.stroke && layer.strokeWidth >= 0.25) {
      ctx.strokeStyle = layer.stroke;
      // Stroke width in viewBox units (100x100 scaled to w x h)
      var avgMm = (layer.w + layer.h) / 2;
      var strokeVb = (layer.strokeWidth / avgMm) * 100;
      ctx.lineWidth = strokeVb;
      ctx.stroke(path);
    }

    ctx.restore();
  }

  // ============ Draw crop/fold marks ============
  function drawMarks(ctx, ox, oy, pw, ph, pxPerMm) {
    var bleedMm = BL.canBleed() ? BL.getBleed() : 0;
    var trimX = ox - bleedMm;
    var trimY = oy - bleedMm;
    var blockW = 2 * pw + 2 * bleedMm;
    var blockH = 2 * ph + 2 * bleedMm;
    var x1 = trimX + blockW;
    var y1 = trimY + blockH;

    var t = 0.25;  // mark thickness mm
    var g = 2;     // gap mm
    var len = Math.max(3, Math.min(ox - bleedMm, oy - bleedMm) - g - 1.5);

    ctx.fillStyle = '#000000';

    // Corner crop marks (8 lines)
    var corners = [
      [trimX, trimY, -1, -1],
      [x1, trimY, 1, -1],
      [trimX, y1, -1, 1],
      [x1, y1, 1, 1]
    ];

    corners.forEach(function(corner) {
      var cx = corner[0], cy = corner[1], dx = corner[2], dy = corner[3];
      // Horizontal
      var hx = dx < 0 ? cx - g - len : cx + g;
      ctx.fillRect(hx * pxPerMm, (cy - t / 2) * pxPerMm, len * pxPerMm, t * pxPerMm);
      // Vertical
      var vy = dy < 0 ? cy - g - len : cy + g;
      ctx.fillRect((cx - t / 2) * pxPerMm, vy * pxPerMm, t * pxPerMm, len * pxPerMm);
    });

    // Fold marks (4 lines)
    var mx = trimX + blockW / 2;
    var my = trimY + blockH / 2;

    // Top
    ctx.fillRect((mx - t / 2) * pxPerMm, (trimY - g - len) * pxPerMm, t * pxPerMm, len * pxPerMm);
    // Bottom
    ctx.fillRect((mx - t / 2) * pxPerMm, (y1 + g) * pxPerMm, t * pxPerMm, len * pxPerMm);
    // Left
    ctx.fillRect((trimX - g - len) * pxPerMm, (my - t / 2) * pxPerMm, len * pxPerMm, t * pxPerMm);
    // Right
    ctx.fillRect((x1 + g) * pxPerMm, (my - t / 2) * pxPerMm, len * pxPerMm, t * pxPerMm);
  }

  // ============ Export single sheet PNG ============
  function exportSheet(side) {
    var dims = exportDims();
    var title = sanitizeFilename(BL.S.title || 'booklet');
    var filename = title + '-sheet' + side + '.png';

    BL.toast('Exporting ' + filename + '...');

    // Collect and preload all images first
    var srcs = collectImageSrcs();
    preloadImages(srcs).then(function(imageCache) {
      var canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      var ctx = canvas.getContext('2d');

      drawSheet(ctx, side, PX_PER_MM, imageCache);

      canvas.toBlob(function(blob) {
        downloadBlob(blob, filename);
        BL.toast('Saved ' + filename);
      }, 'image/png');
    });
  }

  function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 50);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after delay to ensure download completes
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  // ============ Safety checks ============
  function runSafetyChecks() {
    var findings = [];
    var safe = BL.S.safe || 8;
    var dims = BL.pageDims();
    var pw = dims[0], ph = dims[1];

    for (var p = 0; p < BL.S.pages.length; p++) {
      var page = BL.S.pages[p];
      for (var i = 0; i < page.layers.length; i++) {
        var layer = page.layers[i];

        // Check margin crossing
        var marginCrossings = checkMarginCrossing(layer, safe, pw, ph);
        if (marginCrossings.length > 0) {
          findings.push({
            type: 'margin',
            page: p + 1,
            kind: layer.kind,
            crossings: marginCrossings
          });
        }

        // Check photo resolution
        if (layer.kind === 'photo' && layer.src) {
          var dpiCheck = checkPhotoDPI(layer);
          if (dpiCheck) {
            findings.push({
              type: 'resolution',
              page: p + 1,
              dpi: dpiCheck.dpi,
              width: layer.w,
              height: layer.h
            });
          }
        }

        // Check thin stroke
        if (layer.kind === 'shape' && layer.stroke && layer.strokeWidth > 0 && layer.strokeWidth < 0.25) {
          findings.push({
            type: 'stroke',
            page: p + 1,
            strokeWidth: layer.strokeWidth
          });
        }
      }
    }

    return findings;
  }

  function checkMarginCrossing(layer, safe, pw, ph) {
    var crossings = [];

    // Account for rotation - use bounding box
    var bounds = getLayerBounds(layer);

    if (bounds.left < safe) {
      crossings.push({ edge: 'left', amount: safe - bounds.left });
    }
    if (bounds.top < safe) {
      crossings.push({ edge: 'top', amount: safe - bounds.top });
    }
    if (bounds.right > pw - safe) {
      crossings.push({ edge: 'right', amount: bounds.right - (pw - safe) });
    }
    if (bounds.bottom > ph - safe) {
      crossings.push({ edge: 'bottom', amount: bounds.bottom - (ph - safe) });
    }

    return crossings;
  }

  function getLayerBounds(layer) {
    // Simple bounds for non-rotated or approximate for rotated
    if (layer.rot === 0) {
      return {
        left: layer.x,
        top: layer.y,
        right: layer.x + layer.w,
        bottom: layer.y + layer.h
      };
    }

    // For rotated layers, compute the axis-aligned bounding box
    var cx = layer.x + layer.w / 2;
    var cy = layer.y + layer.h / 2;
    var rad = layer.rot * Math.PI / 180;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);

    // Four corners relative to center
    var hw = layer.w / 2;
    var hh = layer.h / 2;
    var corners = [
      [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]
    ];

    var xs = [], ys = [];
    corners.forEach(function(c) {
      xs.push(cx + c[0] * cos - c[1] * sin);
      ys.push(cy + c[0] * sin + c[1] * cos);
    });

    return {
      left: Math.min.apply(null, xs),
      top: Math.min.apply(null, ys),
      right: Math.max.apply(null, xs),
      bottom: Math.max.apply(null, ys)
    };
  }

  // Cache for image dimensions
  var imageDimCache = {};

  function checkPhotoDPI(layer) {
    // Need to check the image's natural dimensions
    var src = layer.src;
    if (!imageDimCache[src]) {
      // Trigger async load
      var img = new Image();
      img.onload = function() {
        imageDimCache[src] = { w: img.naturalWidth, h: img.naturalHeight };
        renderSafetyPanel();  // Re-render when loaded
      };
      img.src = src;
      return null;  // Not yet loaded
    }

    var cached = imageDimCache[src];
    // dpi = naturalPx / (wMm / 25.4)
    var dpiW = cached.w / (layer.w / 25.4);
    var dpiH = cached.h / (layer.h / 25.4);
    var effectiveDpi = Math.min(dpiW, dpiH);

    if (effectiveDpi < 200) {
      return { dpi: Math.round(effectiveDpi) };
    }
    return null;
  }

  // ============ Render safety panel ============
  function renderSafetyPanel() {
    var panel = document.getElementById('safetyPanel');
    if (!panel) return;

    var findings = runSafetyChecks();

    if (findings.length === 0) {
      panel.classList.remove('has-issues');
      panel.classList.add('no-issues');
      panel.innerHTML = '<span class="check-ok">✓ No print-safety issues found</span>';
      return;
    }

    panel.classList.remove('no-issues');
    panel.classList.add('has-issues');

    var html = '<ul class="check-list">';
    findings.forEach(function(f) {
      if (f.type === 'margin') {
        var crossDesc = f.crossings.map(function(c) {
          return c.edge + ' by ' + c.amount.toFixed(1) + 'mm';
        }).join(', ');
        html += '<li class="check-warn">Page ' + f.page + ' ' + f.kind + ' crosses safe margin: ' + crossDesc + '</li>';
      } else if (f.type === 'resolution') {
        html += '<li class="check-warn">Page ' + f.page + ' photo at ' + f.dpi + ' dpi (placed ' + f.width.toFixed(0) + '×' + f.height.toFixed(0) + 'mm)</li>';
      } else if (f.type === 'stroke') {
        html += '<li class="check-warn">Page ' + f.page + ' shape stroke ' + f.strokeWidth.toFixed(2) + 'mm (min 0.25mm)</li>';
      }
    });
    html += '</ul>';

    panel.innerHTML = html;
  }

  // ============ Setup ============
  function setupExport() {
    // Export segment buttons
    var segExport = document.getElementById('segExport');
    if (segExport) {
      segExport.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn || !btn.dataset.side) return;
        var side = parseInt(btn.dataset.side, 10);
        exportSheet(side);
      });
    }

    // Initial safety check render
    renderSafetyPanel();
  }

  // ============ Expose ============
  BL.exportSheet = exportSheet;
  BL.exportDims = exportDims;
  BL.drawSheet = drawSheet;
  BL.preloadImages = preloadImages;
  BL.collectImageSrcs = collectImageSrcs;
  BL.runSafetyChecks = runSafetyChecks;
  BL.renderSafetyPanel = renderSafetyPanel;
  BL.setupExport = setupExport;
  BL.PX_PER_MM = PX_PER_MM;

})();
