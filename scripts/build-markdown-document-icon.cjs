// Build the supplied vector as a multi-resolution Windows document icon.
// Run with the repository's pinned Playwright/Chromium development dependency.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const directory = path.resolve(__dirname, '../desktop-app/experimental/windows');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const svg = fs.readFileSync(path.join(directory, 'markdown-document.svg'), 'utf8');
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = [];
    for (const size of sizes) {
      const png = await page.evaluate(async ({ svg, size }) => {
        const image = new Image();
        image.src = 'data:image/svg+xml;base64,' + btoa(svg.replace('currentColor', '#202020'));
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { svg, size });
      images.push(Buffer.from(png, 'base64'));
    }
    const header = Buffer.alloc(6 + images.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach((image, index) => {
      const entry = 6 + index * 16;
      header[entry] = header[entry + 1] = sizes[index] % 256;
      header.writeUInt16LE(1, entry + 4);
      header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(image.length, entry + 8);
      header.writeUInt32LE(offset, entry + 12);
      offset += image.length;
    });
    fs.writeFileSync(path.join(directory, 'markdown-document.ico'), Buffer.concat([header, ...images]));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
