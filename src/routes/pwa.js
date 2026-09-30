// Hace que la web se pueda instalar en el celular como una app (ícono de torre de control en la pantalla de inicio).
const express = require("express");
const zlib = require("zlib");
const router = express.Router();

// ---- Ícono: se dibuja por código (torre de control) y se guarda en memoria ----
const N = 512;
const C = 256;
function rr(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}
function poly(x, y, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function colorAt(x, y) {
  const W = [255, 255, 255], G = [57, 224, 122], A = [245, 179, 1], B = [31, 58, 92];
  if (!rr(x, y, 0, 0, N, N, 112)) return null;
  let c = B;
  const dx = x - C, dy = y - 81.25, d = Math.sqrt(dx * dx + dy * dy);
  if (dy < 0) {
    const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    if (ang >= 200 && ang <= 340 && (Math.abs(d - 37.5) <= 2.75 || Math.abs(d - 62.5) <= 2.75)) c = G;
  }
  if (d <= 13.75) c = A;
  if (x >= C - 4.5 && x <= C + 4.5 && y >= 92 && y <= 140) c = W;
  if (rr(x, y, C - 130, 410, C + 130, 430, 7)) c = W;
  if (poly(x, y, [[C - 37.5, 410], [C + 37.5, 410], [C + 23.75, 225], [C - 23.75, 225]])) c = W;
  if (poly(x, y, [[C - 105, 155], [C + 105, 155], [C + 75, 225], [C - 75, 225]])) c = W;
  if (rr(x, y, C - 117.5, 140, C + 117.5, 157.5, 7)) c = W;
  if (poly(x, y, [[C - 92.5, 165], [C + 92.5, 165], [C + 67.5, 210], [C - 67.5, 210]])) c = G;
  for (const s of [-1, 1]) {
    if (poly(x, y, [[C + s * 30 - 3, 165], [C + s * 30 + 3, 165], [C + s * 22 + 3, 210], [C + s * 22 - 3, 210]])) c = B;
  }
  for (const y0 of [287.5, 332.5, 375]) if (rr(x, y, C - 7, y0, C + 7, y0 + 22.5, 3.5)) c = B;
  return c;
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function buildIcon() {
  const raw = Buffer.alloc((N * 4 + 1) * N);
  const ss = 3;
  for (let y = 0; y < N; y++) {
    raw[y * (N * 4 + 1)] = 0;
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < ss; i++) for (let j = 0; j < ss; j++) {
        const c = colorAt(x + (i + 0.5) / ss, y + (j + 0.5) / ss);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = y * (N * 4 + 1) + 1 + x * 4;
      if (a) { raw[o] = r / a; raw[o + 1] = g / a; raw[o + 2] = b / a; }
      raw[o + 3] = Math.round((255 * a) / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const ICON = buildIcon();

router.get("/icon.png", (req, res) => {
  res.set("Cache-Control", "public, max-age=86400").type("png").send(ICON);
});

router.get("/manifest.webmanifest", (req, res) => {
  res.type("application/manifest+json").send(JSON.stringify({
    name: "Central de Operaciones",
    short_name: "Central",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    background_color: "#1F3A5C",
    theme_color: "#1F3A5C",
    lang: "es",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }));
});

// Service worker mínimo (no guarda nada: los datos siempre son los de en vivo).
router.get("/sw.js", (req, res) => {
  res.set("Cache-Control", "no-cache").type("application/javascript").send(
    'self.addEventListener("install", () => self.skipWaiting());' +
    'self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));' +
    'self.addEventListener("fetch", () => {});'
  );
});

module.exports = router;
