// Generates a placeholder Inscape icon source PNG (1024×1024): brand-teal field
// with a light "lens / eye" ring + center — a 心相 (inner reflection) motif.
// Run `node scripts/gen-icon-source.mjs` then `pnpm tauri icon
// src-tauri/icons/icon-source.png` to regenerate the full icon set. Replace
// with a designed asset later via the same `tauri icon <source.png>` command.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZE = 1024;
const BG = [47, 95, 87]; // --inscape-brand-primary teal
const LIGHT = [222, 234, 230];

const pixels = Buffer.alloc(SIZE * SIZE * 4);
const cx = SIZE / 2;
const cy = SIZE / 2;
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const i = (y * SIZE + x) * 4;
    const d = Math.hypot(x - cx, y - cy);
    let color = BG;
    if (d > 300 && d < 384) color = LIGHT; // lens ring
    else if (d < 84) color = LIGHT; // center
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = 255;
  }
}

// Raw scanlines, each prefixed with filter byte 0.
const stride = SIZE * 4 + 1;
const raw = Buffer.alloc(SIZE * stride);
for (let y = 0; y < SIZE; y += 1) {
  raw[y * stride] = 0;
  pixels.copy(raw, y * stride + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])), 0);
  return Buffer.concat([len, typeBuf, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync('src-tauri/icons/icon-source.png', png);
console.log(`wrote src-tauri/icons/icon-source.png (${png.length} bytes)`);
