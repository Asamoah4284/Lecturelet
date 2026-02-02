/**
 * One-off script: remove whitish anti-aliasing halo from logo-1.png.
 * Replaces near-white/light-gray edge pixels with black for a clean icon.
 *
 * Run from frontend: npm run fix-logo   OR   node scripts/fix-logo-edges.js
 */

const path = require('path');
const fs = require('fs');
const PNG = require('pngjs').PNG;

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo-1.png');
const OUT_PATH = path.join(__dirname, '..', 'assets', 'logo-1.png');

// Pixels with R,G,B all >= this are treated as "whitish" and replaced with black
const WHITISH_THRESHOLD = 200;

const buffer = fs.readFileSync(LOGO_PATH);
const png = PNG.sync.read(buffer);
const data = png.data;
let replaced = 0;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  // Whitish halo: high R, G, B (not orange: orange has low B)
  if (r >= WHITISH_THRESHOLD && g >= WHITISH_THRESHOLD && b >= WHITISH_THRESHOLD) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
    replaced++;
  }
}

const outBuffer = PNG.sync.write(png);
fs.writeFileSync(OUT_PATH, outBuffer);

console.log(`Fixed logo: replaced ${replaced} whitish pixels with black. Output: ${OUT_PATH}`);
