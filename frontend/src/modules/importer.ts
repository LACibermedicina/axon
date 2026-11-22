// Importação: áudio (recorte/ganho antes do envio), foto de partitura (recorte/rotação) e cifra em texto.
import { store, newLayer } from "../core/store";
import { h, toast, busy, tip } from "../core/ui";
import { runJob, upload, requireLogin, currentUser } from "../core/api";
import * as audio from "../core/audio";
import { parseCifraBars, voiceChords } from "../core/theory";
import { beatsPerMeasure, uid } from "../core/types";

// ------------------------------------------------ arrastar o trecho do Importar para a partitura
// O trecho recortado fica registrado aqui; a partitura dispara "harmonia:drop-audio" ao soltar.
interface Clip { buf: AudioBuffer; a: number; b: number; gainDb: number; name: string; mode: string; separate: boolean; lyrics: boolean }
const clips = new Map<string, Clip>();
addEventListener("harmonia:drop-audio", (e: Event) => { const d = (e as CustomEvent).detail; const c = clips.get(d.key); if (c) placeAudio(c, d.beat); });

/** Coloca o trecho como camada de gravação na posição (tempo) e transcreve em notas vinculadas a ela. */
async function placeAudio(c: Clip, startBeat: number) {
  const s = store.score, spb = 60 / s.tempo, bpm = beatsPerMeasure(s);
  const dur = c.b - c.a, link = uid();
  const m0 = Math.floor(startBeat / bpm), m1 = Math.floor((startBeat + dur / spb - 1e-6) / bpm);
  const wav = await audio.trimToWav(c.buf, c.a, c.b, c.gainDb);
  const rec = { ...newLayer("recording", `🎵 ${c.name.replace(/\.\w+$/, "")} (c.${m0 + 1})`), audioUrl: URL.createObjectURL(wav), audioOffset: startBeat * spb, audioDur: dur,
    measures: Array.from({ length: m1 - m0 + 1 }, (_, i) => m0 + i), link };
  store.mutate((sc) => { sc.layers.push(rec); sc.measures = Math.max(sc.measures, m1 + 1); while (sc.chords.length < sc.measures) sc.chords.push([]); store.selectedLayer = rec.id; }, "drop-audio");
  dispatchEvent(new CustomEvent("open-app", { detail: "compose" }));
  if (!currentUser) { toast("Trecho colocado na partitura como camada 🎙. Entre na conta para transformá-lo em notas.", "info", 6000); return; }
  toast(`Trecho no compasso ${m0 + 1}. Transcrevendo em notas…`, "info", 4000);
  try {
    const up = await upload("audio", wav, c.name.replace(/\.\w+$/, "") + "-trecho.wav");
    store.mutate(() => { const l = store.score.layers.find((x) => x.id === rec.id); if (l) l.audio = up.path; }, "upload");
    const r = await runJob("transcribe_audio", { asset: up.path, source_name: c.name, mode: c.mode, separate: c.separate, lyrics: c.lyrics, tempo: s.tempo, timeSig: s.timeSig });
    const made: string[] = [];
    store.mutate((sc) => {
      for (const nl of r.layers || []) {
        if (!nl.notes?.length) continue;
        const v = newLayer(nl.staff === "bass" ? "harmony" : (nl.kind || "voice"), `${nl.name || "Notas"} — ${rec.name.replace(/^🎵 /, "")}`, nl.staff === "bass" ? "bass" : "treble");
        v.notes = nl.notes.map((n: any) => ({ ...n, id: uid(), start: n.start + startBeat }));
        v.link = link; sc.layers.push(v); made.push(v.name);
        const last = Math.max(...v.notes.map((n) => n.start + n.dur));
        sc.measures = Math.max(sc.measures, Math.ceil(last / bpm));
      }
      while (sc.chords.length < sc.measures) sc.chords.push([]);
    }, "merge");
    toast(made.length ? `Notas criadas e vinculadas à gravação 🔗 (${made.join(" · ")}). Arraste o clipe 🎙 na pauta e as notas acompanham.` : "Gravação colocada; nenhuma nota reconhecida neste trecho.", made.length ? "ok" : "warn", 7000);
  } catch (e: any) { toast("Gravação colocada; transcrição indisponível: " + e.message, "warn", 6000); }
}
import { prefs } from "../core/prefs";

export function mountImporter(body: HTMLElement) {
  body.classList.add("importer");
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const panes = h("div", { class: "panes" });
  body.append(tabs, panes);
  const defs: [string, string, () => HTMLElement][] = [["audio", "🎵 Áudio ou 🎙 gravação", audioPane], ["image", "📷 Foto da partitura", imagePane], ["cifra", "🎸 Cifra", cifraPane]];
  const show = (id: string) => {
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    panes.querySelectorAll<HTMLElement>(".pane").forEach((p) => (p.hidden = p.dataset.pane !== id));
  };
  for (const [id, label, mk] of defs) {
    tabs.append(h("button", { role: "tab", "data-tab": id, onclick: () => show(id) }, label));
    const p = mk(); p.classList.add("pane"); p.dataset.pane = id; panes.append(p);
  }
  show(prefs.importTab || "audio");
  // pré-seleção vinda do passo a passo (aba e o que capturar)
  const applyPreset = (tab: string, mode: string) => {
    show(tab);
    panes.querySelectorAll<HTMLSelectElement>("[data-pane=audio] select").forEach((sel, i) => { if (i === 0) sel.value = mode === "melody" ? "melody" : "both"; });
  };
  applyPreset(prefs.importTab || "audio", prefs.captureMode);
  const onPreset = (e: Event) => { const d = (e as CustomEvent).detail; applyPreset(d.tab, d.mode); };
  addEventListener("import:preset", onPreset);
  // Servidor em modo leve: avisa antes do envio (transcrição de áudio/foto exige IA completa)
  fetch("/api/health").then((r) => r.json()).then((hc) => {
    if (hc.ai_full) return;
    panes.querySelectorAll<HTMLElement>('[data-pane="audio"], [data-pane="image"]').forEach((p) =>
      p.prepend(h("div", { class: "lyrics-check" }, p.dataset.pane === "audio"
        ? "ℹ️ Modo de IA leve: a transcrição extrai a melodia principal (voz ou instrumento solo) e estima os acordes. Separação de voz, polifonia e letra cantada exigem a IA completa."
        : "ℹ️ Modo de IA leve: a leitura de fotos de partitura (OMR) exige a IA completa e está desativada neste servidor.")));
  }).catch(() => {});
}

/** Leva o resultado para a tela de Composição como camada(s) nova(s) e mostra onde estão. */
function deliver(r: any, what: string, openCompose = true) {
  const ids = store.mergeResult(r);
  if (openCompose) {
    dispatchEvent(new CustomEvent("open-app", { detail: "compose" }));
    dispatchEvent(new CustomEvent("open-app", { detail: "layers" }));
  }
  const names = store.score.layers.filter((l) => ids.includes(l.id)).map((l) => `${l.name} (${l.notes.length} notas)`);
  if (!ids.length) toast(`${what}: nenhuma nota reconhecida. Tente recortar um trecho mais limpo ou ajustar o ganho.`, "warn", 7000);
  else toast(`${what} → ${ids.length} camada(s) na Composição: ${names.join(" · ")}`, "ok", 7000);
  if (r.notice) setTimeout(() => toast(r.notice, "info", 9000), 600);
  return ids;
}

function dropZone(accept: string, label: string, onFile: (f: File) => void) {
  const input = h("input", { type: "file", accept, hidden: true, onchange: (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onFile(f); } });
  const z = h("label", { class: "drop" }, input, h("div", { class: "drop-ic" }, "⇪"), h("b", {}, label), h("small", {}, "arraste e solte aqui ou clique para escolher"));
  z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("over"); });
  z.addEventListener("dragleave", () => z.classList.remove("over"));
  z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("over"); const f = e.dataTransfer?.files[0]; if (f) onFile(f); });
  return z;
}

// ------------------------------------------------------------------ ÁUDIO
function audioPane() {
  const p = h("div");
  let buf: AudioBuffer | null = null; let file: File | null = null;
  let a = 0, b = 0;
  const cv = h("canvas", { class: "wave", width: 900, height: 120 }) as HTMLCanvasElement;
  const info = h("div", { class: "hint" });
  const gain = h("input", { type: "range", min: -12, max: 12, step: 1, value: 0, "aria-label": "Ganho (dB)" }) as HTMLInputElement;
  const mode = h("select", {}, h("option", { value: "both" }, "Melodia + harmonia"), h("option", { value: "melody" }, "Somente melodia"), h("option", { value: "harmony" }, "Somente harmonia")) as HTMLSelectElement;
  const sep = h("input", { type: "checkbox", checked: true }) as HTMLInputElement;
  const lyr = h("input", { type: "checkbox", checked: true }) as HTMLInputElement;
  const tempo = h("input", { type: "number", placeholder: "auto", min: 30, max: 260, class: "num" }) as HTMLInputElement;
  const expected = h("textarea", { rows: 3, placeholder: "Opcional: cole a letra correta para conferir a transcrição do canto" }) as HTMLTextAreaElement;
  const go = h("button", { class: "btn primary go", disabled: true, title: "Envie ou grave um áudio primeiro" }, "✨ Transcrever para partitura") as HTMLButtonElement;
  const result = h("div", { class: "result" });
  // transporte da faixa importada: ouvir/pausar, parar, voltar/avançar 5 s e ponteiro arrastável na onda
  const SRC_ID = "import-audio";
  let ph = -1; // posição de reprodução (segundos da faixa)
  const playB = h("button", { class: "btn primary", "aria-label": "Ouvir trecho", onclick: () => togglePlay() }, "▶ Ouvir trecho") as HTMLButtonElement;
  const stopB = h("button", { class: "btn", "aria-label": "Parar", title: "Parar", onclick: () => { if (mine()) audio.stop(); ph = -1; draw(); } }, "■");
  const backB = h("button", { class: "btn", "aria-label": "Voltar 5 segundos", title: "Voltar 5 s", onclick: () => jump(-5) }, "⏪ 5s");
  const fwdB = h("button", { class: "btn", "aria-label": "Avançar 5 segundos", title: "Avançar 5 s", onclick: () => jump(5) }, "5s ⏩");
  const clock = h("span", { class: "hint mono", "aria-live": "off" }, "0:00");
  // ---- barra fixa no topo: fonte (arquivo / gravação ao vivo), transporte, opções e TRANSCREVER — sempre visíveis
  const fileIn = h("input", { type: "file", accept: "audio/*,video/webm", hidden: true, onchange: (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) load(f); } }) as HTMLInputElement;
  const pickB = tip(h("button", { class: "btn", onclick: () => fileIn.click() }, "📂 Arquivo"), "Escolher um arquivo de áudio (MP3, WAV, FLAC, M4A, OGG) — ou arraste para a área abaixo");
  let rec: { stop: () => Promise<Blob> } | null = null; let recT0 = 0; let recTimer = 0;
  const recB = tip(h("button", { class: "btn rec", onclick: () => toggleRec() }, "🎙 Gravar ao vivo"), "Grave agora pelo microfone (cante ou toque). Ao parar, a gravação aparece na onda para ouvir, recortar e transcrever.") as HTMLButtonElement;
  const resetB = tip(h("button", { class: "btn ghost", onclick: () => { if (buf) { a = 0; b = buf.duration; draw(); } } }, "↺ Recorte"), "Voltar a usar a faixa inteira");
  const viewB = h("button", { class: "btn", hidden: true, onclick: () => dispatchEvent(new CustomEvent("open-app", { detail: "visualizer" })) }, "👁 Ver transcrição") as HTMLButtonElement;
  // alça arrastável: solte o trecho sobre a partitura (no compasso desejado) — vira camada 🎙 + notas vinculadas
  const clipKey = "clip-" + Math.random().toString(36).slice(2, 8);
  const putClip = () => { if (buf) clips.set(clipKey, { buf, a, b, gainDb: +gain.value, name: file?.name || "faixa", mode: mode.value, separate: sep.checked, lyrics: lyr.checked }); };
  const dragB = tip(h("span", { class: "drag-clip", draggable: "true", hidden: true, role: "button", tabindex: "0", "aria-label": "Arrastar o trecho para a partitura" }, "⇲ Arraste o trecho para a partitura"),
    "Arraste e solte sobre a partitura, no compasso onde o trecho deve começar. Ele vira uma camada de gravação 🎙 e é transcrito em notas na mesma posição, vinculadas 🔗 (mover o áudio move as notas). Enter: coloca no compasso selecionado.") as HTMLElement;
  dragB.addEventListener("dragstart", (e) => { putClip(); e.dataTransfer!.setData("text/harmonia-audio", clipKey); e.dataTransfer!.effectAllowed = "copy"; });
  dragB.addEventListener("keydown", (e) => { if (e.key === "Enter" && buf) { putClip(); const sel = [...store.selectedMeasures].sort((x, y) => x - y); placeAudio(clips.get(clipKey)!, (sel[0] ?? 0) * beatsPerMeasure(store.score)); } });
  const bar = h("div", { class: "imp-bar" },
    h("div", { class: "imp-row" }, pickB, recB, h("i", { class: "imp-sep" }), backB, playB, stopB, fwdB, clock, h("span", { class: "spacer" }), dragB, viewB, go),
    h("div", { class: "imp-row opts" },
      h("label", { class: "inline" }, "Extrair ", mode), h("label", { class: "inline" }, "♩ ", tempo),
      tip(h("label", { class: "check" }, sep, " Separar voz"), "Isola a voz (Demucs) para transcrever como camada 'Voz' com letra e efeitos vocais"),
      h("label", { class: "check" }, lyr, " Letra cantada"),
      h("label", { class: "inline" }, "Ganho ", gain), resetB));
  const lyricsBox = h("details", { class: "imp-more" }, h("summary", {}, "Conferir com a letra correta (opcional)"), expected);
  const drop = dropZone("audio/*,video/webm", "Arraste um áudio aqui, escolha 📂 Arquivo ou use 🎙 Gravar ao vivo", load);
  const editor = h("div", { class: "trim", hidden: true }, cv, info, lyricsBox, result);
  p.classList.add("imp-pane");
  p.append(fileIn, bar, drop, editor);
  const setTransport = (on: boolean) => [playB, stopB, backB, fwdB, resetB].forEach((x) => ((x as HTMLButtonElement).disabled = !on));
  setTransport(false);
  async function toggleRec() {
    if (rec) {
      clearInterval(recTimer);
      const blob = await rec.stop(); rec = null;
      recB.classList.remove("recording"); recB.textContent = "🎙 Gravar ao vivo";
      await load(new File([blob], `gravacao-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.webm`, { type: blob.type || "audio/webm" }));
      toast("Gravação pronta: ouça, recorte e transcreva", "ok");
      return;
    }
    try {
      audio.stop();
      rec = await audio.record({ countInBeats: 0, spb: 0.5 });
      recT0 = performance.now(); recB.classList.add("recording");
      const tick = () => { const t = (performance.now() - recT0) / 1000; recB.textContent = `■ Parar (${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")})`; };
      tick(); recTimer = window.setInterval(tick, 500);
    } catch (e: any) { toast("Microfone indisponível: " + e.message, "error"); rec = null; }
  }

  async function load(f: File) {
    file = f;
    try { buf = await audio.decode(f); } catch { toast("Não foi possível ler este áudio", "error"); return; }
    if (audio.playerState().source?.id === SRC_ID) audio.stop();
    a = 0; b = buf.duration; ph = -1; editor.hidden = false; drop.hidden = true; setTransport(true);
    go.disabled = false; go.removeAttribute("title"); viewB.hidden = true; dragB.hidden = false; result.replaceChildren(); draw();
  }
  function draw() {
    if (!buf) return;
    const ctx = cv.getContext("2d")!; const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const pk = audio.peaks(buf, W / 3);
    pk.forEach((v, i) => {
      const x = i * 3, t = (x / W) * buf!.duration;
      ctx.fillStyle = t >= a && t <= b ? "#7c5cff" : "rgba(140,140,170,.35)";
      const hh = Math.max(2, v * H * 0.9); ctx.fillRect(x, (H - hh) / 2, 2, hh);
    });
    for (const t of [a, b]) { const x = (t / buf.duration) * W; ctx.fillStyle = "#ff5d8f"; ctx.fillRect(x - 2, 0, 4, H); ctx.beginPath(); ctx.arc(x, 8, 7, 0, 7); ctx.fill(); }
    if (ph >= 0) { // ponteiro de reprodução
      const x = (ph / buf.duration) * W;
      ctx.fillStyle = "#1db954"; ctx.fillRect(x - 1.5, 0, 3, H);
      ctx.beginPath(); ctx.moveTo(x - 8, H); ctx.lineTo(x + 8, H); ctx.lineTo(x, H - 12); ctx.fill();
    }
    clock.textContent = `${fmt(Math.max(0, ph))} / ${fmt(buf.duration)}`;
    info.textContent = `${file?.name} · trecho ${a.toFixed(2)}s → ${b.toFixed(2)}s (${(b - a).toFixed(1)}s de ${buf.duration.toFixed(1)}s) · alças rosa recortam · clique ou arraste na onda para mover o ponteiro verde`;
  }
  cv.addEventListener("pointerdown", (e) => {
    if (!buf) return;
    const r = cv.getBoundingClientRect();
    const tAt = (ev: PointerEvent) => Math.max(0, Math.min(buf!.duration, ((ev.clientX - r.left) / r.width) * buf!.duration));
    const pxOf = (t: number) => r.left + (t / buf!.duration) * r.width;
    const t0 = tAt(e);
    // perto de uma alça rosa (≤ 12 px): recorta; senão: move o ponteiro de reprodução (e a faixa segue dali se estiver tocando)
    const near = (t: number) => Math.abs(e.clientX - pxOf(t)) <= 12;
    const which = near(a) && (!near(b) || Math.abs(t0 - a) <= Math.abs(t0 - b)) ? "a" : near(b) ? "b" : "seek";
    cv.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => {
      const t = tAt(ev);
      if (which === "a") a = Math.min(t, b - 0.2); else if (which === "b") b = Math.max(t, a + 0.2);
      else { ph = Math.max(a, Math.min(b, t)); if (mine() && audio.isPlaying()) dragging = true; }
      draw();
    };
    let dragging = false;
    mv(e);
    if (which === "seek") {
      const fin = () => { cv.removeEventListener("pointerup", fin); seekTo(ph); };
      cv.addEventListener("pointerup", fin);
    }
    const up = () => { cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); };
    cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up);
  });
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const mine = () => audio.playerState().source?.id === SRC_ID;
  const source = () => ({ id: SRC_ID, label: `Importar — ${file?.name ?? "faixa"}`, icon: "🎵", focus: () => dispatchEvent(new CustomEvent("open-app", { detail: "import" })) });
  /** Toca o trecho recortado [a, b] a partir de `t` (segundos da faixa). */
  function startAt(t: number) {
    if (!buf) return;
    audio.playBuffer(buf, { rangeStart: a, from: Math.max(a, Math.min(b - 0.05, t)), to: b, gainDb: +gain.value, source: source() });
  }
  function togglePlay() {
    if (!buf) return;
    const st = audio.playerState();
    if (mine() && st.playing) { audio.pause(); return; }
    if (mine() && st.paused) { audio.resume(); return; }
    startAt(ph >= a && ph < b - 0.05 ? ph : a);
  }
  function seekTo(t: number) {
    if (!buf) return;
    ph = Math.max(a, Math.min(b, t));
    if (mine() && audio.isPlaying()) audio.seek(ph - a); else if (mine()) audio.seek(ph - a);
    draw();
  }
  function jump(d: number) { if (!buf) return; const cur = ph >= 0 ? ph : a; seekTo(cur + d); if (!mine() || !audio.isPlaying()) startAt(ph); }
  // acompanha o player universal (ele também pode pausar/parar esta faixa)
  let raf = 0;
  const follow = () => {
    const st = audio.playerState();
    if (mine()) { ph = a + st.pos; playB.textContent = st.playing ? "⏸ Pausar" : "▶ Continuar"; }
    else playB.textContent = "▶ Ouvir trecho";
    draw();
    if (mine() && st.playing) raf = requestAnimationFrame(follow);
  };
  audio.onPlayer(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(follow); });
  go.addEventListener("click", async () => {
    if (!buf || !requireLogin()) return;
    busy(go, true, "Enviando trecho…");
    try {
      const wav = await audio.trimToWav(buf, a, b, +gain.value);
      const up = await upload("audio", wav, (file?.name || "audio").replace(/\.\w+$/, "") + "-trecho.wav");
      busy(go, true, "IA ouvindo e transcrevendo… (pode levar alguns minutos)");
      const r = await runJob("transcribe_audio", { asset: up.path, source_name: file?.name, mode: mode.value, separate: sep.checked, lyrics: lyr.checked,
        expected_lyrics: expected.value || undefined, tempo: tempo.value ? +tempo.value : undefined, timeSig: store.score.timeSig },
        (st) => busy(go, true, st === "running" ? "Transcrevendo…" : "Na fila…"));
      // a faixa original entra junto como camada 🎙 (para comparar com a transcrição no visualizador)
      const spb = 60 / (r.tempo || store.score.tempo);
      const bpm = beatsPerMeasure(store.score);
      const nMeas = Math.max(1, Math.ceil((b - a) / spb / bpm));
      r.layers = [...(r.layers || []), { ...newLayer("recording", `Original: ${file?.name ?? "faixa"}`), audio: up.path, audioOffset: 0, measures: Array.from({ length: nMeas }, (_, i) => i), notes: [] }];
      deliver(r, "Transcrição do áudio", false);
      showResult(r);
      viewB.hidden = false;
      dispatchEvent(new CustomEvent("open-app", { detail: "visualizer" }));
    } catch (e: any) { toast(e.message, "error"); }
    finally { busy(go, false); }
  });
  function showResult(r: any) {
    result.replaceChildren(h("h4", {}, "Resultado"),
      h("ul", {}, ...r.layers.map((l: any) => h("li", {}, `${l.name}: ${l.notes.length} notas`))),
      r.lyricsCheck ? h("div", { class: "lyrics-check" },
        h("b", {}, `Conferência da letra: ${Math.round(r.lyricsCheck.similarity * 100)}% de correspondência`),
        ...r.lyricsCheck.diffs.slice(0, 20).map((d: any) => h("div", { class: "diff" }, h("del", {}, d.heard || "∅"), " → ", h("ins", {}, d.expected || "∅")))) : "");
  }
  return p;
}

// ----------------------------------------------------------------- IMAGEM
function imagePane() {
  const p = h("div");
  const cv = h("canvas", { class: "crop" }) as HTMLCanvasElement;
  let img: HTMLImageElement | null = null; let file: File | null = null; let rot = 0;
  let crop = { x: 0.03, y: 0.03, w: 0.94, h: 0.94 };
  const go = h("button", { class: "btn primary go", disabled: true, title: "Envie uma imagem primeiro" }, "✨ Ler partitura (OMR)") as HTMLButtonElement;
  const fileIn = h("input", { type: "file", accept: "image/*", hidden: true, onchange: (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) load(f); } }) as HTMLInputElement;
  const camIn = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true, onchange: (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) load(f); } }) as HTMLInputElement;
  const rotB = h("button", { class: "btn", disabled: true, onclick: () => { rot = (rot + 90) % 360; draw(); } }, "⟳ Girar") as HTMLButtonElement;
  const allB = h("button", { class: "btn ghost", disabled: true, onclick: () => { crop = { x: 0, y: 0, w: 1, h: 1 }; draw(); } }, "⤢ Sem recorte") as HTMLButtonElement;
  const melOnly = h("input", { type: "checkbox", checked: prefs.captureMode === "melody" }) as HTMLInputElement;
  melOnly.addEventListener("change", () => (prefs.captureMode = melOnly.checked ? "melody" : "both"));
  const bar = h("div", { class: "imp-bar" },
    h("div", { class: "imp-row" },
      tip(h("button", { class: "btn", onclick: () => fileIn.click() }, "📂 Imagem"), "Foto ou scan (PNG, JPG, WEBP) — ou arraste para a área abaixo"),
      tip(h("button", { class: "btn", onclick: () => camIn.click() }, "📷 Câmera"), "Fotografar agora (no celular abre a câmera)"),
      h("i", { class: "imp-sep" }), rotB, allB,
      tip(h("label", { class: "check" }, melOnly, " Só a melodia"), "Lê só a pauta de cima (você harmoniza depois)"),
      h("span", { class: "spacer" }), go),
    h("div", { class: "imp-row opts hint" }, "Arraste sobre a imagem para marcar só a área com as pautas. Fotos retas, com boa luz, uma página por vez."));
  const stage = h("div", { class: "crop-stage", hidden: true }, cv);
  const drop = dropZone("image/*", "Arraste a foto ou o scan da partitura aqui", load);
  p.classList.add("imp-pane");
  p.append(fileIn, camIn, bar, drop, stage);

  function load(f: File) {
    file = f; const u = URL.createObjectURL(f);
    img = new Image(); img.onload = () => { stage.hidden = false; drop.hidden = true; rotB.disabled = allB.disabled = go.disabled = false; go.removeAttribute("title"); draw(); }; img.src = u;
  }
  function draw() {
    if (!img) return;
    const sw = rot % 180 ? img.height : img.width, sh = rot % 180 ? img.width : img.height;
    const scale = Math.min(860 / sw, 520 / sh);
    cv.width = sw * scale; cv.height = sh * scale;
    const c = cv.getContext("2d")!;
    c.save(); c.translate(cv.width / 2, cv.height / 2); c.rotate((rot * Math.PI) / 180);
    c.drawImage(img, (-img.width * scale) / 2, (-img.height * scale) / 2, img.width * scale, img.height * scale); c.restore();
    c.fillStyle = "rgba(10,10,30,.5)";
    const X = crop.x * cv.width, Y = crop.y * cv.height, W = crop.w * cv.width, H = crop.h * cv.height;
    c.fillRect(0, 0, cv.width, Y); c.fillRect(0, Y + H, cv.width, cv.height - Y - H); c.fillRect(0, Y, X, H); c.fillRect(X + W, Y, cv.width - X - W, H);
    c.strokeStyle = "#ff5d8f"; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(X, Y, W, H);
  }
  cv.addEventListener("pointerdown", (e) => {
    const r = cv.getBoundingClientRect();
    const fx = (ev: PointerEvent) => Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    const fy = (ev: PointerEvent) => Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
    const x0 = fx(e), y0 = fy(e);
    cv.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { const x1 = fx(ev), y1 = fy(ev); crop = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.max(0.05, Math.abs(x1 - x0)), h: Math.max(0.05, Math.abs(y1 - y0)) }; draw(); };
    const up = () => { cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); };
    cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up);
  });
  go.addEventListener("click", async () => {
    if (!img || !file || !requireLogin()) return;
    busy(go, true, "Recortando e enviando…");
    try {
      // aplica rotação + recorte localmente (envia só a área útil — menos dados, mais privacidade)
      const full = document.createElement("canvas");
      const sw = rot % 180 ? img.height : img.width, sh = rot % 180 ? img.width : img.height;
      full.width = crop.w * sw; full.height = crop.h * sh;
      const c = full.getContext("2d")!;
      c.translate(-crop.x * sw, -crop.y * sh); c.translate(sw / 2, sh / 2); c.rotate((rot * Math.PI) / 180);
      c.drawImage(img, -img.width / 2, -img.height / 2);
      const blob: Blob = await new Promise((r) => full.toBlob((b) => r(b!), "image/png"));
      const up = await upload("image", blob, "partitura.png");
      busy(go, true, "Lendo a partitura…");
      const r = await runJob("transcribe_image", { asset: up.path }, (s) => busy(go, true, s === "running" ? "Reconhecendo símbolos…" : "Na fila…"));
      if (prefs.captureMode === "melody") { r.layers = (r.layers || []).filter((l: any) => l.staff !== "bass"); r.chords = []; }
      deliver(r, "Leitura da partitura");
    } catch (e: any) { toast(e.message, "error"); }
    finally { busy(go, false); }
  });
  return p;
}

// ------------------------------------------------------------------ CIFRA
function cifraPane() {
  const ta = h("textarea", { rows: 9, class: "mono", placeholder: "[Intro]\n| C | Am | F | G7 |\n\nC            Am\nEu sei que vou te amar\nF           G7\nPor toda a minha vida" }) as HTMLTextAreaElement;
  const style = h("select", {}, h("option", { value: "block" }, "Acordes em bloco"), h("option", { value: "arpeggio" }, "Arpejo"), h("option", { value: "alberti" }, "Baixo de Alberti"), h("option", { value: "bass-chord" }, "Baixo + acorde")) as HTMLSelectElement;
  const perLine = h("select", {}, h("option", { value: 1 }, "1 acorde por compasso"), h("option", { value: 2 }, "2 acordes por compasso")) as HTMLSelectElement;
  const preview = h("div", { class: "chord-preview", "data-noi18n": "" });
  const go = h("button", { class: "btn primary go" }, "✨ Transcrever cifra para partitura") as HTMLButtonElement;
  ta.addEventListener("input", () => {
    const bars = parseCifraBars(ta.value.split("\n").filter((l) => /^[\s|A-G#bm0-9()/°º+\-susadijM]+$/.test(l)).join(" | "), beatsPerMeasure(store.score));
    preview.replaceChildren(...bars.map((cell, i) => h("span", { class: "chip" }, h("small", {}, String(i + 1)), cell.map((c) => c.symbol).join(" "))));
  });
  go.addEventListener("click", async () => {
    if (!ta.value.trim()) return;
    busy(go, true, "Interpretando…");
    try {
      if (currentUser) {
        const r = await runJob("parse_cifra", { text: ta.value, timeSig: store.score.timeSig, style: style.value, chords_per_measure: +perLine.value });
        deliver(r, "Cifra");
        if (r.lyricsSyllables?.length) toast(`Letra detectada (${r.lyricsSyllables.length} sílabas). Use "Letra → notas" nas Camadas após escrever a melodia.`, "info", 6000);
      } else {
        const bpm = beatsPerMeasure(store.score);
        const chords = parseCifraBars(ta.value, bpm);
        const l = newLayer("harmony", "Harmonia (cifra)", "bass"); l.notes = voiceChords(chords, bpm, style.value);
        deliver({ chords, layers: [l], measures: chords.length }, "Cifra");
      }
    } catch (e: any) { toast(e.message, "error"); }
    finally { busy(go, false); }
  });
  return h("div", { class: "imp-pane" },
    h("div", { class: "imp-bar" }, h("div", { class: "imp-row" }, h("label", { class: "inline" }, "Acompanhamento ", style), perLine, h("span", { class: "spacer" }), go)),
    ta, preview,
    h("p", { class: "hint" }, "Formatos aceitos: barras (| C | Am |), cifra sobre a letra, solfejo (Ré m), extensões (7M, m7(b5), 7(9), sus4, °, /baixo) e % para repetir o compasso."));
}
