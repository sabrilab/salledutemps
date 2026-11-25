import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const [,, view = 'front', mood = 'nuit', out = 'shots/x.png', w = 1280, h = 720] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', m => logs.push(m.type() + ' ' + m.text())); p.on('pageerror', e => logs.push('ERR ' + e.message));
await p.goto(`http://localhost:5173/?shot=1&view=${view}&mood=${mood}&n=${process.env.N||90}`);
try { await Promise.race([p.waitForFunction(() => window.__ready, null, { timeout: 240000 }), new Promise((_, rej) => p.on('pageerror', rej))]); } catch (e) { logs.push('TIMEOUT'); }
await p.screenshot({ path: out });
console.log(logs.filter(l => !/vite/.test(l)).slice(0, 15).join('\n'));
await b.close();
