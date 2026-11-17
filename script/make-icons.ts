/**
 * Gera os ícones PWA (PNG) a partir do desenho de client/public/favicon.svg, sem dependências.
 * Uso: npx tsx script/make-icons.ts
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = [0x0f, 0x1a, 0x19], FG = [0x35, 0xb3, 0x9d];
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const png = (size: number, rgba: Buffer) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
};

const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
/** true se (x,y), em coordenadas 0..32 do SVG, cai dentro do traço do desenho */
const glyph = (x: number, y: number) => {
  const half = 1.1;
  return Math.abs(Math.hypot(x - 16, y - 16) - 9) <= half ||
    segDist(x, y, 8.5, 12.5, 23.5, 12.5) <= half || segDist(x, y, 8.5, 19.5, 23.5, 19.5) <= half || segDist(x, y, 16, 19.5, 16, 25) <= half;
};
const roundedRect = (x: number, y: number, r: number) => {
  const cx = Math.min(Math.max(x, r), 32 - r), cy = Math.min(Math.max(y, r), 32 - r);
  return Math.hypot(x - cx, y - cy) <= r;
};

/** `maskable`: fundo até às margens e desenho reduzido para a zona segura (80 %). */
function render(size: number, maskable: boolean) {
  const out = Buffer.alloc(size * size * 4), N = 4, scale = maskable ? 0.8 : 1;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let bg = 0, fg = 0;
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const x = ((px + (sx + 0.5) / N) / size) * 32, y = ((py + (sy + 0.5) / N) / size) * 32;
      if (maskable || roundedRect(x, y, 8)) {
        bg++;
        if (glyph(16 + (x - 16) / scale, 16 + (y - 16) / scale)) fg++;
      }
    }
    const n = N * N, i = (py * size + px) * 4, a = bg / n, f = bg ? fg / bg : 0;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(BG[c] * (1 - f) + FG[c] * f);
    out[i + 3] = Math.round(a * 255);
  }
  return png(size, out);
}

writeFileSync("client/public/icon-192.png", render(192, false));
writeFileSync("client/public/icon-512.png", render(512, false));
writeFileSync("client/public/icon-maskable-512.png", render(512, true));
console.log("ícones gerados");
