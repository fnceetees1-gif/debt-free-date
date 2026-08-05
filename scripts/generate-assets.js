// scripts/generate-assets.js
// Generates the app icon, splash, adaptive icon and notification icon as PNGs.
// Pure Node (zlib only) so there's no image-library dependency to install and
// the assets are reproducible — re-run `npm run assets` after changing colors.
//
// Artwork: a descending bar chart (debt shrinking) in the app's accent green
// on the app's navy. Anti-aliased via a rounded-rect signed distance field.

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const NAVY = [0x1b, 0x1f, 0x3b];
const GREEN = [0x7c, 0xe0, 0xa0];
const WHITE = [0xff, 0xff, 0xff];

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/**
 * @param {(x:number,y:number)=>number[]} shade returns [r,g,b] or [r,g,b,a]
 */
function encodePNG(width, height, hasAlpha, shade) {
  const channels = hasAlpha ? 4 : 3;
  const stride = width * channels;
  const raw = Buffer.alloc(height * (1 + stride));

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; // filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const px = shade(x, y);
      const o = rowStart + 1 + x * channels;
      raw[o] = px[0];
      raw[o + 1] = px[1];
      raw[o + 2] = px[2];
      if (hasAlpha) raw[o + 3] = px[3] === undefined ? 255 : px[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = hasAlpha ? 6 : 2; // color type: RGBA / RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing ----------------------------------------------------------------

/** Signed distance to a rounded rectangle; negative inside. */
function roundRectSDF(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - (halfW - r);
  const qy = Math.abs(py - cy) - (halfH - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Four bars of descending height, centered in a `size` box scaled by `scale`.
 * Returns coverage 0..1 at (x, y).
 */
function barsCoverage(x, y, size, scale) {
  const S = size * scale;
  const originX = (size - S) / 2;
  const originY = (size - S) / 2;

  // Geometry in a normalized 0..1 box
  const barW = 0.185;
  const gap = 0.085;
  const totalW = barW * 4 + gap * 3;
  const startX = (1 - totalW) / 2;
  const baseline = 0.86;
  const heights = [0.72, 0.55, 0.38, 0.21];
  const radius = 0.035;

  let cov = 0;
  for (let i = 0; i < 4; i++) {
    const left = startX + i * (barW + gap);
    const top = baseline - heights[i];
    const cx = originX + (left + barW / 2) * S;
    const cy = originY + (top + heights[i] / 2) * S;
    const d = roundRectSDF(
      x + 0.5,
      y + 0.5,
      cx,
      cy,
      (barW / 2) * S,
      (heights[i] / 2) * S,
      radius * S
    );
    cov = Math.max(cov, Math.min(Math.max(0.5 - d, 0), 1));
  }
  return cov;
}

function blend(bg, fg, a) {
  return [
    Math.round(bg[0] + (fg[0] - bg[0]) * a),
    Math.round(bg[1] + (fg[1] - bg[1]) * a),
    Math.round(bg[2] + (fg[2] - bg[2]) * a),
  ];
}

// --- Outputs ----------------------------------------------------------------

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

function write(name, buf) {
  const file = path.join(assetsDir, name);
  fs.writeFileSync(file, buf);
  console.log(`  ${name}  ${(buf.length / 1024).toFixed(1)} KB`);
}

console.log('Generating assets...');

// App icon: 1024x1024, NO alpha channel (App Store rejects icons with alpha).
write(
  'icon.png',
  encodePNG(1024, 1024, false, (x, y) =>
    blend(NAVY, GREEN, barsCoverage(x, y, 1024, 0.82))
  )
);

// Android adaptive icon foreground: art must sit inside the centered 66% safe
// zone, transparent elsewhere.
write(
  'adaptive-icon.png',
  encodePNG(1024, 1024, true, (x, y) => {
    const a = barsCoverage(x, y, 1024, 0.66);
    return [GREEN[0], GREEN[1], GREEN[2], Math.round(a * 255)];
  })
);

// Splash: portrait, navy field with the mark centered.
{
  const W = 1284;
  const H = 2778;
  write(
    'splash.png',
    encodePNG(W, H, false, (x, y) => {
      // Center a square art box of side W*0.5 vertically in the tall canvas.
      const box = W * 0.5;
      const ox = (W - box) / 2;
      const oy = (H - box) / 2;
      if (x < ox || x >= ox + box || y < oy || y >= oy + box) return NAVY;
      return blend(NAVY, GREEN, barsCoverage(x - ox, y - oy, box, 1.0));
    })
  );
}

// Android notification icon: white silhouette on transparent, per Material spec.
write(
  'notification-icon.png',
  encodePNG(96, 96, true, (x, y) => {
    const a = barsCoverage(x, y, 96, 0.8);
    return [WHITE[0], WHITE[1], WHITE[2], Math.round(a * 255)];
  })
);

console.log('Done.');
