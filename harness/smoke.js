// Headless smoke test: does each game load and start without errors?
// Opens every <run>/index.html via file:// (how a person double-clicks it) in
// headless Chrome, waits on the title screen, then tries to start a game
// generically (Play/Start button, click, Enter, Space, mouse sweep).
// Records uncaught exceptions, console errors and failed requests per phase.
// Read-only with respect to the games. Output: <root>/_smoke/
//
// Usage: node _harness/smoke.js [run ...]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.SMOKE_OUT || path.join(ROOT, '_smoke');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ALL = ['opus_low', 'opus_medium', 'opus_high', 'opus_xhigh', 'opus_max',
             'fable_low', 'fable_medium', 'fable_high', 'fable_xhigh', 'fable_max'];
const runs = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

// Messages Chrome itself emits for file:// pages; not game bugs.
const BENIGN = [/Unsafe attempt to load URL file:/i, /favicon\.ico/i];
const isBenign = (s) => BENIGN.some((re) => re.test(s));
const START_RE = /^\s*(▶\s*)?(play|start|new game|new run|begin|campaign|launch|dive|descend|tap to (start|play)|press start|click to (start|play))\b/i;
module.exports = { START_RE };

async function smoke(browser, run) {
  const dir = path.join(OUT, run);
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let phase = 'load';
  const issues = [];
  page.on('pageerror', (e) => issues.push({ phase, kind: 'uncaught exception',
    msg: String(e.message), stack: String(e.stack || '').split('\n').slice(0, 4).join('\n') }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location();
    issues.push({ phase, kind: 'console.error', msg: m.text(),
      stack: loc && loc.url ? `${path.basename(loc.url)}:${loc.lineNumber}:${loc.columnNumber}` : '' });
  });
  page.on('requestfailed', (r) => issues.push({ phase, kind: 'request failed',
    msg: `${r.url()} (${(r.failure() || {}).errorText})` }));

  const url = 'file://' + path.join(ROOT, run, 'index.html');
  const res = { run, url, title: '', clicked: null, issues };
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    res.title = await page.title();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(dir, '1_load.png') });

    phase = 'start+play';
    const vp = page.viewportSize();
    const cx = vp.width / 2, cy = vp.height / 2;
    await page.mouse.move(cx, cy);
    const cands = page.locator('button, [role=button], a, .btn, .button, [data-action]');
    const n = await cands.count();
    for (let i = 0; i < n; i++) {
      const el = cands.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const t = ((await el.innerText().catch(() => '')) || '').trim();
      if (START_RE.test(t)) {
        res.clicked = t.split('\n')[0].slice(0, 40);
        await el.click({ timeout: 2000 }).catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(800);
    await page.mouse.click(cx, cy); await page.waitForTimeout(500);
    await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    await page.keyboard.press('Space'); await page.waitForTimeout(800);
    await page.mouse.click(cx, vp.height * 0.85); await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(cx + Math.sin(i / 3) * cx * 0.6, vp.height * 0.85);
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: path.join(dir, '2_play.png') });
  } catch (e) {
    issues.push({ phase, kind: 'harness error', msg: String(e.message).split('\n')[0] });
  }
  await ctx.close();
  res.real = issues.filter((x) => !isBenign(x.msg));
  res.benign = issues.filter((x) => isBenign(x.msg));
  return res;
}

function contactSheet(results, shot, label) {
  const tiles = results.map((r) => {
    const bad = r.real.length ? `<b style="color:#ff5370">${r.real.length} ERROR(S)</b>` : '<b style="color:#7ee787">no errors</b>';
    return `<figure><img src="${r.run}/${shot}"><figcaption>${r.run} — ${bad}${r.clicked ? ` · clicked “${r.clicked}”` : ''}</figcaption></figure>`;
  }).join('\n');
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#111;color:#ddd;font:15px system-ui;padding:10px}
    h1{font-size:18px;margin:4px 0 10px}
    .g{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    figure{margin:0}img{width:100%;display:block;border:1px solid #333}
    figcaption{padding:4px 2px}
  </style><h1>${label}</h1><div class="g">${tiles}</div>`;
}

if (require.main === module) (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const results = [];
  for (const run of runs) {
    const r = await smoke(browser, run);
    results.push(r);
    console.log(`${run.padEnd(13)} ${r.real.length ? 'FAIL' : 'ok  '}  real=${r.real.length} benign=${r.benign.length}  title="${r.title}"${r.clicked ? `  clicked="${r.clicked}"` : ''}`);
    for (const x of r.real) console.log(`    [${x.phase}] ${x.kind}: ${x.msg}${x.stack ? '\n      ' + x.stack.replace(/\n/g, '\n      ') : ''}`);
  }
  // Merge with earlier results so re-testing a subset keeps the full picture.
  const rp = path.join(OUT, 'results.json');
  const prev = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : [];
  const byRun = new Map(prev.map((r) => [r.run, r]));
  for (const r of results) byRun.set(r.run, r);
  const order = (r) => { const i = ALL.indexOf(r.run); return i < 0 ? 99 : i; };
  results.splice(0, results.length, ...[...byRun.values()].sort((a, b) => order(a) - order(b)));
  fs.writeFileSync(rp, JSON.stringify(results, null, 2));
  for (const [shot, label] of [['1_load.png', 'After load (3 s on title screen)'], ['2_play.png', 'After start attempt + ~6 s of play']]) {
    const html = path.join(OUT, `sheet_${shot.replace('.png', '')}.html`);
    fs.writeFileSync(html, contactSheet(results, shot, label));
    const ctx = await browser.newContext({ viewport: { width: 2400, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('file://' + html);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, `sheet_${shot}`), fullPage: true });
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
