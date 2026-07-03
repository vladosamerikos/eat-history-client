// Genera todos los iconos del navegador y la PWA desde el SVG canónico.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC, 'foodcoomit-logo.svg');
const LIGHT_BACKGROUND = '#f7fff9';

async function renderPng(name, size, { paddingRatio = 0.06, background } = {}) {
  const padding = Math.round(size * paddingRatio);
  const inner = size - padding * 2;
  const icon = await sharp(SOURCE, { density: 512 })
    .resize(inner, inner, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, left: padding, top: padding }])
    .png()
    .toFile(path.join(PUBLIC, name));

  console.log('✓', name);
}

await fs.copyFile(SOURCE, path.join(PUBLIC, 'favicon.svg'));
await renderPng('favicon-32.png', 32, { paddingRatio: 0.03 });
await fs.copyFile(path.join(PUBLIC, 'favicon-32.png'), path.join(PUBLIC, 'favicon.png'));
await renderPng('apple-touch-icon.png', 180, {
  paddingRatio: 0.1,
  background: LIGHT_BACKGROUND,
});
await renderPng('pwa-192.png', 192);
await renderPng('pwa-512.png', 512);
await renderPng('pwa-512-maskable.png', 512, {
  // El artwork queda dentro de la zona segura central de iconos maskable.
  paddingRatio: 0.16,
  background: LIGHT_BACKGROUND,
});

console.log('Iconos de FoodCommit generados desde public/foodcoomit-logo.svg');
