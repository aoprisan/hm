// Generates the PWA icon set as PNGs — no external dependencies.
// A storybook castle tower with a golden banner, drawn as pixel art and
// scaled up with nearest-neighbour so it stays crisp at every size.
//
//   node scripts/gen-icons.mjs
//
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(OUT, { recursive: true });

// ---- palette (matches the game's warm fairy-tale family) ------------------
const C = {
  ".": null, // transparent
  k: [28, 22, 16, 255], // outline
  b: [58, 36, 18, 255], // dark brown
  B: [91, 58, 26, 255], // brown frame
  n: [184, 176, 162, 255], // stone
  N: [125, 117, 106, 255], // dark stone
  x: [233, 228, 214, 255], // light stone
  y: [242, 196, 77, 255], // gold
  Y: [200, 146, 42, 255], // dark gold
  e: [255, 240, 176, 255], // pale gold
  r: [200, 65, 58, 255], // banner red
  R: [143, 43, 39, 255], // banner shadow
  u: [63, 120, 200, 255], // sky blue
  U: [40, 84, 143, 255], // deep sky
  g: [79, 138, 58, 255], // grass
  G: [60, 110, 44, 255], // dark grass
};

// 24×24 pixel design. Each char is a palette key (see C above).
// A central keep with crenellations, a door, two windows and a flag.
const ART = [
  "uuuuuuuuuuuuuuuuuuuuuuuu",
  "uuuuuuuuuuuukuuuuuuuuuuu",
  "uuuuuuuuuuukykuuuuuuuuuu",
  "uuuuuuuuuukyrrkuuuuuuuuu",
  "uuuuuuuuuukyrrrkuuuuuuuu",
  "uuuuuuuuuukyRRkuuuuuuuuu",
  "uuuuuuuuuukykuuuuuuuuuuu",
  "UUUUUUUUUkykUUUUUUUUUUUU",
  "kk.kk.kkxnxkk.kk.kk..kkk",
  "knknknknnnknknknknk.kbBk",
  "knnnnnnnnnnnnnnnnnnk.kbBk",
  "knxnxnxnxnxnxnxnxnnk.kbBk",
  "knnnnkuukuunnkuukuunkbBk",
  "knnnnkuukuunnkuukuunkbBk",
  "knxnnnnnnnnnnnnnnnxnkbBk",
  "knnnnnnnnnnnnnnnnnnnkbBk",
  "knnnnnnkyyyyknnnnnnnkbBk",
  "knxnnnnyebbeynnnnnxnkbBk",
  "knnnnnnybbbbynnnnnnnkbBk",
  "knnnnnnybbbbynnnnnnnkbBk",
  "kNNNNNNkbbbbkNNNNNNNkbBk",
  "GgGgGgGgGgGgGgGgGgGgGgGg",
  "gGgGgGgGgGgGgGgGgGgGgGgG",
  "GgGgGgGgGgGgGgGgGgGgGgGg",
];

const SRC = ART.length; // 24

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

// Render the ART grid into an RGBA buffer of `size`×`size`, scaling by nearest
// neighbour. `bg` optionally fills transparent pixels (for maskable icons that
// must be fully opaque to a safe edge).
function render(size, { maskable = false } = {}) {
  const px = new Uint8Array(size * size * 4);
  const scale = size / SRC;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      let col = C[ART[sy][sx]] ?? null;
      if (!col && maskable) col = C.u; // opaque sky behind the scene
      const o = (y * size + x) * 4;
      if (col) {
        px[o] = col[0];
        px[o + 1] = col[1];
        px[o + 2] = col[2];
        px[o + 3] = col[3];
      }
    }
  }
  return px;
}

function encodePNG(size, px) {
  // Each scanline is prefixed with filter byte 0 (none).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(name, size, opts) {
  const png = encodePNG(size, render(size, opts));
  writeFileSync(join(OUT, name), png);
  console.log(`  ${name}  (${size}×${size}, ${png.length} bytes)`);
}

console.log("Generating PWA icons →", OUT);
write("pwa-192x192.png", 192);
write("pwa-512x512.png", 512);
write("maskable-512x512.png", 512, { maskable: true });
write("apple-touch-icon.png", 180, { maskable: true });
write("favicon-32x32.png", 32);
console.log("Done.");
