const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', e => console.log('ERR', e.message, (e.stack || '').slice(0, 300)));
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.min.js')) return r.fulfill({ body: fs.readFileSync('/home/claude/ext/three/build/three.min.js', 'utf8'), contentType: 'application/javascript' }); if (u.startsWith('http://localhost')) return r.continue(); return r.abort(); });
  await p.goto('http://localhost:8765/simulador.html'); await p.waitForTimeout(4000);
  await p.evaluate(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)); for(let i=0;i<120&&!(AxonStage.reflexState()&&AxonStage.sceneInfo().S.meshByLayer&&AxonStage.sceneInfo().S.meshByLayer.organs);i++) await w(500); AxonStage.setLayer("muscles",true); for(let i=0;i<80&&!AxonStage.ext().S.musclesReady;i++) await w(500); AxonStage.setLayer("muscles",false); document.querySelector('.bot3d,#bot3d')&&(document.querySelector('.bot3d,#bot3d').style.display='none'); return 1})()`);
  await p.evaluate(fs.readFileSync(__dirname + '/capkit.js', 'utf8'));
  const scenes = require(process.argv[2] || __dirname + '/scenes.js'); const only = process.argv[3];
  for (const s of scenes) { if (only && !only.split(',').includes(s.id)) continue;
    const t0 = Date.now(); await p.evaluate(s.setup); await p.waitForTimeout(s.wait || 2500);
    const r = await p.evaluate(`(()=>{ const A=(${s.anns})(); return CK.capture(${s.W || 1600}, ${s.H || 1000}, A, ${JSON.stringify(s.cam || null)}); })()`);
    fs.writeFileSync(`${process.env.OUT || '/tmp/cap'}/${s.id}.png`, Buffer.from(r.url.split(',')[1], 'base64')); fs.writeFileSync(`${process.env.OUT || '/tmp/cap'}/${s.id}.json`, JSON.stringify(r.anns, null, 1));
    console.log(s.id, r.anns.length, r.anns.filter(a => !a.vis).map(a => a.t).join('|'), (Date.now() - t0) + 'ms'); }
  await b.close();
})();
