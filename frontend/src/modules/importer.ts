// Importação: áudio (recorte/ganho antes do envio), foto de partitura (recorte/rotação) e cifra em texto.
import { store, newLayer } from "../core/store";
import { h, toast, busy, tip } from "../core/ui";
import { runJob, upload, requireLogin, currentUser } from "../core/api";
import * as audio from "../core/audio";
import { parseCifraBars, voiceChords } from "../core/theory";
import { beatsPerMeasure } from "../core/types";

export function mountImporter(body: HTMLElement) {
  body.classList.add("importer");
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const panes = h("div", { class: "panes" });
  body.append(tabs, panes);
  const defs: [string, string, () => HTMLElement][] = [["audio", "🎵 Áudio / Canção", audioPane], ["image", "📷 Foto da partitura", imagePane], ["cifra", "🎸 Cifra", cifraPane]];
  const show = (id: string) => {
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    panes.querySelectorAll<HTMLElement>(".pane").forEach((p) => (p.hidden = p.dataset.pane !== id));
  };
  for (const [id, label, mk] of defs) {
    tabs.append(h("button", { role: "tab", "data-tab": id, onclick: () => show(id) }, label));
    const p = mk(); p.classList.add("pane"); p.dataset.pane = id; panes.append(p);
  }
  show("audio");
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
function deliver(r: any, what: string) {
  const ids = store.mergeResult(r);
  dispatchEvent(new CustomEvent("open-app", { detail: "compose" }));
  dispatchEvent(new CustomEvent("open-app", { detail: "layers" }));
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
  const go = h("button", { class: "btn primary big" }, "✨ Transcrever para partitura") as HTMLButtonElement;
  const result = h("div", { class: "result" });
  const editor = h("div", { class: "trim", hidden: true }, cv, info,
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => buf && audio.ac() && previewTrim() }, "▶ Ouvir trecho"),
      h("label", { class: "inline" }, "Ganho ", gain),
      h("button", { class: "btn ghost", onclick: () => { if (buf) { a = 0; b = buf.duration; draw(); } } }, "Restaurar")),
    h("div", { class: "grid2" },
      h("label", {}, "Extrair", mode),
      h("label", {}, "Andamento (♩)", tempo),
      tip(h("label", { class: "check" }, sep, " Separar voz/instrumentos (Demucs)"), "Isola a voz para transcrever como camada 'Voz' com letra e efeitos vocais"),
      h("label", { class: "check" }, lyr, " Transcrever letra cantada")),
    expected, go, result);
  p.append(dropZone("audio/*,video/webm", "Envie um áudio (MP3, WAV, FLAC, M4A, OGG)", load), editor);

  async function load(f: File) {
    file = f;
    try { buf = await audio.decode(f); } catch { toast("Não foi possível ler este áudio", "error"); return; }
    a = 0; b = buf.duration; editor.hidden = false; draw();
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
    info.textContent = `${file?.name} · trecho ${a.toFixed(2)}s → ${b.toFixed(2)}s (${(b - a).toFixed(1)}s de ${buf.duration.toFixed(1)}s) · arraste as alças rosa para recortar`;
  }
  cv.addEventListener("pointerdown", (e) => {
    if (!buf) return;
    const r = cv.getBoundingClientRect();
    const tAt = (ev: PointerEvent) => Math.max(0, Math.min(buf!.duration, ((ev.clientX - r.left) / r.width) * buf!.duration));
    const t0 = tAt(e); const which = Math.abs(t0 - a) < Math.abs(t0 - b) ? "a" : "b";
    cv.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { const t = tAt(ev); if (which === "a") a = Math.min(t, b - 0.2); else b = Math.max(t, a + 0.2); draw(); };
    mv(e);
    const up = () => { cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); };
    cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up);
  });
  async function previewTrim() {
    const c = audio.ac(); const s = c.createBufferSource(); s.buffer = buf!;
    const g = c.createGain(); g.gain.value = Math.pow(10, +gain.value / 20);
    s.connect(g).connect(c.destination); s.start(0, a, Math.min(8, b - a));
  }
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
      deliver(r, "Transcrição do áudio");
      showResult(r);
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
  const go = h("button", { class: "btn primary big" }, "✨ Ler partitura (OMR)") as HTMLButtonElement;
  const stage = h("div", { class: "crop-stage", hidden: true }, cv,
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => { rot = (rot + 90) % 360; draw(); } }, "⟳ Girar"),
      h("button", { class: "btn ghost", onclick: () => { crop = { x: 0, y: 0, w: 1, h: 1 }; draw(); } }, "Sem recorte"),
      h("span", { class: "hint" }, "Arraste para desenhar a área com as pautas. Dica: fotos retas, com boa luz, uma página por vez.")), go);
  p.append(dropZone("image/*", "Envie a foto ou scan da partitura (PNG, JPG, WEBP)", load), stage);

  function load(f: File) {
    file = f; const u = URL.createObjectURL(f);
    img = new Image(); img.onload = () => { stage.hidden = false; draw(); }; img.src = u;
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
  const go = h("button", { class: "btn primary big" }, "✨ Transcrever cifra para partitura") as HTMLButtonElement;
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
  return h("div", {}, ta, h("div", { class: "row" }, style, perLine), preview, go,
    h("p", { class: "hint" }, "Formatos aceitos: barras (| C | Am |), cifra sobre a letra, solfejo (Ré m), extensões (7M, m7(b5), 7(9), sus4, °, /baixo) e % para repetir o compasso."));
}
