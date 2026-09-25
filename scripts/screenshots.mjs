// Captures a desktop and a mobile screenshot of every project in _data/portfolio.json
// into assets/portfolio/<slug>/ (desktop.webp, mobile.webp, thumb.webp).
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';

const projects = JSON.parse(await fs.readFile('_data/portfolio.json', 'utf8'));
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const browser = await chromium.launch();

const views = [
  { name: 'desktop', context: { viewport: { width: 1366, height: 854 }, deviceScaleFactor: 1 }, maxHeight: 2600 },
  { name: 'mobile', context: { ...devices['iPhone 13'] }, maxHeight: 1900 },
];

async function capture(url, view) {
  const ctx = await browser.newContext({ ...view.context, locale: 'es-US' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(4000);
    // Scroll through the page so lazy images and reveal-on-scroll sections render
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2000);
    const vp = page.viewportSize();
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    return await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(full, view.maxHeight) } });
  } finally {
    await ctx.close();
  }
}

let failures = 0;
for (const p of projects) {
  if (only && !only.includes(p.slug)) continue;
  const dir = `assets/portfolio/${p.slug}`;
  await fs.mkdir(dir, { recursive: true });
  try {
    const desktop = await capture(p.url, views[0]);
    await sharp(desktop).resize({ width: 1280 }).webp({ quality: 72 }).toFile(`${dir}/desktop.webp`);
    await sharp(desktop).extract({ left: 0, top: 0, width: 1366, height: 854 }).resize({ width: 480 }).webp({ quality: 70 }).toFile(`${dir}/thumb.webp`);
    const mobile = await capture(p.url, views[1]);
    await sharp(mobile).resize({ width: 560 }).webp({ quality: 72 }).toFile(`${dir}/mobile.webp`);
    console.log(`ok   ${p.slug}`);
  } catch (err) {
    failures++;
    console.log(`FAIL ${p.slug}: ${err.message}`);
  }
}
await browser.close();
if (failures === projects.length) process.exit(1);
