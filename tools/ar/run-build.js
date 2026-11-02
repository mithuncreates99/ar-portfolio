const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('out', { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 200)); });
  await page.goto('http://localhost:' + (process.env.PORT || 8772) + '/build.html');
  await page.waitForFunction(() => window.__done || window.__error, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__error);
  if (err) { console.log('ERROR', err); process.exit(1); }
  const info = await page.evaluate(() => window.__info); console.log(JSON.stringify(info)); fs.writeFileSync('out/info.json', JSON.stringify(info));
  fs.writeFileSync('out/portfolio-raw.glb', Buffer.from(await page.evaluate(() => window.__glb), 'base64'));
  const shots = (process.env.SHOTS || '1.0,2.3,3.4,4.4,5.4,6.3,9').split(',').map(Number);
  for (const t of shots) { await page.evaluate(t => window.__render(t), t); await page.screenshot({ path: `out/check-${t}.png` }); }
  await browser.close();
})();
