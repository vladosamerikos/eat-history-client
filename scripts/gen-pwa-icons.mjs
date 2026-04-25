// Genera los iconos PWA + favicon a partir de un SVG base.
// Pensado para correr antes del build: `node scripts/gen-pwa-icons.mjs`.
// Usa el contexto de canvas vía sharp para flatten + composición sin emoji raster
// (en su lugar dibujamos un manzana estilizada con SVG).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

// SVG sin depender de fuentes de emoji del sistema.
const baseSVG = (size, padding = 0) => {
  const inner = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = inner * 0.32;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#22c55e"/>
      <stop offset="1" stop-color="#15803d"/>
    </linearGradient>
    <radialGradient id="hl" cx="0.35" cy="0.3" r="0.4">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="url(#g)"/>
  <!-- hoja -->
  <path d="M ${cx + r * 0.05} ${cy - r * 1.05}
           q ${r * 0.45} -${r * 0.55} ${r * 0.95} -${r * 0.2}
           q -${r * 0.25} ${r * 0.6} -${r * 0.85} ${r * 0.45} z"
        fill="#86efac"/>
  <!-- manzana -->
  <ellipse cx="${cx}" cy="${cy + r * 0.15}" rx="${r * 1.05}" ry="${r * 1.1}" fill="#fef3c7"/>
  <ellipse cx="${cx}" cy="${cy + r * 0.15}" rx="${r * 1.05}" ry="${r * 1.1}" fill="url(#hl)"/>
  <!-- tallito -->
  <rect x="${cx - r * 0.08}" y="${cy - r * 1.1}" width="${r * 0.16}" height="${r * 0.35}" rx="${r * 0.06}" fill="#7c3a17"/>
</svg>`;
};

async function gen(name, size, { maskable = false } = {}) {
  // Si es maskable garantizamos un padding seguro (10% por lado).
  const svg = maskable ? baseSVG(size, size * 0.1) : baseSVG(size, 0);
  const buf = Buffer.from(svg);
  const out = path.join(PUBLIC, name);
  await sharp(buf, { density: 384 }).png().toFile(out);
  console.log('✓', name);
}

await gen('pwa-192.png', 192);
await gen('pwa-512.png', 512);
await gen('pwa-512-maskable.png', 512, { maskable: true });
await gen('apple-touch-icon.png', 180);
await gen('favicon-32.png', 32);
fs.copyFileSync(path.join(PUBLIC, 'favicon-32.png'), path.join(PUBLIC, 'favicon.png'));
console.log('done');
