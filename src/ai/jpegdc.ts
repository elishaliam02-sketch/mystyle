/**
 * A JPEG read at one-eighth of its size, for installs that have no native
 * image resizer.
 *
 * Decoding a 12-megapixel photo in JavaScript the normal way builds 48 MB of
 * pixels (and far more in between) and closes the app on many phones — that
 * was the crash on older installs. But a JPEG stores every 8 × 8 block's
 * average colour as its own number (the "DC" coefficient), so the picture at
 * 1/8 scale can be read straight from the file without ever building the full
 * one: 4000 × 3000 becomes 500 × 375, under a megabyte, and the remaining
 * detail coefficients are skipped rather than transformed. That is plenty for
 * a 192-pixel classifier.
 *
 * Baseline and progressive JPEGs both work — a progressive file sends every
 * block's DC first, in its own scans, so the detail scans after them are
 * skipped whole. Lossless and arithmetic-coded files (almost never seen) throw.
 */

type Huff = { maxcode: Int32Array; valptr: Int32Array; mincode: Int32Array; values: Uint8Array };
type Comp = { id: number; h: number; v: number; tq: number; td: number; ta: number; pred: number; dc: Int16Array; bpl: number; bpc: number };

export type SmallImage = { width: number; height: number; data: Uint8Array };

/** The largest photo this reads — beyond it the file is refused, not decoded. */
export const MAX_JPEG_BYTES = 24 * 1024 * 1024;

function buildHuff(counts: Uint8Array, values: Uint8Array): Huff {
  const maxcode = new Int32Array(18).fill(-1);
  const valptr = new Int32Array(17);
  const mincode = new Int32Array(17);
  let code = 0;
  let k = 0;
  for (let l = 1; l <= 16; l++) {
    const n = counts[l - 1]!;
    if (n) {
      valptr[l] = k;
      mincode[l] = code;
      code += n;
      k += n;
      maxcode[l] = code - 1;
    }
    code <<= 1;
  }
  maxcode[17] = 0x7fffffff;
  return { maxcode, valptr, mincode, values };
}

export function decodeJpegEighth(bytes: Uint8Array): SmallImage {
  if (bytes.length > MAX_JPEG_BYTES) throw new Error("photo too large");
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("not a jpeg");
  const quant: Int32Array[] = [];
  const dcTables: Huff[] = [];
  const acTables: Huff[] = [];
  let comps: Comp[] = [];
  let width = 0;
  let height = 0;
  let hmax = 1;
  let vmax = 1;
  let mcusX = 0;
  let mcusY = 0;
  let restart = 0;
  let progressive = false;
  let pos = 2;
  const u16 = (p: number) => (bytes[p]! << 8) | bytes[p + 1]!;

  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = bytes[pos + 1]!;
    pos += 2;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
      if (marker === 0xff) pos--;
      continue;
    }
    if (marker === 0xd9) break;
    const len = u16(pos);
    const end = pos + len;
    let p = pos + 2;
    switch (marker) {
      case 0xdb: // quantisation tables
        while (p < end) {
          const pq = bytes[p]! >> 4;
          const tq = bytes[p]! & 15;
          p++;
          const t = new Int32Array(64);
          for (let i = 0; i < 64; i++) {
            t[i] = pq ? u16(p + i * 2) : bytes[p + i]!;
          }
          p += pq ? 128 : 64;
          quant[tq] = t;
        }
        break;
      case 0xc4: // Huffman tables
        while (p < end) {
          const tc = bytes[p]! >> 4;
          const th = bytes[p]! & 15;
          const counts = bytes.subarray(p + 1, p + 17);
          let n = 0;
          for (let i = 0; i < 16; i++) n += counts[i]!;
          const values = bytes.slice(p + 17, p + 17 + n);
          (tc === 0 ? dcTables : acTables)[th] = buildHuff(counts, values);
          p += 17 + n;
        }
        break;
      case 0xdd:
        restart = u16(p);
        break;
      case 0xc0:
      case 0xc1:
      case 0xc2: {
        progressive = marker === 0xc2;
        if (bytes[p] !== 8) throw new Error("unsupported precision");
        height = u16(p + 1);
        width = u16(p + 3);
        const n = bytes[p + 5]!;
        comps = [];
        for (let i = 0; i < n; i++) {
          const q = p + 6 + i * 3;
          comps.push({
            id: bytes[q]!,
            h: bytes[q + 1]! >> 4 || 1,
            v: bytes[q + 1]! & 15 || 1,
            tq: bytes[q + 2]!,
            td: 0,
            ta: 0,
            pred: 0,
            dc: new Int16Array(0),
            bpl: 0,
            bpc: 0,
          });
        }
        hmax = Math.max(...comps.map((c) => c.h));
        vmax = Math.max(...comps.map((c) => c.v));
        mcusX = Math.ceil(width / (8 * hmax));
        mcusY = Math.ceil(height / (8 * vmax));
        if (!width || !height || mcusX * mcusY > 4_000_000) throw new Error("bad size");
        for (const c of comps) {
          c.bpl = mcusX * c.h;
          c.bpc = mcusY * c.v;
          c.dc = new Int16Array(c.bpl * c.bpc);
        }
        break;
      }
      case 0xc3:
      case 0xc5:
      case 0xc6:
      case 0xc7:
      case 0xc9:
      case 0xca:
      case 0xcb:
      case 0xcd:
      case 0xce:
      case 0xcf:
        throw new Error("unsupported jpeg");
      case 0xda: {
        if (!comps.length) throw new Error("scan before frame");
        const ns = bytes[p]!;
        const scan: Comp[] = [];
        for (let i = 0; i < ns; i++) {
          const id = bytes[p + 1 + i * 2]!;
          const t = bytes[p + 2 + i * 2]!;
          const c = comps.find((x) => x.id === id);
          if (!c) throw new Error("bad scan");
          c.td = t >> 4;
          c.ta = t & 15;
          scan.push(c);
        }
        const q = p + 1 + ns * 2;
        const ss = bytes[q]!;
        const ah = bytes[q + 2]! >> 4;
        const al = bytes[q + 2]! & 15;
        // A progressive detail (AC) scan holds nothing this needs: skip it.
        const mode = !progressive ? "base" : ss > 0 ? "skip" : ah === 0 ? "dcFirst" : "dcRefine";
        pos = decodeScan(bytes, end, scan, mode, al, restart, mcusX, mcusY, width, height, hmax, vmax, dcTables, acTables);
        continue;
      }
      default:
        break;
    }
    pos = end;
  }
  if (!comps.length || !width) throw new Error("no image");

  // Each DC is the block's mean, scaled by 8, less the 128 level shift.
  const W = Math.ceil(width / 8);
  const H = Math.ceil(height / 8);
  const out = new Uint8Array(W * H * 4);
  const planes = comps.map((c) => {
    const q = quant[c.tq]?.[0] ?? 1;
    return { c, q, sx: c.h / hmax, sy: c.v / vmax };
  });
  const val = (i: number, x: number, y: number) => {
    const { c, q, sx, sy } = planes[i]!;
    const bx = Math.min(c.bpl - 1, Math.floor(x * sx));
    const by = Math.min(c.bpc - 1, Math.floor(y * sy));
    return (c.dc[by * c.bpl + bx]! * q) / 8 + 128;
  };
  const clamp = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const Y = val(0, x, y);
      if (planes.length >= 3) {
        const cb = val(1, x, y) - 128;
        const cr = val(2, x, y) - 128;
        out[o] = clamp(Y + 1.402 * cr);
        out[o + 1] = clamp(Y - 0.344136 * cb - 0.714136 * cr);
        out[o + 2] = clamp(Y + 1.772 * cb);
      } else {
        out[o] = out[o + 1] = out[o + 2] = clamp(Y);
      }
      out[o + 3] = 255;
    }
  }
  return { width: W, height: H, data: out };
}

function decodeScan(
  bytes: Uint8Array,
  start: number,
  scan: Comp[],
  mode: "base" | "skip" | "dcFirst" | "dcRefine",
  al: number,
  restart: number,
  mcusX: number,
  mcusY: number,
  width: number,
  height: number,
  hmax: number,
  vmax: number,
  dcTables: Huff[],
  acTables: Huff[],
): number {
  let pos = start;
  let bitBuf = 0;
  let bitCnt = 0;
  let hitMarker = false;

  const fill = () => {
    while (bitCnt <= 24) {
      let b = 0;
      if (!hitMarker && pos < bytes.length) {
        b = bytes[pos]!;
        if (b === 0xff) {
          const nx = bytes[pos + 1]!;
          if (nx === 0) {
            pos += 2;
          } else {
            hitMarker = true;
            b = 0;
          }
        } else {
          pos++;
        }
      }
      bitBuf = (bitBuf << 8) | b;
      bitCnt += 8;
    }
  };
  const bit = () => {
    if (bitCnt === 0) fill();
    bitCnt--;
    return (bitBuf >>> bitCnt) & 1;
  };
  const bits = (n: number) => {
    if (bitCnt < n) fill();
    bitCnt -= n;
    return (bitBuf >>> bitCnt) & ((1 << n) - 1);
  };
  const decode = (t: Huff | undefined) => {
    if (!t) throw new Error("missing table");
    let code = bit();
    let l = 1;
    while (code > t.maxcode[l]!) {
      code = (code << 1) | bit();
      l++;
      if (l > 16) return 0;
    }
    return t.values[t.valptr[l]! + code - t.mincode[l]!]!;
  };
  const extend = (v: number, n: number) => (v < 1 << (n - 1) ? v - (1 << n) + 1 : v);

  const block = (c: Comp, row: number, col: number) => {
    const at = row < c.bpc && col < c.bpl ? row * c.bpl + col : -1;
    if (mode === "dcRefine") {
      if (bit() && at >= 0) c.dc[at] |= 1 << al;
      return;
    }
    const s = decode(dcTables[c.td]);
    const diff = s === 0 ? 0 : extend(bits(s), s);
    c.pred += diff;
    if (at >= 0) c.dc[at] = c.pred * (1 << al);
    if (mode === "dcFirst") return;
    const ac = acTables[c.ta];
    for (let k = 1; k < 64; ) {
      const rs = decode(ac);
      const size = rs & 15;
      const run = rs >> 4;
      if (size === 0) {
        if (run === 15) {
          k += 16;
          continue;
        }
        break;
      }
      k += run + 1;
      bits(size);
    }
  };

  const resetAtRestart = () => {
    // Drop the partial byte, skip to after the RSTn marker, reset predictors.
    bitBuf = 0;
    bitCnt = 0;
    hitMarker = false;
    while (pos < bytes.length - 1 && !(bytes[pos] === 0xff && bytes[pos + 1]! >= 0xd0 && bytes[pos + 1]! <= 0xd7)) pos++;
    if (pos < bytes.length - 1) pos += 2;
    for (const c of scan) c.pred = 0;
  };

  if (mode === "skip") {
    // nothing to decode — fall through to the marker search below
  } else if (scan.length > 1) {
    const total = mcusX * mcusY;
    for (let m = 0; m < total; m++) {
      if (restart && m > 0 && m % restart === 0) resetAtRestart();
      const mx = m % mcusX;
      const my = (m / mcusX) | 0;
      for (const c of scan) {
        for (let v = 0; v < c.v; v++) {
          for (let h = 0; h < c.h; h++) block(c, my * c.v + v, mx * c.h + h);
        }
      }
    }
  } else {
    // A single-component scan walks that component's own blocks, unpadded.
    const c = scan[0]!;
    const bw = Math.ceil(Math.ceil((width * c.h) / hmax) / 8);
    const bh = Math.ceil(Math.ceil((height * c.v) / vmax) / 8);
    const total = bw * bh;
    for (let m = 0; m < total; m++) {
      if (restart && m > 0 && m % restart === 0) resetAtRestart();
      block(c, (m / bw) | 0, m % bw);
    }
  }
  // Continue parsing after the entropy data: find the next real marker.
  while (pos < bytes.length - 1) {
    if (bytes[pos] === 0xff && bytes[pos + 1] !== 0 && !(bytes[pos + 1]! >= 0xd0 && bytes[pos + 1]! <= 0xd7)) break;
    pos++;
  }
  return pos;
}
