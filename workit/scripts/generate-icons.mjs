// Render the Workit "Wt" stamp SVG to PNGs at the sizes iOS / Android need.
// Run with: node scripts/generate-icons.mjs
//
// Why we don't trust SVG favicons here:
//   - iOS Safari "Add to Home Screen" needs apple-touch-icon.png (180×180).
//   - Android PWA install needs maskable 192/512 PNGs in the manifest.
//   - SVG favicons work in Chrome desktop but are inconsistent on mobile.

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, "..", "public");

// Standalone SVG — kept inline so the script has no other deps.
// Wraps the stamp in a slightly bigger square so iOS's rounded-corner mask
// doesn't clip the artwork.
const svgFor = ({ pad = true } = {}) => {
  // iOS adds its own rounded corners; ship a flat black-on-cream square.
  // For maskable Android icons, add ~10% safe-area padding.
  const inset = pad ? 6 : 0; // viewBox 0–64; native artwork uses 6..58
  const stampSize = 64 - inset * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="geometricPrecision">
  <rect width="64" height="64" fill="#faf4ec"/>
  <rect x="${inset}" y="${inset}" width="${stampSize}" height="${stampSize}" rx="${14 * (stampSize / 52)}" fill="#1f1612"/>
  <rect x="${inset + 3}" y="${inset + 3}" width="${stampSize - 6}" height="${stampSize - 6}" rx="${11 * (stampSize / 52)}" fill="none" stroke="#faf4ec" stroke-width="1.5" opacity="0.55"/>
  <g transform="translate(${inset - 6}, ${inset - 6}) scale(${stampSize / 52})">
    <path d="M 14 19 L 21 47 L 28 30 L 36 47 L 43 30 Q 47 22 50 19 L 50 50"
          stroke="#faf4ec" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <line x1="43" y1="22" x2="57" y2="22" stroke="#faf4ec" stroke-width="4.5" stroke-linecap="round"/>
  </g>
</svg>`;
};

async function render(svg, size, outName) {
  await mkdir(PUBLIC, { recursive: true });
  const out = join(PUBLIC, outName);
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${outName} (${size}×${size})`);
}

const padded = svgFor({ pad: true });
const flush = svgFor({ pad: false });

await render(flush, 180, "apple-icon.png");
await render(flush, 192, "icon-192.png");
await render(flush, 512, "icon-512.png");
await render(padded, 192, "icon-192-maskable.png");
await render(padded, 512, "icon-512-maskable.png");
await render(flush, 32, "favicon-32.png");

// Also drop a 1024 master for any future need (App Store etc.)
await render(flush, 1024, "icon-1024.png");

console.log("\nDone. Icons written to /public/.");
