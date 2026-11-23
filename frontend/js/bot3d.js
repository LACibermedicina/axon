/* axon · bot3d.js — Axon Bot como personagem 3D.
   Robô-neurônio com viseira e olhos luminosos, antena com "nó de Ranvier" que brilha ao falar e uma cauda
   de mielina que segue o corpo com atraso. Arrastável; tem comportamento autônomo: olha para o cursor,
   pisca, passeia pelas bordas da tela quando ninguém mexe nele, reage a seleções, acena, cochila e acorda.
   O balão de fala fica colado à cabeça, do lado com mais espaço, com a ponta apontando para o bot. */
(function (g) {
  "use strict";
  const T = g.THREE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const lin = h => new T.Color(h).convertSRGBToLinear();

  function init(root, opts = {}) {
    if (!T || !root) return null;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = () => innerWidth <= 600;
    const SIZE = () => small() ? { w: 92, h: 104 } : { w: 132, h: 150 };
    root.innerHTML = `<canvas class="botgl" aria-hidden="true"></canvas><div class="bubble" role="status" aria-live="polite"><span class="txt"></span></div><button class="botmute" aria-label="Silenciar o Axon Bot">🔊</button><span class="zzz" aria-hidden="true">z<i>z</i><b>z</b></span>`;
    const canvas = root.querySelector("canvas"), bubble = root.querySelector(".bubble"), txt = bubble.querySelector(".txt"), muteBtn = root.querySelector(".botmute");

    // ---------- renderização
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, .35, 6.2); cam.lookAt(0, .25, 0);
    scene.add(new T.HemisphereLight(0xdff6ff, 0x24343a, .85));
    const key = new T.DirectionalLight(0xfff0de, 1.25); key.position.set(-2.5, 4, 4); scene.add(key);
    const rim = new T.DirectionalLight(0x5ff0ff, .9); rim.position.set(3, 2, -3); scene.add(rim);
    { const c = document.createElement("canvas"); c.width = 128; c.height = 64; const x = c.getContext("2d"), gr = x.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, "#d9f6ff"); gr.addColorStop(.5, "#f3e2d2"); gr.addColorStop(.55, "#3a4a50"); gr.addColorStop(1, "#0d1416"); x.fillStyle = gr; x.fillRect(0, 0, 128, 64);
      const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding; const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); }

    const M = {
      shell: new T.MeshPhysicalMaterial({ color: 0xf4f7f6, roughness: .28, clearcoat: 1, clearcoatRoughness: .12 }),
      teal: new T.MeshPhysicalMaterial({ color: 0x23c7a8, roughness: .35, clearcoat: .8 }),
      visor: new T.MeshPhysicalMaterial({ color: 0x0b1c22, roughness: .08, metalness: .2, clearcoat: 1 }),
      eye: new T.MeshBasicMaterial({ color: lin("#7ff7e0"), toneMapped: false }),
      glow: new T.MeshBasicMaterial({ color: lin("#ffd36b"), toneMapped: false }),
      myelin: new T.MeshPhysicalMaterial({ color: 0xe9f3ff, roughness: .25, clearcoat: 1 }),
      dark: new T.MeshStandardMaterial({ color: 0x2b3a40, roughness: .5 }),
    };
    const bot = new T.Group(); scene.add(bot);
    const body = new T.Mesh(new T.SphereGeometry(.62, 40, 30), M.shell); body.scale.set(1, 1.08, .92); body.position.y = -.35; bot.add(body);
    const belly = new T.Mesh(new T.SphereGeometry(.4, 32, 20, 0, Math.PI * 2, 0, Math.PI * .55), M.teal); belly.rotation.x = Math.PI / 2; belly.position.set(0, -.38, .38); belly.scale.set(1, .5, .9); bot.add(belly);
    const headPivot = new T.Group(); headPivot.position.y = .38; bot.add(headPivot);
    const head = new T.Mesh(new T.SphereGeometry(.68, 44, 32), M.shell); head.scale.set(1.12, .92, 1); head.position.y = .3; headPivot.add(head);
    const visor = new T.Mesh(new T.SphereGeometry(.7, 40, 28, Math.PI * .5 - Math.PI * .36, Math.PI * .72, Math.PI * .3, Math.PI * .4), M.visor); visor.scale.set(1.12, .93, 1.02); visor.position.y = .3; headPivot.add(visor);
    const eyes = [-1, 1].map(s => { const e = new T.Mesh(T.CapsuleGeometry ? new T.CapsuleGeometry(.075, .12, 6, 12) : new T.SphereGeometry(.1, 16, 12), M.eye); e.position.set(s * .23, .33, .7); e.scale.set(1, 1.25, .5); headPivot.add(e); return e; });
    const mouth = new T.Group(); mouth.position.set(0, .12, .7); headPivot.add(mouth);
    const bars = [-2, -1, 0, 1, 2].map(i => { const b = new T.Mesh(new T.BoxGeometry(.045, .04, .02), M.eye); b.position.x = i * .07; mouth.add(b); return b; });
    const stem = new T.Mesh(new T.CylinderGeometry(.025, .03, .42, 10), M.dark); stem.position.set(.12, 1.12, 0); stem.rotation.z = -.18; headPivot.add(stem);
    const node = new T.Mesh(new T.SphereGeometry(.1, 20, 14), M.glow); node.position.set(.17, 1.35, 0); headPivot.add(node);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,230,150,1)"); gr.addColorStop(.4, "rgba(255,200,90,.45)"); gr.addColorStop(1, "rgba(255,200,90,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; })(), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(.6); node.add(halo);
    const ears = [-1, 1].map(s => { const e = new T.Mesh(new T.CylinderGeometry(.16, .16, .1, 24), M.teal); e.rotation.z = Math.PI / 2; e.position.set(s * .76, .3, 0); headPivot.add(e); return e; });
    const arms = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * .58, -.18, 0); const a = new T.Mesh(new T.SphereGeometry(.15, 20, 14), M.shell); a.scale.set(.85, 1.45, .85); a.position.y = -.17; p.add(a); bot.add(p); return p; });
    const jet = new T.Sprite(new T.SpriteMaterial({ map: halo.material.map, color: 0x7ff7e0, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: .7 })); jet.position.y = -1.08; jet.scale.set(.7, .45, 1); bot.add(jet);
    // cauda de mielina (segue com atraso, como um axônio)
    const tail = [0, 1, 2, 3].map(i => { const m = new T.Mesh(new T.SphereGeometry(.11 - i * .018, 16, 12), i % 2 ? M.teal : M.myelin); m.scale.set(1, 1, 1.4); scene.add(m); return { m, p: new T.Vector3(0, -.95 - i * .2, -.2) }; });
    const shadow = new T.Mesh(new T.CircleGeometry(.55, 32), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.45; scene.add(shadow);

    // ---------- posição na tela, arraste e estado
    const S = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, mode: "idle", t: 0, lastUser: performance.now(), autoPause: 0, blink: 0, nextBlink: 2, talkUntil: 0, wave: 0, hop: 0, spin: 0, look: { x: 0, y: 0 }, muted: false, sleeping: false, next: 14 };
    const sz = () => SIZE();
    function bounds() { const { w, h } = sz(); return { minX: 6, maxX: innerWidth - w - 6, minY: 44, maxY: innerHeight - h - (small() ? 70 : 86) }; }
    function place() { const b = bounds(); S.x = clamp(S.x, b.minX, b.maxX); S.y = clamp(S.y, b.minY, b.maxY); root.style.left = S.x + "px"; root.style.top = S.y + "px"; placeBubble(); }
    function size() { const { w, h } = sz(); renderer.setSize(w, h, false); canvas.style.width = w + "px"; canvas.style.height = h + "px"; root.style.width = w + "px"; root.style.height = h + "px"; cam.aspect = w / h; cam.updateProjectionMatrix(); }
    try { const p = JSON.parse(localStorage.getItem("axon.bot.pos") || "null"); if (p) { S.x = p.x * innerWidth; S.y = p.y * innerHeight; } } catch (e) {}
    size(); if (!S.x) { const b = bounds(); S.x = b.maxX - 6; S.y = b.maxY; } S.tx = S.x; S.ty = S.y; place();
    addEventListener("resize", () => { size(); place(); });
    const save = () => { try { localStorage.setItem("axon.bot.pos", JSON.stringify({ x: S.x / innerWidth, y: S.y / innerHeight })); } catch (e) {} };

    let drag = null;
    canvas.addEventListener("pointerdown", e => { drag = { dx: e.clientX - S.x, dy: e.clientY - S.y, sx: e.clientX, sy: e.clientY, moved: 0, px: e.clientX, py: e.clientY }; canvas.setPointerCapture(e.pointerId); root.classList.add("drag"); wake(); });
    canvas.addEventListener("pointermove", e => { if (!drag) return; const nx = e.clientX - drag.dx, ny = e.clientY - drag.dy; S.vx = (e.clientX - drag.px); S.vy = (e.clientY - drag.py); drag.px = e.clientX; drag.py = e.clientY;
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy)); S.x = S.tx = nx; S.y = S.ty = ny; place(); });
    canvas.addEventListener("pointerup", e => { if (!drag) return; const click = drag.moved < 5; drag = null; root.classList.remove("drag"); S.autoPause = performance.now() + 40000; S.mode = "idle"; save();
      if (click) { S.wave = 1.4; opts.onClick && opts.onClick(); } else { S.hop = .6; } });
    canvas.addEventListener("pointerenter", () => { S.hover = true; if (!S.sleeping) S.wave = Math.max(S.wave, 1); wake(); });
    canvas.addEventListener("pointerleave", () => { S.hover = false; });
    const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; S.lastUser = performance.now(); if (S.sleeping && Math.hypot(e.clientX - S.x - sz().w / 2, e.clientY - S.y - sz().h / 2) < 220) wake(true); }, { passive: true });
    addEventListener("keydown", () => { S.lastUser = performance.now(); });
    muteBtn.onclick = e => { e.stopPropagation(); S.muted = !S.muted; root.classList.toggle("muted", S.muted); muteBtn.textContent = S.muted ? "🔇" : "🔊"; if (S.muted) hideBubble(); opts.onMute && opts.onMute(S.muted); };
    function wake(startle) { if (S.sleeping) { S.sleeping = false; root.classList.remove("sleep"); if (startle) S.hop = .8; } S.lastUser = performance.now(); }

    // ---------- balão de fala
    let bubbleTimer;
    function placeBubble() {
      if (!root.classList.contains("talk")) return;
      const { w } = sz(), bw = Math.min(260, innerWidth - 24), room = { l: S.x, r: innerWidth - S.x - w };
      const side = room.l > room.r ? "l" : "r"; bubble.style.width = bw + "px";
      bubble.classList.toggle("l", side === "l"); bubble.classList.toggle("r", side === "r");
      bubble.style.left = side === "l" ? (-bw + 6) + "px" : (w - 6) + "px";
      const bh = bubble.offsetHeight || 60; let top = sz().h * .12 - bh * .35; // ponta na altura da cabeça
      top = clamp(top, -S.y + 48, innerHeight - S.y - bh - 12); bubble.style.top = top + "px";
      bubble.style.setProperty("--tail", clamp(sz().h * .3 - top, 14, bh - 14) + "px");
    }
    function say(s, ms) {
      if (S.muted || !s) return; wake(); txt.textContent = s; root.classList.add("talk"); placeBubble(); requestAnimationFrame(placeBubble);
      const dur = ms || clamp(2600 + s.length * 45, 3200, 9000); S.talkUntil = performance.now() + Math.min(dur, 2600 + s.length * 30); S.hop = Math.max(S.hop, .35);
      clearTimeout(bubbleTimer); bubbleTimer = setTimeout(hideBubble, dur);
    }
    function hideBubble() { root.classList.remove("talk"); }
    bubble.addEventListener("click", () => { hideBubble(); opts.onClick && opts.onClick(); });

    // ---------- comportamento autônomo
    const SPOTS = () => { const b = bounds(); return [[b.maxX, b.maxY], [b.minX + 300, b.maxY], [b.maxX, (b.minY + b.maxY) * .5], [b.maxX - 260, b.maxY], [b.minX + 40, b.maxY], [(b.minX + b.maxX) / 2 + 180, b.maxY]].map(([x, y]) => [clamp(x, b.minX, b.maxX), clamp(y, b.minY, b.maxY)]); };
    function wander() { const s = SPOTS(), c = s.filter(([x, y]) => Math.hypot(x - S.x, y - S.y) > 120); const p = (c.length ? c : s)[Math.floor(Math.random() * (c.length || s.length))]; S.tx = p[0]; S.ty = p[1]; S.mode = "fly"; }
    function react(kind) { wake(); S.hop = .7; if (kind === "spin") S.spin = 1; else S.wave = 1.2; }

    const tmp = new T.Vector3(); let last = performance.now(), acc = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(.05, (now - last) / 1000); last = now; acc += dt; if (acc < 1 / 40) return; const d = acc; acc = 0; S.t += d;
      const idleFor = (now - S.lastUser) / 1000;
      // dormir após 90 s sem interação; passear de vez em quando
      if (!S.sleeping && idleFor > 90 && !drag && !root.classList.contains("talk")) { S.sleeping = true; root.classList.add("sleep"); S.mode = "idle"; }
      if (!reduce && !small() && !drag && !S.sleeping && now > S.autoPause && S.mode === "idle" && !S.hover) { S.next -= d; if (S.next <= 0) { S.next = 16 + Math.random() * 18; if (idleFor > 6) wander(); } }
      if (S.mode === "fly" && !drag) {
        const ax = (S.tx - S.x) * 2.2 - S.vx * 2.4, ay = (S.ty - S.y) * 2.2 - S.vy * 2.4; S.vx += ax * d; S.vy += ay * d; S.x += S.vx * d * 2; S.y += S.vy * d * 2;
        if (Math.hypot(S.tx - S.x, S.ty - S.y) < 2 && Math.hypot(S.vx, S.vy) < 8) { S.mode = "idle"; S.vx = S.vy = 0; save(); }
        place();
      } else if (!drag) { S.vx *= .85; S.vy *= .85; }
      // olhar para o cursor (ou para o palco quando dorme)
      const cx = S.x + sz().w / 2, cy = S.y + sz().h * .3; let lx = clamp((mouse.x - cx) / 500, -1, 1), ly = clamp((mouse.y - cy) / 400, -1, 1);
      if (S.sleeping) { lx = 0; ly = .5; }
      S.look.x = lerp(S.look.x, lx, .12); S.look.y = lerp(S.look.y, ly, .12);
      headPivot.rotation.y = S.look.x * .65; headPivot.rotation.x = S.look.y * .35 + (S.sleeping ? .25 : 0);
      // corpo: flutuação, inclinação pela velocidade, pulo e giro
      const bob = S.sleeping ? Math.sin(S.t * 1.1) * .04 : Math.sin(S.t * 2.2) * .07;
      S.hop = Math.max(0, S.hop - d * 1.6); const hopY = Math.sin(Math.min(1, S.hop) * Math.PI) * .35 * (S.hop > 0 ? 1 : 0);
      bot.position.y = bob + hopY; bot.rotation.z = clamp(-S.vx * .012, -.5, .5) + Math.sin(S.t * 1.3) * .03; bot.rotation.x = clamp(S.vy * .008, -.35, .35);
      if (S.spin > 0) { S.spin = Math.max(0, S.spin - d * 1.4); bot.rotation.y = (1 - S.spin) * Math.PI * 2; } else bot.rotation.y = lerp(bot.rotation.y % (Math.PI * 2), S.look.x * .25, .1);
      // braços: aceno, balanço
      S.wave = Math.max(0, S.wave - d); const wv = S.wave > 0 ? Math.sin(S.t * 14) * .6 + .9 : 0;
      arms[0].rotation.z = -.15 - Math.sin(S.t * 2.2) * .06 + clamp(S.vx * .01, -.4, .4); arms[1].rotation.z = .15 + Math.sin(S.t * 2.2) * .06 + wv + clamp(S.vx * .01, -.4, .4);
      // olhos: piscar, fechados ao dormir
      S.nextBlink -= d; if (S.nextBlink <= 0) { S.blink = .16; S.nextBlink = 2 + Math.random() * 4; } S.blink = Math.max(0, S.blink - d);
      const open = S.sleeping ? .12 : (S.blink > 0 ? .15 : 1); eyes.forEach((e, i) => { e.scale.y = lerp(e.scale.y, 1.25 * open, .5); e.position.x = (i ? .23 : -.23) + S.look.x * .05; e.position.y = .33 - S.look.y * .04; e.position.z = .7; });
      // falar: barras da boca e nó da antena pulsando
      const talking = now < S.talkUntil; bars.forEach((b, i) => { b.scale.y = talking ? 1 + Math.abs(Math.sin(S.t * 16 + i * 1.7)) * 4 : lerp(b.scale.y, i === 2 ? 1.4 : 1, .2); b.visible = !S.sleeping; });
      const glowK = talking ? .8 + Math.abs(Math.sin(S.t * 10)) * .9 : (S.sleeping ? .25 : .55 + Math.sin(S.t * 2) * .15); halo.scale.setScalar(.35 + glowK * .5); M.glow.color.copy(lin(talking ? "#fff0b0" : "#ffd36b"));
      jet.material.opacity = S.mode === "fly" || drag ? .95 : .45 + Math.sin(S.t * 8) * .1; jet.scale.set(.7, .45 + (S.mode === "fly" ? .35 : 0), 1);
      // cauda segue com mola
      let prev = tmp.set(0, -.95, -.15).applyMatrix4(bot.matrixWorld);
      tail.forEach((s, i) => { const target = prev.clone().add(new T.Vector3(S.vx * .004, -.2 + S.vy * .003, -.05)); s.p.lerp(target, .35 - i * .05); s.m.position.copy(s.p); prev = s.p; });
      shadow.material.opacity = .22 - hopY * .3; shadow.scale.setScalar(1 - hopY * .5);
      renderer.render(scene, cam);
      if (root.classList.contains("talk")) placeBubble();
    }
    requestAnimationFrame(frame);
    return { say, hide: hideBubble, react, wander, wake, get muted() { return S.muted; } };
  }
  g.AxonBot3D = { init };
})(window);
