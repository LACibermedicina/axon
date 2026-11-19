// Maestro: avatar 3D (Three.js) gamificado, móvel na tela, com opção de silenciar.
// Responde dúvidas contextuais usando um RESUMO MUSICAL da composição aberta (sem dados pessoais — LGPD).
import * as THREE from "three";
import { h } from "../core/ui";
import { api, currentUser } from "../core/api";
import { store } from "../core/store";
import { lang } from "../core/i18n";

const TIPS = [
  "Clique na faixa numerada dos compassos para selecioná-los; Shift seleciona um intervalo. Depois use ✨ Harmonizar seleção.",
  "Arraste uma figura (♩ ♪) da paleta direto para a pauta para criar a nota exatamente onde soltar.",
  "Shift + arrastar muda a nota em semitons; sem Shift ela anda pelas notas da tonalidade.",
  "A barrinha colorida atrás de cada nota mostra a duração real — ótimo para treinar leitura rítmica!",
  "Compassos sem notas? Clique em ● Gravar trecho: eu conto 1-2-3-4 e você grava só o que falta.",
  "Na cifra, 7M = sétima maior, m7(b5) = meio-diminuto e /B indica o baixo invertido.",
];
let xp = Number(sessionStorage.getItem("maestro.xp") || 0);

export function mountAvatar() {
  const wrap = h("div", { class: "avatar-wrap", role: "complementary", "aria-label": "Assistente Maestro" });
  const canvasBox = h("div", { class: "avatar-3d", title: "Arraste-me • clique para conversar" });
  const bubble = h("div", { class: "bubble", hidden: true });
  const muteBtn = h("button", { class: "ic-btn mute", title: "Silenciar Maestro", "aria-pressed": "false" }, "🔊");
  const level = h("div", { class: "xp" });
  const ask = h("form", { class: "ask", hidden: true }, h("input", { placeholder: "Pergunte ao Maestro…", maxlength: 500 }), h("button", { class: "btn primary" }, "→"));
  wrap.append(bubble, ask, canvasBox, h("div", { class: "avatar-ctl" }, level, muteBtn));
  document.body.append(wrap);
  let muted = localStorage.getItem("maestro.muted") === "1";

  // ---------------------------------------------------------- cena 3D
  const W = 120, H = 120;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(W, H);
  canvasBox.append(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, 0.25, 5.2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8866cc, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff88cc, 1.4); rim.position.set(-3, 1, -2); scene.add(rim);
  const toon = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05 });
  const bot = new THREE.Group(); scene.add(bot);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), toon(0x9b7bff)); body.scale.set(1, 1.08, 0.95); bot.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 32), toon(0xfff1fb)); belly.position.set(0, -0.28, 0.6); belly.scale.set(1, 0.9, 0.5); bot.add(belly);
  const eyes: THREE.Mesh[] = [];
  for (const sx of [-0.34, 0.34]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 32), toon(0xffffff)); white.position.set(sx, 0.28, 0.78); bot.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), toon(0x1b1b2f)); pupil.position.set(sx, 0.28, 1.0); bot.add(pupil); eyes.push(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(sx + 0.05, 0.34, 1.11); bot.add(glint);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 12, 24, Math.PI), toon(0x3a1d4d)); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.02, 0.93); bot.add(mouth);
  const bow = new THREE.Group();
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 16), toon(0xff5d8f)); w.rotation.z = (s * Math.PI) / 2; w.position.set(s * 0.15, 0, 0); bow.add(w); }
  bow.position.set(0, -0.62, 0.78); bot.add(bow);
  const arm = new THREE.Group();
  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.1, 8), toon(0xfff4d6)); baton.position.y = 0.55; arm.add(baton);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), toon(0x6b4a2a)); arm.add(handle);
  arm.position.set(0.95, -0.15, 0.3); arm.rotation.z = -0.6; bot.add(arm);
  const notesG = new THREE.Group(); scene.add(notesG);
  for (let i = 0; i < 3; i++) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), toon([0xffb547, 0x5b8cff, 0x36c99a][i])); notesG.add(n); }

  let mx = 0, my = 0, talking = 0, t0 = performance.now();
  addEventListener("pointermove", (e) => { const r = canvasBox.getBoundingClientRect(); mx = Math.max(-1, Math.min(1, (e.clientX - r.left - W / 2) / 400)); my = Math.max(-1, Math.min(1, (e.clientY - r.top - H / 2) / 400)); });
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    bot.position.y = Math.sin(t * 2) * 0.06; bot.rotation.y = mx * 0.5; bot.rotation.x = my * 0.25;
    eyes.forEach((e, i) => { e.position.x = (i ? 0.34 : -0.34) + mx * 0.06; e.position.y = 0.28 - my * 0.05; });
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1; eyes.forEach((e) => (e.scale.y = blink));
    arm.rotation.z = -0.6 + Math.sin(t * (talking ? 9 : 2.2)) * (talking ? 0.5 : 0.18);
    mouth.scale.y = talking ? 0.6 + Math.abs(Math.sin(t * 14)) * 1.4 : 1;
    notesG.children.forEach((n, i) => { const a = t * 1.3 + (i * Math.PI * 2) / 3; n.position.set(Math.cos(a) * 1.45, 0.6 + Math.sin(a * 2) * 0.15, Math.sin(a) * 0.6); });
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  loop();

  // -------------------------------------------------------- comportamento
  function say(text: string, ms = 7000) {
    bubble.textContent = text; bubble.hidden = false; talking = 1;
    setTimeout(() => (talking = 0), Math.min(ms, 400 + text.length * 45));
    clearTimeout((bubble as any)._t); (bubble as any)._t = setTimeout(() => (bubble.hidden = true), ms);
    if (!muted && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = { pt: "pt-BR", en: "en-US", es: "es-ES", zh: "zh-CN", hi: "hi-IN" }[lang]; u.pitch = 1.3; u.rate = 1.05;
      speechSynthesis.speak(u);
    }
  }
  function gainXp(n: number) { xp += n; sessionStorage.setItem("maestro.xp", String(xp)); level.textContent = `Nv ${1 + Math.floor(xp / 50)} · ${xp % 50}/50 XP`; }
  gainXp(0);
  const setMute = () => { muteBtn.textContent = muted ? "🔇" : "🔊"; muteBtn.setAttribute("aria-pressed", String(muted)); localStorage.setItem("maestro.muted", muted ? "1" : "0"); if (muted) speechSynthesis?.cancel(); };
  muteBtn.onclick = () => { muted = !muted; setMute(); }; setMute();

  // arrastar o avatar pela tela
  let moved = false;
  canvasBox.addEventListener("pointerdown", (e) => {
    const r = wrap.getBoundingClientRect(); const ox = e.clientX - r.left, oy = e.clientY - r.top; moved = false;
    canvasBox.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { moved = true; wrap.style.left = Math.max(0, Math.min(innerWidth - 140, ev.clientX - ox)) + "px"; wrap.style.top = Math.max(30, Math.min(innerHeight - 160, ev.clientY - oy)) + "px"; wrap.style.right = "auto"; wrap.style.bottom = "auto"; };
    const up = () => { canvasBox.removeEventListener("pointermove", mv); canvasBox.removeEventListener("pointerup", up); if (!moved) { ask.hidden = !ask.hidden; if (!ask.hidden) (ask.querySelector("input") as HTMLInputElement).focus(); } };
    canvasBox.addEventListener("pointermove", mv); canvasBox.addEventListener("pointerup", up);
  });
  ask.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = ask.querySelector("input") as HTMLInputElement; const q = inp.value.trim(); if (!q) return;
    inp.value = ""; say("Hmm, deixa eu pensar… 🎼", 20000);
    const s = store.score;
    const summary = { title: s.title, tempo: s.tempo, timeSig: s.timeSig, keySig: s.keySig, measures: s.measures,
      chords: s.chords.map((c) => c.map((x) => x.symbol).join(" ")), layers: s.layers.map((l) => ({ name: l.name, kind: l.kind, notes: l.notes.length })),
      selectedMeasures: [...store.selectedMeasures] };
    if (!currentUser) { say(TIPS[Math.floor(Math.random() * TIPS.length)] + " (Entre na conta para eu responder perguntas livres.)", 9000); return; }
    try { const r = await api("/api/ai/assistant", { method: "POST", json: { question: q, lang, score_summary: summary } }); say(r.answer, 14000); gainXp(5); }
    catch (err: any) { say("Não consegui falar com a IA agora: " + err.message); }
  });
  // gamificação: reage a conquistas no editor
  let lastCount = 0;
  store.on((r) => {
    if (r === "harmonize") { say("Bravo! 👏 Harmonia nova. Ouça e ajuste as vozes arrastando as notas.", 6000); gainXp(10); }
    if (r === "add") { const c = store.score.layers.reduce((a, l) => a + l.notes.length, 0); if (Math.floor(c / 10) > Math.floor(lastCount / 10)) { say(`${c} notas! Sua melodia está tomando forma. 🎶`, 4000); gainXp(3); } lastCount = c; }
    if (r === "merge") { say("Transcrição pronta! Confira cada camada no Gestor de Camadas.", 6000); gainXp(8); }
  });
  setTimeout(() => say("Olá! Eu sou o Maestro. Arraste-me pela tela, ou clique para tirar dúvidas. " + TIPS[0], 9000), 1200);
  setInterval(() => { if (bubble.hidden && !muted) say("Dica: " + TIPS[Math.floor(Math.random() * TIPS.length)], 8000); }, 120000);
}
