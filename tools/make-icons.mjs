/**
 * Generates the app icons with no dependencies at all.
 *
 * There is no image library here — the script rasterises the artwork itself
 * (4x4 supersampled for clean edges) and writes a real PNG using only Node's
 * built-in zlib. Run it with `npm run icons` after changing the design.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/* ─────────────────────────────── PNG writer ─────────────────────────────── */

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
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** @param {Uint8Array} rgba length = w*h*4 */
function encodePng(rgba, w, h) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ──────────────────────────────── geometry ──────────────────────────────── */

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function insideRoundedRect(x, y, w, h, r) {
  const dx = Math.max(r - x, 0, x - (w - r));
  const dy = Math.max(r - y, 0, y - (h - r));
  if (dx <= 0 || dy <= 0) return x >= 0 && y >= 0 && x <= w && y <= h;
  return dx * dx + dy * dy <= r * r;
}

function starPolygon(cx, cy, outer, inner, points = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function insidePolygon(x, y, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* ──────────────────────────────── the icon ──────────────────────────────── */

const CONFETTI = [
  [0.20, 0.22, 0.055, [76, 201, 240]],
  [0.80, 0.26, 0.045, [61, 220, 151]],
  [0.16, 0.74, 0.048, [255, 143, 208]],
  [0.84, 0.72, 0.058, [255, 255, 255]],
  [0.50, 0.13, 0.035, [255, 255, 255]],
];

/**
 * @param {number} size    output size in pixels
 * @param {object} o
 * @param {boolean} o.rounded  round the corners (false for maskable/apple icons)
 * @param {number} o.inset     shrink the artwork for maskable safe zones
 */
function renderIcon(size, { rounded = true, inset = 0 } = {}) {
  const SS = 4;                       // supersampling factor
  const out = new Uint8Array(size * size * 4);
  const radius = size * 0.235;
  const starPts = starPolygon(size * 0.5, size * 0.515, size * (0.285 - inset), size * (0.128 - inset * 0.45));
  const starOutline = starPolygon(size * 0.5, size * 0.515, size * (0.325 - inset), size * (0.152 - inset * 0.45));

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          if (rounded && !insideRoundedRect(x, y, size, size, radius)) continue;

          // Backdrop: warm sunrise gradient with a soft top-left glow.
          const t = Math.min(1, (x * 0.35 + y * 0.85) / size);
          let col = mix([255, 154, 60], [230, 62, 122], t);
          const gd = Math.hypot(x - size * 0.26, y - size * 0.2) / size;
          col = mix(col, [255, 224, 160], Math.max(0, 0.34 - gd) * 1.1);

          for (const [cx, cy, cr, cc] of CONFETTI) {
            if (Math.hypot(x - size * cx, y - size * cy) <= size * cr) col = cc.slice();
          }

          if (insidePolygon(x, y, starOutline)) col = [255, 255, 255];
          if (insidePolygon(x, y, starPts)) {
            const st = (y - size * 0.2) / (size * 0.6);
            col = mix([255, 243, 176], [255, 159, 28], Math.max(0, Math.min(1, st)));
          }

          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      const cov = a / n;
      // Un-premultiply so the rounded corners stay clean against any background.
      const k = cov > 0 ? n / (a / 255) : 0;
      out[i] = Math.round((r / n) * k);
      out[i + 1] = Math.round((g / n) * k);
      out[i + 2] = Math.round((b / n) * k);
      out[i + 3] = Math.round(cov);
    }
  }
  return encodePng(out, size, size);
}

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['icon-180.png', 180, { rounded: false }],   // iOS applies its own mask
  ['icon-maskable-512.png', 512, { rounded: false, inset: 0.075 }],
];

for (const [name, size, opts] of targets) {
  const png = renderIcon(size, opts);
  writeFileSync(join(OUT, name), png);
  console.log(`wrote assets/${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)} kB)`);
}
