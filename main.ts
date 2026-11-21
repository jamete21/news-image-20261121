// The World in One Picture — Saturday 21 November 2026.
// A newspaper front page drawn entirely in code: hand-defined 5x7 bitmap
// font, my own raster helpers, and a from-scratch PNG encoder.
// Node 22+, standard library only, no network, deterministic output.
//
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER: [number, number, number] = [247, 243, 232];
const INK: [number, number, number] = [17, 17, 17];
const RED: [number, number, number] = [176, 30, 36];
const GREY: [number, number, number] = [90, 86, 76];
const LIGHT: [number, number, number] = [216, 210, 192];
const WHITE: [number, number, number] = [255, 255, 255];
const NAVY: [number, number, number] = [27, 42, 74];
const ORANGE: [number, number, number] = [245, 158, 11];
const YELLOW: [number, number, number] = [253, 224, 71];
const BLUE: [number, number, number] = [0, 51, 153];
type RGB = [number, number, number];

// ------------------------------------------------------------- CRC32 + PNG
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ canvas
class Canvas {
  data: Buffer;
  width: number;
  height: number;
  constructor(width: number, height: number, bg: RGB) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 3);
    this.fillRect(0, 0, width, height, bg);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }
  hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
    for (let t2 = 0; t2 < t; t2++) for (let x = x0; x <= x1; x++) this.set(x, y + t2, c);
  }
  vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
    for (let t2 = 0; t2 < t; t2++) for (let y = y0; y <= y1; y++) this.set(x + t2, y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + (dx * i) / steps);
      const y = Math.round(y0 + (dy * i) / steps);
      if (t === 1) this.set(x, y, c);
      else this.fillRect(x - ((t - 1) >> 1), y - ((t - 1) >> 1), t, t, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB, filled: boolean): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (filled ? d <= r : d <= r && d >= r - 1.2) this.set(cx + x, cy + y, c);
      }
    }
  }
  // filled triangle
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minX = Math.min(x0, x1, x2);
    const maxX = Math.max(x0, x1, x2);
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
        const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
        const cc = 1 - a - b;
        if (a >= 0 && b >= 0 && cc >= 0) this.set(x, y, c);
      }
    }
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows of 5 bits, '1' = pixel on. My own letterforms.
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '11001', '10001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00010', '00100', '00100', '00100'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00000', '01100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '01100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '(': ['00011', '00100', '01000', '01000', '01000', '00100', '00011'],
  ')': ['11000', '00100', '00010', '00010', '00010', '00100', '11000'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
  '&': ['01110', '10001', '10100', '01000', '10110', '10001', '01110'],
  '%': ['10001', '10010', '00010', '00100', '01000', '10010', '10001'],
  $: ['00100', '01111', '10101', '01110', '10100', '11110', '00100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
};

function clean(s: string): string {
  return s
    .toUpperCase()
    .replace(/[—–]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '|')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function textWidth(s: string, scale: number): number {
  return clean(s).length * 6 * scale - scale;
}

function drawText(cv: Canvas, x: number, y: number, s: string, scale: number, c: RGB): void {
  const t = clean(s);
  for (let i = 0; i < t.length; i++) {
    const g = FONT[t[i]] ?? FONT[' '];
    const ox = x + i * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '1') cv.fillRect(ox + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function drawTextCentered(cv: Canvas, cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cv, cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// Greedy word wrap to a pixel width; returns at most maxLines lines.
function wrap(s: string, maxPx: number, scale: number, maxLines: number): string[] {
  const words = clean(s).split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxPx) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

// ------------------------------------------------------------------- icons
// Each icon is drawn in a 64x64 box at (x, y). Simple geometric pictograms.
function iconJustice(cv: Canvas, x: number, y: number): void {
  cv.vline(x + 32, y + 8, y + 52, INK, 3);
  cv.hline(x + 12, x + 52, y + 12, INK, 3);
  cv.hline(x + 22, x + 42, y + 54, INK, 3);
  cv.fillRect(x + 20, y + 56, 24, 3, INK);
  // pans: triangles hanging from the crossbar ends
  cv.tri(x + 6, y + 28, x + 18, y + 28, x + 12, y + 16, INK);
  cv.tri(x + 46, y + 28, x + 58, y + 28, x + 52, y + 16, INK);
  cv.vline(x + 12, y + 13, y + 16, INK, 2);
  cv.vline(x + 52, y + 13, y + 16, INK, 2);
  cv.circle(x + 32, y + 8, 4, RED, true);
}

function iconChart(cv: Canvas, x: number, y: number): void {
  cv.vline(x + 8, y + 8, y + 54, INK, 2);
  cv.hline(x + 8, x + 56, y + 54, INK, 2);
  const pts: [number, number][] = [
    [10, 16], [20, 20], [28, 18], [36, 30], [44, 38], [54, 48],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    cv.line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], RED, 3);
  }
  cv.tri(x + 54, y + 48, x + 46, y + 44, x + 50, y + 54, RED);
}

function iconFlags(cv: Canvas, x: number, y: number): void {
  // Union Jack, simplified: blue field, white cross, red cross, diagonals.
  cv.fillRect(x + 4, y + 12, 24, 36, BLUE);
  cv.line(x + 4, y + 12, x + 28, y + 48, WHITE, 2);
  cv.line(x + 28, y + 12, x + 4, y + 48, WHITE, 2);
  cv.fillRect(x + 14, y + 12, 4, 36, WHITE);
  cv.fillRect(x + 4, y + 28, 24, 4, WHITE);
  cv.fillRect(x + 15, y + 12, 2, 36, RED);
  cv.fillRect(x + 4, y + 29, 24, 2, RED);
  // EU flag: blue field, ring of gold dots.
  cv.fillRect(x + 36, y + 12, 24, 36, BLUE);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const dx = Math.round(48 + 8 * Math.cos(a));
    const dy = Math.round(30 + 11 * Math.sin(a));
    cv.fillRect(x + dx - 1, y + dy - 1, 3, 3, YELLOW);
  }
}

function iconShield(cv: Canvas, x: number, y: number): void {
  // shield outline
  cv.line(x + 14, y + 8, x + 50, y + 8, INK, 3);
  cv.line(x + 14, y + 8, x + 14, y + 34, INK, 3);
  cv.line(x + 50, y + 8, x + 50, y + 34, INK, 3);
  cv.line(x + 14, y + 34, x + 32, y + 56, INK, 3);
  cv.line(x + 50, y + 34, x + 32, y + 56, INK, 3);
  // check mark
  cv.line(x + 22, y + 30, x + 30, y + 40, RED, 4);
  cv.line(x + 30, y + 40, x + 44, y + 20, RED, 4);
}

function iconGlobe(cv: Canvas, x: number, y: number): void {
  cv.circle(x + 32, y + 32, 22, INK, false);
  cv.line(x + 12, y + 26, x + 52, y + 26, INK, 2);
  cv.line(x + 12, y + 38, x + 52, y + 38, INK, 2);
  cv.line(x + 32, y + 10, x + 32, y + 54, INK, 2);
  // crack: red zigzag across the globe
  cv.line(x + 20, y + 14, x + 28, y + 26, RED, 2);
  cv.line(x + 28, y + 26, x + 22, y + 38, RED, 2);
  cv.line(x + 22, y + 38, x + 32, y + 50, RED, 2);
}

function iconQuake(cv: Canvas, x: number, y: number): void {
  const pts: [number, number][] = [
    [6, 32], [14, 32], [18, 16], [24, 46], [30, 20], [36, 44], [42, 28], [48, 32], [58, 32],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    cv.line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], RED, 3);
  }
  cv.line(x + 20, y + 52, x + 26, y + 60, INK, 2);
  cv.line(x + 26, y + 60, x + 22, y + 64, INK, 2);
  cv.line(x + 40, y + 52, x + 36, y + 62, INK, 2);
}

// ------------------------------------------------------------- lead picture
// Night skyline under an explosion, with a missile arcing across the sky.
function drawLeadArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, NAVY);
  // stars
  const stars: [number, number][] = [
    [12, 14], [60, 30], [110, 10], [170, 26], [220, 12], [300, 22], [340, 40],
    [40, 60], [150, 52], [260, 58], [320, 70], [90, 84], [200, 78],
  ];
  for (const [sx, sy] of stars) cv.fillRect(x + sx, y + sy, 2, 2, WHITE);
  // skyline silhouettes
  const buildings: [number, number, number][] = [
    [0, 90, 46], [50, 70, 62], [116, 100, 40], [160, 60, 74], [238, 96, 44], [286, 74, 60], [330, 104, 30],
  ];
  for (const [bx, bw, bh] of buildings) {
    cv.fillRect(x + bx, y + h - bh, bw, bh, INK);
  }
  // lit windows: only inside a building silhouette, never floating in the sky
  for (let i = 0; i < 40; i++) {
    const wx = 6 + ((i * 53) % 330);
    const wy = y + h - 30 - ((i * 29) % 90);
    const inside = buildings.some(
      ([bx, bw, bh]) => wx >= bx && wx < bx + bw && wy >= y + h - bh,
    );
    if (inside) cv.fillRect(x + wx, wy, 3, 4, YELLOW);
  }
  // explosion burst over the skyline
  const cx = x + 250;
  const cy = y + 62;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = 26 + (i % 3) * 10;
    cv.line(cx, cy, Math.round(cx + len * Math.cos(a)), Math.round(cy + len * Math.sin(a)), i % 2 ? ORANGE : YELLOW, 4);
  }
  cv.circle(cx, cy, 12, ORANGE, true);
  cv.circle(cx, cy, 6, YELLOW, true);
  // missile arc: dotted curve with a small missile at its head
  for (let t = 0; t <= 10; t++) {
    const u = t / 10;
    const mx = Math.round(x + 30 + u * 240);
    const my = Math.round(y + 150 - 90 * u * u - 20 * u);
    cv.fillRect(mx, my, 4, 4, WHITE);
  }
  cv.tri(x + 268, y + 44, x + 282, y + 52, x + 266, y + 56, WHITE);
}

// ------------------------------------------------------------------ stories
type Story = {
  kicker: string;
  head: string;
  body: string;
  icon: (cv: Canvas, x: number, y: number) => void;
};

const STORIES: Story[] = [
  {
    kicker: 'THE HAGUE - JUSTICE',
    head: 'MYANMAR GUILTY OF GENOCIDE',
    body: "The UN court rules 9-6 that Myanmar committed genocide against the Rohingya - the first state ever held responsible.",
    icon: iconJustice,
  },
  {
    kicker: 'NEW YORK - MARKETS',
    head: 'WALL STREET SLIDES INTO CORRECTION',
    body: 'S&P 500 -3.7%, Nasdaq -5.3%, Dow -1.9%. The Nasdaq wipes out all its 2026 gains. Nvidia -13.8% as the SEC probes its books.',
    icon: iconChart,
  },
  {
    kicker: 'BRUSSELS - EUROPE',
    head: 'UK AND EU SEAL POST-BREXIT DEALS',
    body: 'Three deals in Brussels: food checks scrapped from March 2028, carbon markets linked from January 2028, youth travel for 100,000.',
    icon: iconFlags,
  },
  {
    kicker: 'RIYADH - MIDDLE EAST',
    head: 'SAUDIS DOWN HOUTHI MISSILES',
    body: 'The Saudi-led coalition downs three missiles aimed at Riyadh - the third night running. The Houthis threaten ports and a power station.',
    icon: iconShield,
  },
  {
    kicker: 'ANTALYA - CLIMATE',
    head: 'COP31 TALKS STALL IN ANTALYA',
    body: 'Climate talks in Antalya miss their deadline, and the draft text drops any mention of fossil fuels.',
    icon: iconGlobe,
  },
  {
    kicker: 'LIMA - DISASTER',
    head: '6.8 QUAKE SHAKES PERU',
    body: 'A magnitude 6.8 quake strikes Junin in central Peru. Tremors are felt in Lima, 320 km away.',
    icon: iconQuake,
  },
];

const LEAD_BODY =
  'Russia fires more than 400 drones and 110 missiles at Ukraine overnight - its biggest attack of the year. At least eight people are killed in Kyiv. A Russian missile comes down in south-east Poland. PM Tusk calls it a deliberate provocation.';

const TICKER_1 = "TRUMP CALLS PUTIN 'A FRIEND' - ZELENSKY: 'A KILLER'";
const TICKER_2 = 'GTA VI BANKS $3.8BN ON DAY ONE | KL RAHUL COMPLETES SENA CENTURY SET';

// -------------------------------------------------------------------- build
function drawFrontPage(): Canvas {
  const cv = new Canvas(W, H, PAPER);

  // Masthead
  drawTextCentered(cv, W / 2, 20, 'THE WORLD IN ONE PICTURE', 5, INK);
  drawTextCentered(cv, W / 2, 64, 'SATURDAY 21 NOVEMBER 2026', 3, RED);
  drawTextCentered(cv, W / 2, 94, "ONE DAY - ONE PICTURE - THE WORLD'S NEWS", 2, GREY);
  cv.fillRect(24, 116, 976, 4, RED);
  cv.fillRect(24, 124, 976, 2, INK);

  // Lead story
  drawText(cv, 24, 138, 'KYIV - WAR IN UKRAINE', 2, RED);
  drawText(cv, 24, 160, "RUSSIA'S BIGGEST STRIKES ON UKRAINE", 4, INK);
  drawText(cv, 24, 194, 'MISSILE LANDS IN POLAND AS NATO JETS SCRAMBLE', 3, RED);
  const leadLines = wrap(LEAD_BODY, 580, 2, 6);
  leadLines.forEach((ln, i) => drawText(cv, 24, 226 + i * 16, ln, 2, INK));
  // stat boxes under the lead body
  const stats: [string, string][] = [
    ['400+', 'DRONES'],
    ['110', 'MISSILES'],
    ['8', 'KILLED IN KYIV'],
  ];
  stats.forEach(([num, label], i) => {
    const bx = 24 + i * 198;
    cv.fillRect(bx, 336, 186, 66, WHITE);
    cv.hline(bx, bx + 185, 336, INK, 2);
    cv.hline(bx, bx + 185, 400, INK, 2);
    cv.vline(bx, 336, 400, INK, 2);
    cv.vline(bx + 185, 336, 400, INK, 2);
    drawTextCentered(cv, bx + 93, 344, num, 3, RED);
    drawTextCentered(cv, bx + 93, 372, label, 2, INK);
  });
  drawLeadArt(cv, 640, 222, 360, 198);
  cv.hline(24, 1000, 436, INK, 2);

  // Story grid: 2 columns x 3 rows
  const colX = [24, 528];
  const rowY = [452, 608, 764];
  STORIES.forEach((st, i) => {
    const cx = colX[i % 2];
    const cy = rowY[Math.floor(i / 2)];
    st.icon(cv, cx, cy + 6);
    const tx = cx + 76;
    drawText(cv, tx, cy, st.kicker, 2, RED);
    const headLines = wrap(st.head, 396, 3, 2);
    headLines.forEach((ln, j) => drawText(cv, tx, cy + 18 + j * 23, ln, 3, INK));
    const bodyLines = wrap(st.body, 396, 2, 4);
    bodyLines.forEach((ln, j) => drawText(cv, tx, cy + 68 + j * 16, ln, 2, INK));
  });
  // column divider + row dividers
  cv.vline(512, 452, 912, LIGHT, 2);
  cv.hline(24, 1000, 600, LIGHT, 2);
  cv.hline(24, 1000, 756, LIGHT, 2);

  // Ticker
  cv.fillRect(24, 924, 976, 72, INK);
  drawTextCentered(cv, W / 2, 934, TICKER_1, 2, WHITE);
  drawTextCentered(cv, W / 2, 960, TICKER_2, 2, WHITE);

  // Footer
  drawTextCentered(cv, W / 2, 1004, 'SOURCES: BBC, AL JAZEERA, FT, GUARDIAN, REUTERS, AP', 2, GREY);

  return cv;
}

function main(): void {
  const cv = drawFrontPage();
  const png = encodePNG(W, H, cv.data);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
