// Record a video of each game from the moment it is opened: loading/title
// screen (~7 s, shows attract modes), start (Play/Start button, click, Enter,
// Space), then ~20 s of scripted play (mouse sweeps the paddle, Space every
// 2.4 s to relaunch a lost ball). Opened via file:// in headless Chrome.
//
// Frames come from the Chrome DevTools screencast with real timestamps and are
// encoded to H.264 MP4 (constant 30 fps) with the system ffmpeg. No audio:
// headless Chrome cannot capture game sound.
//
// Usage: node _harness/record.js [run ...]   ->  _videos/<run>.mp4
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { START_RE } = require('./smoke.js');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.VIDEO_OUT || path.join(ROOT, '_videos');
const FRAMES = process.env.FRAMES_DIR || path.join(OUT, '.frames');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1920, H = 1080, FPS = 30;
const TITLE_MS = 7000, PLAY_STEPS = 100, STEP_MS = 200, RELAUNCH_EVERY = 12;
const ALL = ['opus_low', 'opus_medium', 'opus_high', 'opus_xhigh', 'opus_max',
             'fable_low', 'fable_medium', 'fable_high', 'fable_xhigh', 'fable_max'];
const runs = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const FPS_PROBE = `(() => {
  let n = 0, last = performance.now(); window.__fpsLog = [];
  const raf = window.requestAnimationFrame.bind(window);
  (function tick(t) { n++; if (t - last >= 1000) { window.__fpsLog.push(Math.round(n * 1000 / (t - last))); n = 0; last = t; } raf(tick); })(performance.now());
})();`;

async function record(browser, run) {
  const fdir = path.join(FRAMES, run.replace(/\//g, '_'));
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(FPS_PROBE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('uncaught: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Unsafe attempt to load URL file:/i.test(m.text())) errors.push('console.error: ' + m.text()); });

  await page.goto('data:text/html,<body style="margin:0;background:#000"></body>');
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(fdir, file), Buffer.from(data, 'base64'));
    frames.push({ file, ts: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

  const url = 'file://' + path.join(ROOT, run, 'index.html');
  let clicked = null;
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(TITLE_MS);

  // Start the game.
  const cx = W / 2, cy = H / 2;
  await page.mouse.move(cx, cy);
  const cands = page.locator('button, [role=button], a, .btn, .button, [data-action]');
  const n = await cands.count();
  for (let i = 0; i < n; i++) {
    const el = cands.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const t = ((await el.innerText().catch(() => '')) || '').trim();
    if (START_RE.test(t)) { clicked = t.split('\n')[0].slice(0, 40); await el.click({ timeout: 2000 }).catch(() => {}); break; }
  }
  await page.waitForTimeout(800);
  await page.mouse.click(cx, cy); await page.waitForTimeout(400);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await page.keyboard.press('Space');

  // Scripted play.
  for (let i = 0; i < PLAY_STEPS; i++) {
    await page.mouse.move(cx + Math.sin(i / 4) * cx * 0.55, H * 0.88);
    if (i % RELAUNCH_EVERY === RELAUNCH_EVERY - 1) await page.keyboard.press('Space');
    await page.waitForTimeout(STEP_MS);
  }
  const fpsLog = await page.evaluate(() => window.__fpsLog || []).catch(() => []);
  const stopTs = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await page.waitForTimeout(200);
  await ctx.close();

  // Encode: per-frame durations from real timestamps -> constant 30 fps H.264.
  if (frames.length < 2) throw new Error(`${run}: only ${frames.length} frames captured`);
  const lines = ['ffconcat version 1.0'];
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? frames[i + 1].ts : Math.max(stopTs, frames[i].ts + 1 / FPS);
    lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, next - frames[i].ts).toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(path.join(fdir, 'list.ffconcat'), lines.join('\n') + '\n');
  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join(OUT, `${run.replace(/\//g, '_')}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(fdir, 'list.ffconcat'),
    '-vf', `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', mp4]);
  const span = frames[frames.length - 1].ts - frames[0].ts;
  const capFps = (frames.length - 1) / Math.max(span, 0.001);
  fs.rmSync(fdir, { recursive: true, force: true });
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  return { run, mp4, frames: frames.length, capture_fps: +capFps.toFixed(1), game_raf_fps_median: median(fpsLog), game_raf_fps_min: fpsLog.length ? Math.min(...fpsLog) : null, clicked, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const results = [];
  for (const run of runs) {
    try {
      const r = await record(browser, run);
      results.push(r);
      console.log(`${run.padEnd(13)} frames=${r.frames} capture_fps=${r.capture_fps} game_fps(median/min)=${r.game_raf_fps_median}/${r.game_raf_fps_min} clicked=${r.clicked || '-'} errors=${r.errors.length}${r.errors.length ? '\n    ' + r.errors.join('\n    ') : ''}`);
    } catch (e) {
      results.push({ run, failed: String(e.message) });
      console.log(`${run.padEnd(13)} FAILED: ${e.message}`);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const rp = path.join(OUT, 'recordings.json');
  const prev = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : [];
  const byRun = new Map(prev.map((r) => [r.run, r]));
  for (const r of results) byRun.set(r.run, r);
  fs.writeFileSync(rp, JSON.stringify([...byRun.values()], null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
