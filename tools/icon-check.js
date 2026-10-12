#!/usr/bin/env node
/**
 * icon-check.js - Verify all BL.icon() calls resolve to existing icons
 * 
 * Scans index.html and js/*.js for BL.icon('name') calls, reads the ICONS
 * object from js/05-icons.js, and reports any icons that are referenced
 * but not defined.
 * 
 * Exit codes:
 *   0 = all icons resolve
 *   1 = one or more icons missing
 * 
 * Usage: node tools/icon-check.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Get files to scan
function getFilesToScan() {
  const files = ['index.html'];
  const jsDir = path.join(ROOT, 'js');
  if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
    for (const f of jsFiles) {
      files.push('js/' + f);
    }
  }
  return files;
}

// Regex to match BL.icon('name') or BL.icon("name")
const ICON_USAGE_REGEX = /BL\.icon\s*\(\s*['"]([^'"]+)['"]/g;

// Read the ICONS object from 05-icons.js
function getDefinedIcons() {
  const iconsFile = path.join(ROOT, 'js/05-icons.js');
  const content = fs.readFileSync(iconsFile, 'utf8');
  
  // Match all icon keys in the ICONS object
  const iconKeys = [];
  const keyRegex = /'([^']+)':\s*'<path/g;
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    iconKeys.push(match[1]);
  }
  
  return new Set(iconKeys);
}

// Get icon files in assets/icons/
function getIconFiles() {
  const iconsDir = path.join(ROOT, 'assets/icons');
  const files = fs.readdirSync(iconsDir);
  return new Set(files.filter(f => f.endsWith('.svg')).map(f => f.replace('.svg', '')));
}

// Scan files for icon usage
function getUsedIcons() {
  const used = new Map(); // icon name -> [file locations]
  
  for (const relPath of getFilesToScan()) {
    const filePath = path.join(ROOT, relPath);
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf8');
    let match;
    ICON_USAGE_REGEX.lastIndex = 0;
    while ((match = ICON_USAGE_REGEX.exec(content)) !== null) {
      const iconName = match[1];
      if (!used.has(iconName)) {
        used.set(iconName, []);
      }
      used.get(iconName).push(relPath);
    }
  }
  
  return used;
}

function main() {
  console.log('=== Bookletter Icon Check ===\n');
  
  const definedIcons = getDefinedIcons();
  const iconFiles = getIconFiles();
  const usedIcons = getUsedIcons();
  
  console.log(`Defined in js/05-icons.js: ${definedIcons.size} icons`);
  console.log(`Files in assets/icons/: ${iconFiles.size} SVGs`);
  console.log(`Icons used via BL.icon(): ${usedIcons.size} unique names\n`);
  
  // Check for missing icons
  const missing = [];
  for (const [iconName, files] of usedIcons) {
    if (!definedIcons.has(iconName)) {
      missing.push({ name: iconName, files });
    }
  }
  
  if (missing.length === 0) {
    console.log('✓ All icons resolve correctly\n');
    
    // Also list which icons are defined but never used (informational)
    const unused = [];
    for (const icon of definedIcons) {
      if (!usedIcons.has(icon)) {
        unused.push(icon);
      }
    }
    if (unused.length > 0) {
      console.log(`Info: ${unused.length} defined icons not used via BL.icon():`);
      console.log(`  ${unused.join(', ')}`);
      console.log('  (These may be used via inline SVG or reserved for future use)\n');
    }
    
    console.log('PASS: All BL.icon() calls have matching definitions\n');
    process.exit(0);
  } else {
    console.log(`✗ ${missing.length} missing icon(s):\n`);
    for (const { name, files } of missing) {
      console.log(`  "${name}" — used in: ${files.join(', ')}`);
    }
    console.log('\nFAIL: Add missing icons to js/05-icons.js and assets/icons/\n');
    process.exit(1);
  }
}

main();
