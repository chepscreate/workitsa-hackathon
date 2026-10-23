const sharp = require('sharp');
const fs = require('fs');
const svgPath = 'marketing/content/2026-06-25-trades-category.svg';
const outPath = 'marketing/content/2026-06-25-trades-category.png';
const svgBuffer = fs.readFileSync(svgPath);
sharp(svgBuffer, { density: 144 })
  .resize(1080, 1080)
  .png()
  .toFile(outPath)
  .then(() => console.log('done'))
  .catch((err) => { console.error(err); process.exit(1); });
