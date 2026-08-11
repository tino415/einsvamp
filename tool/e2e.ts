/**
 * End-to-end smoke test: drives the real app in a real browser.
 *
 *   node --experimental-strip-types tool/e2e.ts [baseURL]
 *
 * Browsers come from nixpkgs via PLAYWRIGHT_BROWSERS_PATH (see default.nix),
 * not from `npx playwright install`.
 */

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://dev.local:4114/';
const SHOTS = 'tool/screenshots';
/** Tiles are <path> when flattened and <use> otherwise — match both. */
const TILE_SEL = '#stage svg g > *';

let failures = 0;
let checks = 0;

function ok(cond: boolean, msg: string, detail = ''): void {
  checks++;
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}${detail ? `\n         ${detail}` : ''}`);
  }
}

mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

/** Renders are coalesced into one animation frame — wait for it to land. */
const settle = (): Promise<void> =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/** Set a range input and fire the same event the UI listens for. */
async function setRange(id: string, value: number): Promise<void> {
  await page.evaluate(
    ([sel, v]) => {
      const input = document.querySelector(sel) as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [`#${id}`, value] as [string, number],
  );
  await settle();
}

console.log(`\nLoading ${BASE}`);
await page.goto(BASE, { waitUntil: 'networkidle' });

// ---- initial render ----
await page.waitForSelector('#stage svg', { timeout: 10_000 });

{
  const n = await page.locator(TILE_SEL).count();
  ok(n === 559, 'default view renders 559 tiles', `got ${n}`);

  const status = (await page.locator('#status').textContent()) ?? '';
  ok(/559 tiles/.test(status), 'status line reports the tile count', `got "${status}"`);

  const box = await page.locator('#stage svg').boundingBox();
  ok(!!box && box.width > 300 && box.height > 300, 'SVG occupies the stage',
    JSON.stringify(box));
}

await page.screenshot({ path: `${SHOTS}/01-default.png` });

// ---- parameter sweep: every control must change something without throwing ----
console.log('\nSweeping controls');

const before = await page.locator('#stage svg').innerHTML();

// Subdivisions up one level.
await setRange('p-subdivisions', 4);
await page.waitForFunction(() => document.querySelectorAll('#stage svg g > *').length === 4401, null, { timeout: 15_000 })
  .then(() => ok(true, 'subdivisions=4 yields 4401 tiles'))
  .catch(async () => ok(false, 'subdivisions=4 yields 4401 tiles',
    `got ${await page.locator(TILE_SEL).count()}`));

await page.screenshot({ path: `${SHOTS}/02-depth4.png` });

await setRange('p-subdivisions', 3);
await page.waitForFunction(() => document.querySelectorAll('#stage svg g > *').length === 559);

// Straight edges.
await page.locator('#p-curved').uncheck();
await settle();
{
  const d = (await page.locator('#stage svg g > path').first().getAttribute('d')) ?? '';
  ok(!d.includes('C'), 'straight-edge mode emits no bezier segments', d.slice(0, 80));
  ok(d.includes('L'), 'straight-edge mode emits line segments', d.slice(0, 80));
}
await page.screenshot({ path: `${SHOTS}/03-straight.png` });
await page.locator('#p-curved').check();
await settle();
{
  const d = (await page.locator('#stage svg g > path').first().getAttribute('d')) ?? '';
  ok(d.includes('C'), 'curved mode emits bezier segments', d.slice(0, 80));
}

// Each remaining control: set a value, confirm the SVG changed and nothing threw.
const sweep: [string, string][] = [
  ['p-system', 'hexagon'],
  ['p-system', 'hat-turtle'],
  ['p-system', 'spectre'],
  ['p-colorMode', 'rotation'],
  ['p-colorMode', 'branch'],
  ['p-colorMode', 'radial'],
  ['p-colorMode', 'angular'],
  ['p-colorMode', 'random'],
  ['p-colorMode', 'mystic'],
  ['p-colorMode', 'label'],
  ['p-palette', 'ember'],
  ['p-clipMode', 'circle'],
  ['p-clipMode', 'hex'],
  ['p-clipMode', 'rect'],
  ['p-clipMode', 'none'],
  ['p-strokeLinejoin', 'bevel'],
  ['p-startCluster', 'Gamma'],
  ['p-startCluster', 'Delta'],
];
for (const [id, value] of sweep) {
  await page.locator(`#${id}`).selectOption(value);
  await settle();
  const count = await page.locator(TILE_SEL).count();
  ok(count > 0, `select ${id}=${value} still renders`, `${count} tiles`);
}

const ranges: [string, number][] = [
  ['p-curveAmplitude', 1],
  ['p-curveT1', 0.2],
  ['p-curveT2', 0.8],
  ['p-tileInset', 0.12],
  ['p-cornerRadius', 0.2],
  ['p-zoom', 1.6],
  ['p-panX', 0.1],
  ['p-panY', -0.1],
  ['p-rotation', 25],
  ['p-clipInset', 0.1],
  ['p-hueShift', 90],
  ['p-saturation', 1.4],
  ['p-lightness', 1.1],
  ['p-fillOpacity', 0.9],
  ['p-strokeWidth', 0.06],
  ['p-strokeOpacity', 0.8],
  ['p-seed', 4321],
  ['p-jitterPosition', 0.04],
  ['p-jitterRotation', 4],
  ['p-exportSize', 800],
  ['p-precision', 2],
];
for (const [id, value] of ranges) {
  await setRange(id, value);
  const count = await page.locator(TILE_SEL).count();
  ok(count > 0, `range ${id}=${value} still renders`, `${count} tiles`);
}

const after = await page.locator('#stage svg').innerHTML();
ok(before !== after, 'the sweep actually changed the rendered output');

await page.screenshot({ path: `${SHOTS}/04-swept.png` });

// ---- URL hash round-trip ----
console.log('\nState round-trip');
{
  const hash = await page.evaluate(() => location.hash);
  ok(hash.length > 1, 'parameters are written to the URL hash', `got "${hash}"`);

  const page2 = await ctx.newPage();
  await page2.goto(`${BASE}${hash}`, { waitUntil: 'networkidle' });
  await page2.waitForSelector('#stage svg');
  await page2.waitForTimeout(200);
  const a = await page.locator('#stage svg').innerHTML();
  const b = await page2.locator('#stage svg').innerHTML();
  ok(a === b, 'reloading the hash reproduces an identical tiling');
  await page2.close();
}

// ---- reset / randomise ----
await page.locator('#reset').click();
await settle();
ok((await page.locator(TILE_SEL).count()) === 559, 'reset restores the default tiling');

await page.locator('#randomize').click();
await settle();
ok((await page.locator(TILE_SEL).count()) > 0, 'randomise produces a valid tiling');
await page.screenshot({ path: `${SHOTS}/05-random.png` });

await page.locator('#reset').click();
await settle();

// ---- SVG export ----
console.log('\nExport');
{
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator('#export').click(),
  ]);
  ok(download.suggestedFilename() === 'einsvamp.svg', 'download is named einsvamp.svg',
    download.suggestedFilename());

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  writeFileSync(`${SHOTS}/export.svg`, text);

  ok(text.startsWith('<?xml'), 'exported file is an XML document');
  ok(text.includes('xmlns="http://www.w3.org/2000/svg"'), 'exported SVG declares its namespace');
  const tiles559 = (text.match(/<(use|path) /g) ?? []).length;
  ok(tiles559 === 559, 'exported SVG contains every tile', `${tiles559} tile elements`);
  ok(!/NaN|undefined|Infinity/.test(text), 'exported SVG has no NaN/undefined coordinates');

  // Illustrator's parser is far stricter than a browser's: it rejects CSS
  // Color 4 syntax outright and only honours the SVG 1.1 xlink:href.
  ok(!/hsl\(|rgb\(|color\(|oklch\(/.test(text),
    'exported SVG uses only hex colours (no CSS Color 4 functions)',
    (text.match(/(hsl|rgb|color|oklch)\([^)]*\)/) ?? [''])[0]);
  ok(text.includes('xmlns:xlink="http://www.w3.org/1999/xlink"'),
    'exported SVG declares the xlink namespace');
  ok(text.includes('version="1.1"'), 'exported SVG declares version 1.1');
  ok(!/ href="/.test(text) || / xlink:href="/.test(text),
    'any href is accompanied by xlink:href');

  // The export must be a valid standalone document a renderer will accept.
  const page3 = await ctx.newPage();
  await page3.setContent(
    `<body style="margin:0">${text.replace(/^<\?xml[^>]*\?>\s*/, '')}</body>`,
  );
  const rendered = await page3.locator('svg g > *').count();
  ok(rendered === 559, 'exported SVG re-renders standalone in a browser', `${rendered} tiles`);
  await page3.screenshot({ path: `${SHOTS}/06-export-rendered.png` });
  await page3.close();

  ok(text.includes('<path '), 'default export writes standalone paths');
}

// The same export in <use> mode — the compact form, where xlink:href matters.
{
  await page.locator('#p-flatten').uncheck();
  await settle();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator('#export').click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  writeFileSync(`${SHOTS}/export-use.svg`, text);

  const uses = (text.match(/<use /g) ?? []).length;
  ok(uses === 559, '<use> export contains every tile', `${uses} <use> elements`);
  const xlinks = (text.match(/xlink:href="#tile-/g) ?? []).length;
  ok(xlinks === 559, 'every <use> carries xlink:href for Illustrator', `${xlinks} found`);
  ok(!/hsl\(/.test(text), '<use> export also uses hex colours');

  const page4 = await ctx.newPage();
  await page4.setContent(
    `<body style="margin:0">${text.replace(/^<\?xml[^>]*\?>\s*/, '')}</body>`,
  );
  ok((await page4.locator('svg g > use').count()) === 559,
    '<use> export re-renders standalone in a browser');
  await page4.close();

  await page.locator('#p-flatten').check();
  await settle();
}

ok(errors.length === 0, 'no console errors during the whole run',
  errors.slice(0, 5).join(' | '));

await browser.close();

console.log(`\n${checks - failures}/${checks} e2e checks passed`);
console.log(`screenshots in ${SHOTS}/\n`);
if (failures > 0) process.exit(1);
