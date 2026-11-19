// Editor de partitura para piano (sistema Sol/Fá) com drag & drop profissional e camadas.
// Híbrido didático: notação tradicional + barra de duração colorida por camada (mostra a duração real).
import { store, newLayer } from "../core/store";
import { Note, Score, uid, beatsPerMeasure, ChordEv } from "../core/types";
import { h, toast, busy, tip } from "../core/ui";
import { SOLFEGE, NAMES, parseChord, voiceChords, extractMelody, chordPcs, symbolOf, KEY_NAMES } from "../core/theory";
import * as audio from "../core/audio";
import { currentUser, runJob, upload } from "../core/api";
import { t } from "../core/i18n";
import type { Win } from "../core/wm";

const SVGNS = "http://www.w3.org/2000/svg";
const LS = 10; // espaçamento entre linhas
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_LETTERS = [3, 0, 4, 1, 5, 2, 6];
const FLAT_LETTERS = [6, 2, 5, 1, 4, 0, 3];
const SPELL_SHARP: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const SPELL_FLAT: [number, number][] = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];

type Tool = "select" | "pencil" | "erase" | "annotate" | "lyrics" | "chord";

function keyAcc(fifths: number) {
  const a = [0, 0, 0, 0, 0, 0, 0];
  if (fifths > 0) SHARP_LETTERS.slice(0, fifths).forEach((l) => (a[l] = 1));
  if (fifths < 0) FLAT_LETTERS.slice(0, -fifths).forEach((l) => (a[l] = -1));
  return a;
}
function spell(p: number, fifths: number) {
  const [letter, acc] = (fifths < 0 ? SPELL_FLAT : SPELL_SHARP)[p % 12];
  return { step: (Math.floor(p / 12) - 1) * 7 + letter, letter, acc };
}
function stepToPitch(step: number, fifths: number) {
  const letter = ((step % 7) + 7) % 7, oct = Math.floor(step / 7);
  return (oct + 1) * 12 + LETTER_PC[letter] + keyAcc(fifths)[letter];
}
const TREBLE_TOP = 38; // F5
const BASS_TOP = 26;   // A3

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, text?: string) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

interface SysGeom { index: number; y: number; firstMeasure: number; nMeasures: number; left: number; trebleY: number; bassY: number; }

export function mountScoreEditor(body: HTMLElement, win: Win) {
  let tool: Tool = "select";
  let dur = 1;
  let dotted = false;
  let zoom = 1;
  let grid = 0.25;
  let harmStyle = "block";
  let metronome = false;
  let loop = false;
  let playhead = -1;
  let systems: SysGeom[] = [];
  let ppb = 34;

  // ------------------------------------------------------------ toolbar
  const toolBtn = (id: Tool, icon: string, label: string, help: string) =>
    tip(h("button", { class: "tool" + (tool === id ? " on" : ""), "data-tool": id, "aria-label": label, onclick: () => setTool(id) }, h("span", { html: icon }), h("small", {}, label)), help);
  const tools = h("div", { class: "seg" },
    toolBtn("select", "⤧", "Mover", "Selecionar e arrastar notas. ↑↓ transpõe, Shift+arrastar = cromático, Alt+arrastar = duplicar."),
    toolBtn("pencil", "✎", "Nota", "Clique na pauta para inserir uma nota com a duração escolhida."),
    toolBtn("erase", "⌫", "Apagar", "Clique numa nota para removê-la."),
    toolBtn("chord", "C7", "Cifra", "Clique acima do compasso para escrever acordes (ex.: Am7 D7(9))."),
    toolBtn("lyrics", "♪a", "Letra", "Clique numa nota para escrever a sílaba. Tab avança, '_' = melisma (prolonga)."),
    toolBtn("annotate", "✦", "Nota+", "Adicionar anotação didática / de interpretação no compasso."));

  const DURS: [number, string, string][] = [[4, "𝅝", "Semibreve (4 tempos)"], [2, "𝅗𝅥", "Mínima (2)"], [1, "♩", "Semínima (1)"], [0.5, "♪", "Colcheia (½)"], [0.25, "𝅘𝅥𝅯", "Semicolcheia (¼)"]];
  const durBox = h("div", { class: "seg durs" }, ...DURS.map(([d, g, n]) => {
    const b = tip(h("button", { class: "dur" + (d === dur ? " on" : ""), draggable: "true", "data-dur": d, onclick: () => { dur = d; refreshDurs(); } }, g), n + " — arraste para a pauta");
    b.addEventListener("dragstart", (e) => { e.dataTransfer!.setData("text/harmonia-dur", String(d * (dotted ? 1.5 : 1))); e.dataTransfer!.effectAllowed = "copy"; });
    return b;
  }), tip(h("button", { class: "dur", onclick: (e: Event) => { dotted = !dotted; (e.currentTarget as HTMLElement).classList.toggle("on", dotted); } }, "•"), "Ponto de aumento: +50% da duração"));
  const refreshDurs = () => durBox.querySelectorAll<HTMLElement>("[data-dur]").forEach((b) => b.classList.toggle("on", +b.dataset.dur! === dur));

  const playBtn = h("button", { class: "btn primary", onclick: () => togglePlay() }, "▶ " + t("play"));
  const tempoIn = h("input", { type: "number", min: 30, max: 260, value: store.score.tempo, class: "num", "aria-label": "Andamento",
    onchange: (e: Event) => store.mutate((s) => (s.tempo = +(e.target as HTMLInputElement).value || 96), "tempo") });
  const transport = h("div", { class: "seg" }, playBtn,
    tip(h("button", { class: "btn" + (metronome ? " on" : ""), onclick: (e: Event) => { metronome = !metronome; (e.currentTarget as HTMLElement).classList.toggle("on", metronome); } }, "𝅘𝅥 Metrônomo"), "Clique a cada tempo; acento no tempo forte"),
    tip(h("button", { class: "btn", onclick: (e: Event) => { loop = !loop; (e.currentTarget as HTMLElement).classList.toggle("on", loop); } }, "⟲ Loop"), "Repete o trecho selecionado"),
    h("label", { class: "inline" }, "♩=", tempoIn));

  const styleSel = h("select", { "aria-label": "Estilo de acompanhamento", onchange: (e: Event) => (harmStyle = (e.target as HTMLSelectElement).value) },
    h("option", { value: "block" }, "Acordes em bloco"), h("option", { value: "arpeggio" }, "Arpejo"), h("option", { value: "alberti" }, "Baixo de Alberti"), h("option", { value: "bass-chord" }, "Baixo + acorde"));
  const harmBtn = tip(h("button", { class: "btn accent", onclick: (e: Event) => harmonize(e.currentTarget as HTMLButtonElement, false) }, "✨ " + t("harmonize") + " seleção"), "Gera acordes só nos compassos selecionados, mantendo o resto como contexto");
  const harmAllBtn = h("button", { class: "btn", onclick: (e: Event) => harmonize(e.currentTarget as HTMLButtonElement, true) }, "Harmonizar tudo");
  const aiBox = h("div", { class: "seg" }, harmBtn, harmAllBtn, styleSel,
    tip(h("button", { class: "btn", onclick: extractMel }, "Melodia ⇠ harmonia"), "Extrai a voz principal (mais aguda) das camadas de harmonia"),
    tip(h("button", { class: "btn", onclick: transcribeChords }, "Cifrar"), "Reconhece os acordes a partir das notas e escreve a cifra"),
    tip(h("button", { class: "btn rec", onclick: (e: Event) => recordSection(e.currentTarget as HTMLButtonElement) }, "● " + t("record") + " trecho"), "Grava os compassos selecionados (ou faltantes) com contagem e metrônomo"));
  const zoomIn = h("input", { type: "range", min: 0.6, max: 2, step: 0.1, value: zoom, "aria-label": "Zoom", oninput: (e: Event) => { zoom = +(e.target as HTMLInputElement).value; render(); } });
  const metaBox = h("div", { class: "seg" },
    h("button", { class: "btn ghost", title: "Desfazer (⌘Z)", onclick: () => store.undoOp() }, "↶"),
    h("button", { class: "btn ghost", title: "Refazer (⇧⌘Z)", onclick: () => store.redoOp() }, "↷"),
    h("label", { class: "inline" }, "🔍", zoomIn));

  const toolbar = h("div", { class: "toolbar" }, tools, durBox, transport, aiBox, metaBox);
  const titleIn = h("input", { class: "score-title", value: store.score.title, "aria-label": "Título",
    onchange: (e: Event) => store.mutate((s) => (s.title = (e.target as HTMLInputElement).value), "title") });
  const keySel = h("select", { "aria-label": "Armadura", onchange: (e: Event) => store.mutate((s) => (s.keySig = +(e.target as HTMLSelectElement).value), "key") },
    ...Object.entries(KEY_NAMES).sort((a, b) => +a[0] - +b[0]).map(([f, n]) => h("option", { value: f, selected: +f === store.score.keySig }, `${n} maior / ${NAMES[(((+f * 7 + 9) % 12) + 12) % 12]}m`)));
  const tsSel = h("select", { "aria-label": "Fórmula de compasso", onchange: (e: Event) => store.mutate((s) => (s.timeSig = (e.target as HTMLSelectElement).value.split("/").map(Number) as [number, number]), "ts") },
    ...["2/4", "3/4", "4/4", "6/8", "5/4", "7/8"].map((v) => h("option", { value: v, selected: v === store.score.timeSig.join("/") }, v)));
  const addMeasure = h("button", { class: "btn ghost", onclick: () => store.mutate((s) => { s.measures++; }, "measures") }, "+ compasso");
  const header = h("div", { class: "score-head" }, titleIn, h("div", { class: "seg" }, keySel, tsSel, addMeasure));

  const status = h("div", { class: "statusbar", "data-noi18n": "" });
  const canvas = h("div", { class: "score-canvas", tabindex: "0" });
  const paper = svg("svg", { class: "score-svg" });
  canvas.append(paper);
  body.append(header, toolbar, canvas, status);
  body.classList.add("score-editor");

  function setTool(tl: Tool) {
    tool = tl;
    tools.querySelectorAll<HTMLElement>(".tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === tl));
    canvas.dataset.tool = tl;
  }

  // -------------------------------------------------------------- render
  function render() {
    const s = store.score;
    const bpm = beatsPerMeasure(s);
    ppb = 34 * zoom;
    const width = Math.max(480, canvas.clientWidth - 16);
    const mW = bpm * ppb + 16;
    const keyW = Math.abs(s.keySig) * 9;
    const firstLeft = 70 + keyW + 26, otherLeft = 62 + keyW;
    const perSys = Math.max(1, Math.floor((width - firstLeft) / mW));
    const SYS_H = 300;
    systems = [];
    for (let m = 0, i = 0; m < s.measures; m += perSys, i++) {
      const y = 10 + i * SYS_H;
      systems.push({ index: i, y, firstMeasure: m, nMeasures: Math.min(perSys, s.measures - m), left: i === 0 ? firstLeft : otherLeft, trebleY: y + 92, bassY: y + 92 + 40 + 78 });
    }
    paper.setAttribute("width", String(width));
    paper.setAttribute("height", String(systems.length * SYS_H + 20));
    paper.replaceChildren();
    const defs = svg("defs");
    defs.innerHTML = `<filter id="nshadow"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity=".35"/></filter>`;
    paper.append(defs);
    for (const sys of systems) drawSystem(sys, s, bpm, mW);
    drawPlayhead();
    status.textContent = `${s.measures} compassos · ${s.timeSig.join("/")} · ${KEY_NAMES[s.keySig] ?? ""} · ♩=${s.tempo} · camada ativa: ${store.layer()?.name ?? "—"}${store.selectedMeasures.size ? ` · seleção: compassos ${[...store.selectedMeasures].sort((a, b) => a - b).map((m) => m + 1).join(", ")}` : ""}`;
  }

  function xOf(sys: SysGeom, beat: number, bpm: number, mW: number) {
    const rel = beat - sys.firstMeasure * bpm;
    const m = Math.floor(rel / bpm);
    return sys.left + m * mW + 10 + (rel - m * bpm) * ppb;
  }

  function drawStaff(g: SVGGElement, y: number, x0: number, x1: number) {
    for (let i = 0; i < 5; i++) g.append(svg("line", { x1: x0, x2: x1, y1: y + i * LS, y2: y + i * LS, class: "staff-line" }));
  }

  function drawSystem(sys: SysGeom, s: Score, bpm: number, mW: number) {
    const g = svg("g", { class: "system", "data-sys": sys.index });
    paper.append(g);
    const x0 = 8, x1 = sys.left + sys.nMeasures * mW;
    // seleção de compassos + bandas
    for (let k = 0; k < sys.nMeasures; k++) {
      const m = sys.firstMeasure + k;
      const mx = sys.left + k * mW;
      if (store.selectedMeasures.has(m)) g.append(svg("rect", { x: mx, y: sys.y + 4, width: mW, height: sys.bassY + 40 + 30 - sys.y, rx: 6, class: "measure-sel" }));
      g.append(svg("rect", { x: mx + 2, y: sys.y + 4, width: mW - 4, height: 18, rx: 5, class: "measure-band", "data-measure": m }));
      g.append(svg("text", { x: mx + 6, y: sys.y + 17, class: "measure-num" }, String(m + 1)));
      g.append(svg("rect", { x: mx + 2, y: sys.y + 26, width: mW - 4, height: 22, rx: 5, class: "chord-band", "data-chord-measure": m }));
      for (const c of s.chords[m] || []) {
        const cx = mx + 10 + c.beat * ppb;
        g.append(svg("text", { x: cx, y: sys.y + 42, class: "chord-sym", "data-chord-measure": m }, c.symbol));
      }
      for (const a of s.annotations.filter((a) => a.measure === m)) {
        const ax = mx + 10 + a.beat * ppb;
        const ag = svg("g", { class: "annotation", "data-ann": a.id, transform: `translate(${ax},${sys.y + 52})` });
        const tw = Math.min(mW * 1.6, 12 + a.text.length * 6.2);
        ag.append(svg("rect", { x: 0, y: -2, width: tw, height: 18, rx: 6, fill: a.color, opacity: 0.9 }), svg("text", { x: 6, y: 11, class: "ann-text" }, a.text));
        g.append(ag);
      }
    }
    drawStaff(g, sys.trebleY, x0, x1);
    drawStaff(g, sys.bassY, x0, x1);
    // chave do piano e barras
    g.append(svg("path", { d: `M${x0 - 2} ${sys.trebleY} q-10 ${(sys.bassY + 40 - sys.trebleY) / 4} 0 ${(sys.bassY + 40 - sys.trebleY) / 2} q-10 ${(sys.bassY + 40 - sys.trebleY) / 4} 0 ${(sys.bassY + 40 - sys.trebleY) / 2}`, class: "brace" }));
    g.append(svg("line", { x1: x0, x2: x0, y1: sys.trebleY, y2: sys.bassY + 40, class: "barline" }));
    for (let k = 0; k <= sys.nMeasures; k++) {
      const bx = sys.left + k * mW;
      const last = sys.firstMeasure + k === s.measures;
      g.append(svg("line", { x1: bx, x2: bx, y1: sys.trebleY, y2: sys.bassY + 40, class: last ? "barline final" : "barline" }));
    }
    // "+" discreto nas barras: insere compasso entre os compassos e ao final
    for (let k = sys.index === 0 ? 0 : 1; k <= sys.nMeasures; k++) {
      const at = sys.firstMeasure + k;
      const bx = sys.left + k * mW;
      const isEnd = at === s.measures;
      const pg = svg("g", { class: "ins-measure" + (isEnd ? " end" : ""), "data-insert": at, transform: `translate(${bx + (isEnd ? 12 : 0)},${sys.trebleY - 12})` });
      const title = svg("title", {}, isEnd ? "Adicionar compasso no final" : at === 0 ? "Inserir compasso no início" : `Inserir compasso entre ${at} e ${at + 1}`);
      pg.append(title, svg("circle", { r: 7, "data-insert": at }), svg("path", { d: "M-3.5 0H3.5M0 -3.5V3.5", "data-insert": at }));
      g.append(pg);
    }
    // claves, armadura, fórmula
    g.append(svg("text", { x: 14, y: sys.trebleY + 31, class: "clef" }, "𝄞"));
    g.append(svg("text", { x: 14, y: sys.bassY + 21, class: "clef bass" }, "𝄢"));
    const acc = keyAcc(s.keySig);
    const order = s.keySig >= 0 ? SHARP_LETTERS : FLAT_LETTERS;
    order.slice(0, Math.abs(s.keySig)).forEach((letter, i) => {
      const sym = s.keySig > 0 ? "♯" : "♭";
      const tStep = s.keySig > 0 ? [38, 35, 39, 36, 33, 37, 34][i] : [34, 37, 33, 36, 32, 35, 31][i];
      const bStep = tStep - 14;
      g.append(svg("text", { x: 50 + i * 9, y: sys.trebleY + (TREBLE_TOP - tStep) * LS / 2 + 4, class: "acc" }, sym));
      g.append(svg("text", { x: 50 + i * 9, y: sys.bassY + (BASS_TOP - bStep) * LS / 2 + 4, class: "acc" }, sym));
      void acc; void letter;
    });
    if (sys.index === 0) {
      const tx = 56 + Math.abs(s.keySig) * 9;
      for (const sy of [sys.trebleY, sys.bassY]) {
        g.append(svg("text", { x: tx, y: sy + 18, class: "timesig" }, String(s.timeSig[0])));
        g.append(svg("text", { x: tx, y: sy + 38, class: "timesig" }, String(s.timeSig[1])));
      }
    }
    // notas por camada
    const fromBeat = sys.firstMeasure * bpm, toBeat = (sys.firstMeasure + sys.nMeasures) * bpm;
    for (const l of s.layers) {
      if (!l.visible) continue;
      const lg = svg("g", { class: "layer" + (l.id === store.selectedLayer ? " active" : "") + (l.locked ? " locked" : ""), "data-layer": l.id, style: `--lc:${l.color}` });
      g.append(lg);
      if (l.kind === "recording") {
        for (const m of l.measures || []) if (m >= sys.firstMeasure && m < sys.firstMeasure + sys.nMeasures) {
          const rx = sys.left + (m - sys.firstMeasure) * mW;
          lg.append(svg("rect", { x: rx + 4, y: sys.trebleY + 44, width: mW - 8, height: 16, rx: 8, class: "rec-clip" }), svg("text", { x: rx + 10, y: sys.trebleY + 56, class: "rec-label" }, "🎙 " + l.name));
        }
        continue;
      }
      const staffY = l.staff === "bass" ? sys.bassY : sys.trebleY;
      const top = l.staff === "bass" ? BASS_TOP : TREBLE_TOP;
      for (const n of l.notes) {
        if (n.start >= toBeat || n.start < fromBeat) continue;
        drawNote(lg, n, sys, staffY, top, bpm, mW, s.keySig, l.staff, l.color);
      }
    }
  }

  function drawNote(g: SVGGElement, n: Note, sys: SysGeom, staffY: number, top: number, bpm: number, mW: number, fifths: number, staff: string, color: string) {
    const { step, letter, acc } = spell(n.pitch, fifths);
    const y = staffY + (top - step) * LS / 2;
    const x = xOf(sys, n.start, bpm, mW);
    const sel = store.selectedNotes.has(n.id);
    const ng = svg("g", { class: "note" + (sel ? " sel" : ""), "data-id": n.id });
    // barra de duração (didática) – limitada ao fim do sistema
    const endX = Math.min(xOf(sys, Math.min(n.start + n.dur, (sys.firstMeasure + sys.nMeasures) * bpm) - 1e-6, bpm, mW), sys.left + sys.nMeasures * mW);
    ng.append(svg("rect", { x: x - 1, y: y - 4, width: Math.max(6, endX - x), height: 8, rx: 4, class: "dur-bar", fill: color }));
    ng.append(svg("rect", { x: Math.max(x + 4, endX - 6), y: y - 5, width: 7, height: 10, rx: 3, class: "dur-handle", "data-resize": n.id }));
    // linhas suplementares
    const bottomStep = top - 8;
    for (let st = bottomStep - 2; st >= step; st -= 2) ng.append(svg("line", { x1: x - 8, x2: x + 10, y1: staffY + (top - st) * LS / 2, y2: staffY + (top - st) * LS / 2, class: "ledger" }));
    for (let st = top + 2; st <= step; st += 2) ng.append(svg("line", { x1: x - 8, x2: x + 10, y1: staffY + (top - st) * LS / 2, y2: staffY + (top - st) * LS / 2, class: "ledger" }));
    // acidente
    const ka = keyAcc(fifths)[letter];
    if (acc !== ka) ng.append(svg("text", { x: x - 15, y: y + 4, class: "acc" }, acc === 1 ? "♯" : acc === -1 ? "♭" : "♮"));
    const d = n.dur;
    const base = d >= 3.99 ? 4 : d >= 1.99 ? 2 : d >= 0.99 ? 1 : d >= 0.49 ? 0.5 : 0.25;
    const hollow = base >= 2;
    ng.append(svg("ellipse", { cx: x + 1, cy: y, rx: 6.2, ry: 4.4, transform: `rotate(-20 ${x + 1} ${y})`, class: "head" + (hollow ? " hollow" : ""), filter: "url(#nshadow)" }));
    if (base < 4) {
      const up = staff === "bass" ? step < 22 : step < 34;
      const sx = up ? x + 6.6 : x - 4.6;
      const y2 = up ? y - 32 : y + 32;
      ng.append(svg("line", { x1: sx, x2: sx, y1: y, y2, class: "stem" }));
      const flags = base === 0.5 ? 1 : base === 0.25 ? 2 : 0;
      for (let f = 0; f < flags; f++) {
        const fy = y2 + (up ? f * 7 : -f * 7);
        ng.append(svg("path", { d: up ? `M${sx} ${fy} q9 6 7 16` : `M${sx} ${fy} q9 -6 7 -16`, class: "flag" }));
      }
    }
    if (Math.abs(d - base * 1.5) < 1e-3) ng.append(svg("circle", { cx: x + 12, cy: y - (step % 2 === 0 ? 3 : 0), r: 1.8, class: "dot" }));
    if (n.effect) ng.append(svg("text", { x: x - 4, y: y - 12, class: "effect" }, ({ vibrato: "∿", glissando: "↗", fermata: "𝄐", staccato: "·", falsetto: "°" } as any)[n.effect] || "✦"));
    if (n.lyric && staff === "treble") ng.append(svg("text", { x: x - 2, y: sys.trebleY + 40 + 34, class: "lyric" + (n.lyric === "_" ? " melisma" : "") }, n.lyric === "_" ? "—" : n.lyric));
    g.append(ng);
  }

  function drawPlayhead() {
    paper.querySelector(".playhead")?.remove();
    if (playhead < 0) return;
    const s = store.score; const bpm = beatsPerMeasure(s);
    const m = Math.floor(playhead / bpm);
    const sys = systems.find((y) => m >= y.firstMeasure && m < y.firstMeasure + y.nMeasures);
    if (!sys) return;
    const x = xOf(sys, playhead, bpm, bpm * ppb + 16);
    paper.append(svg("line", { x1: x, x2: x, y1: sys.trebleY - 30, y2: sys.bassY + 50, class: "playhead" }));
  }

  // ------------------------------------------------------- hit testing
  function locate(ev: { clientX: number; clientY: number }) {
    const r = paper.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    const s = store.score; const bpm = beatsPerMeasure(s); const mW = bpm * ppb + 16;
    const sys = systems.find((y) => py >= y.y && py < y.y + 300) || systems[systems.length - 1];
    const k = Math.floor((px - sys.left) / mW);
    const measure = Math.max(0, Math.min(s.measures - 1, sys.firstMeasure + Math.max(0, Math.min(sys.nMeasures - 1, k))));
    const inBeat = Math.max(0, Math.min(bpm - grid, (px - sys.left - Math.max(0, k) * mW - 10) / ppb));
    const beat = measure * bpm + Math.round(inBeat / grid) * grid;
    const mid = (sys.trebleY + 40 + sys.bassY) / 2;
    const staff: "treble" | "bass" = py < mid ? "treble" : "bass";
    const step = staff === "treble" ? Math.round(TREBLE_TOP - (py - sys.trebleY) / (LS / 2)) : Math.round(BASS_TOP - (py - sys.bassY) / (LS / 2));
    return { px, py, sys, measure, beat, staff, step, pitch: stepToPitch(step, s.keySig) };
  }

  function findNote(id: string) {
    for (const l of store.score.layers) { const n = l.notes.find((x) => x.id === id); if (n) return { l, n }; }
    return null;
  }

  function targetLayer(staff: "treble" | "bass") {
    const sel = store.layer();
    if (sel && !sel.locked && sel.staff === staff && sel.kind !== "recording") return sel;
    const ex = store.score.layers.find((l) => l.staff === staff && !l.locked && l.visible && l.kind !== "recording");
    if (ex) return ex;
    const nl = newLayer(staff === "treble" ? "melody" : "harmony", staff === "treble" ? "Melodia" : "Mão esquerda", staff);
    store.score.layers.push(nl);
    return nl;
  }

  function insertNote(pitch: number, beat: number, staff: "treble" | "bass", d = dur * (dotted ? 1.5 : 1)) {
    store.mutate(() => {
      const l = targetLayer(staff);
      const n: Note = { id: uid(), pitch, start: beat, dur: d, vel: 84 };
      l.notes.push(n);
      store.selectedLayer = l.id;
      store.selectedNotes = new Set([n.id]);
    }, "add");
    audio.playNote(pitch, 0, 0.5);
  }

  // ------------------------------------------------------ interações
  let drag: null | { kind: "move" | "resize"; ids: string[]; startX: number; startY: number; orig: Map<string, { start: number; pitch: number; dur: number }>; moved: boolean; dup: boolean } = null;

  paper.addEventListener("pointerdown", (ev) => {
    canvas.focus();
    const t0 = ev.target as Element;
    const loc = locate(ev);
    const noteEl = t0.closest<SVGGElement>(".note");
    const resizeId = (t0 as SVGElement).dataset?.resize;
    const measureBand = (t0 as SVGElement).dataset?.measure;
    const chordM = t0.closest<SVGElement>("[data-chord-measure]")?.dataset.chordMeasure;
    const annEl = t0.closest<SVGGElement>(".annotation");

    const ins = t0.closest<SVGElement>("[data-insert]")?.dataset.insert;
    if (ins !== undefined) {
      const at = +ins;
      store.insertMeasure(at, ev.altKey ? 4 : 1);
      toast(ev.altKey ? `4 compassos inseridos a partir do ${at + 1}` : at >= store.score.measures - 1 ? "Compasso adicionado no final" : `Compasso inserido na posição ${at + 1}`, "ok", 1800);
      return;
    }
    if (measureBand !== undefined) {
      const m = +measureBand;
      if (ev.shiftKey && store.selectedMeasures.size) {
        const a = Math.min(...store.selectedMeasures, m), b = Math.max(...store.selectedMeasures, m);
        for (let i = a; i <= b; i++) store.selectedMeasures.add(i);
      } else if (ev.metaKey || ev.ctrlKey) {
        store.selectedMeasures.has(m) ? store.selectedMeasures.delete(m) : store.selectedMeasures.add(m);
      } else {
        const only = store.selectedMeasures.size === 1 && store.selectedMeasures.has(m);
        store.selectedMeasures = only ? new Set() : new Set([m]);
      }
      store.emit("selection"); return;
    }
    if (chordM !== undefined && (tool === "chord" || ev.detail === 2)) { editChords(+chordM, loc); return; }
    if (annEl) { if (ev.detail === 2) editAnnotation(annEl.dataset.ann!, loc); else dragAnnotation(annEl.dataset.ann!, ev); return; }
    if (tool === "annotate") { addAnnotation(loc); return; }

    if (noteEl) {
      const id = noteEl.dataset.id!;
      const f = findNote(id);
      if (!f) return;
      if (tool === "erase") { store.mutate(() => (f.l.notes = f.l.notes.filter((x) => x.id !== id)), "erase"); return; }
      if (tool === "lyrics") { editLyric(id, loc); return; }
      if (f.l.locked) { toast(`Camada "${f.l.name}" está bloqueada`, "warn"); return; }
      store.selectedLayer = f.l.id;
      if (ev.shiftKey) store.selectedNotes.has(id) ? store.selectedNotes.delete(id) : store.selectedNotes.add(id);
      else if (!store.selectedNotes.has(id)) store.selectedNotes = new Set([id]);
      const ids = [...store.selectedNotes];
      drag = { kind: resizeId ? "resize" : "move", ids, startX: ev.clientX, startY: ev.clientY, moved: false, dup: ev.altKey,
        orig: new Map(ids.map((i) => { const x = findNote(i)!.n; return [i, { start: x.start, pitch: x.pitch, dur: x.dur }]; })) };
      paper.setPointerCapture(ev.pointerId);
      audio.playNote(f.n.pitch, 0, 0.35);
      store.emit("selection");
      return;
    }
    if (tool === "pencil") { insertNote(loc.pitch, loc.beat, loc.staff); return; }
    if (tool === "select" && !ev.shiftKey) { store.selectedNotes.clear(); store.emit("selection"); }
  });

  let snapshotTaken = false;
  paper.addEventListener("pointermove", (ev) => {
    const loc = locate(ev);
    const sp = SOLFEGE[loc.pitch % 12] + (Math.floor(loc.pitch / 12) - 1);
    status.dataset.hover = `${sp} (${NAMES[loc.pitch % 12]}${Math.floor(loc.pitch / 12) - 1}) · compasso ${loc.measure + 1}, tempo ${(loc.beat % beatsPerMeasure(store.score)) + 1}`;
    status.setAttribute("data-hover", status.dataset.hover);
    if (!drag) return;
    const dx = ev.clientX - drag.startX, dy = ev.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    if (!snapshotTaken) {
      store.mutate(() => {
        if (drag!.dup) { // Alt: duplica e arrasta a cópia
          const newIds: string[] = [];
          for (const id of drag!.ids) { const f = findNote(id)!; const c = { ...f.n, id: uid() }; f.l.notes.push(c); newIds.push(c.id); drag!.orig.set(c.id, drag!.orig.get(id)!); }
          drag!.ids = newIds; store.selectedNotes = new Set(newIds);
        }
      }, "drag-start");
      snapshotTaken = true;
    }
    drag.moved = true;
    const dBeats = Math.round(dx / ppb / grid) * grid;
    for (const id of drag.ids) {
      const f = findNote(id); if (!f) continue; const o = drag.orig.get(id)!;
      if (drag.kind === "resize") { f.n.dur = Math.max(grid, o.dur + dBeats); continue; }
      f.n.start = Math.max(0, o.start + dBeats);
      if (ev.shiftKey) f.n.pitch = Math.max(21, Math.min(108, o.pitch - Math.round(dy / (LS / 2))));
      else {
        const st = spell(o.pitch, store.score.keySig).step - Math.round(dy / (LS / 2));
        f.n.pitch = Math.max(21, Math.min(108, stepToPitch(st, store.score.keySig)));
      }
    }
    store.ensureMeasures();
    render();
  });
  paper.addEventListener("pointerup", () => {
    if (drag?.moved) { const f = findNote(drag.ids[0]); if (f) audio.playNote(f.n.pitch, 0, 0.35); store.emit("edit"); }
    drag = null; snapshotTaken = false;
  });

  // Soltar figura de duração arrastada da paleta
  canvas.addEventListener("dragover", (e) => { if (e.dataTransfer?.types.includes("text/harmonia-dur")) { e.preventDefault(); canvas.classList.add("drop"); } });
  canvas.addEventListener("dragleave", () => canvas.classList.remove("drop"));
  canvas.addEventListener("drop", (e) => {
    canvas.classList.remove("drop");
    const d = parseFloat(e.dataTransfer?.getData("text/harmonia-dur") || "");
    if (!d) return;
    e.preventDefault();
    const loc = locate(e);
    insertNote(loc.pitch, loc.beat, loc.staff, d);
  });

  canvas.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? store.redoOp() : store.undoOp(); return; }
    if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); store.selectedNotes = new Set(store.layer()?.notes.map((n) => n.id) || []); store.emit("selection"); return; }
    if (e.key === " ") { e.preventDefault(); togglePlay(); return; }
    const k = { v: "select", n: "pencil", e: "erase", c: "chord", l: "lyrics", a: "annotate" }[e.key.toLowerCase()] as Tool | undefined;
    if (k && !mod) { setTool(k); return; }
    const num = { "1": 4, "2": 2, "3": 1, "4": 0.5, "5": 0.25 }[e.key as "1"];
    if (num) { dur = num; refreshDurs(); return; }
    if (!store.selectedNotes.size) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      store.mutate((s) => s.layers.forEach((l) => (l.notes = l.notes.filter((n) => !store.selectedNotes.has(n.id) || l.locked))), "delete");
      store.selectedNotes.clear();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const d = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 12 : 1);
      store.mutate((s) => s.layers.forEach((l) => !l.locked && l.notes.forEach((n) => store.selectedNotes.has(n.id) && (n.pitch = Math.max(21, Math.min(108, n.pitch + d))))), "transpose");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const d = (e.key === "ArrowRight" ? 1 : -1) * grid;
      store.mutate((s) => s.layers.forEach((l) => !l.locked && l.notes.forEach((n) => store.selectedNotes.has(n.id) && (n.start = Math.max(0, n.start + d)))), "nudge");
    }
  });

  // --------------------------------------------- editores inline (popover)
  function popover(x: number, y: number, value: string, placeholder: string, onDone: (v: string, ev?: KeyboardEvent) => void) {
    canvas.querySelector(".pop")?.remove();
    const inp = h("input", { class: "pop", value, placeholder, style: { left: x + "px", top: y + "px" } });
    canvas.append(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (ev?: KeyboardEvent) => { if (done) return; done = true; onDone(inp.value, ev); inp.remove(); canvas.focus(); };
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); finish(e); } if (e.key === "Escape") { done = true; inp.remove(); } });
    inp.addEventListener("blur", () => finish());
  }

  function editChords(m: number, loc: ReturnType<typeof locate>) {
    const bpm = beatsPerMeasure(store.score);
    const cur = (store.score.chords[m] || []).map((c) => c.symbol).join(" ");
    popover(loc.px - 20, loc.sys.y + 26, cur, "ex.: Am7 D7(9)", (v) => {
      const toks = v.trim().split(/\s+/).filter(Boolean);
      const cs = toks.map(parseChord);
      if (cs.some((c) => !c)) { toast("Cifra não reconhecida: " + toks.filter((_, i) => !cs[i]).join(", "), "error"); return; }
      const step = bpm / Math.max(1, cs.length);
      store.mutate((s) => (s.chords[m] = (cs as ChordEv[]).map((c, k) => ({ ...c, beat: k * step, dur: step }))), "chords");
    });
  }

  function editLyric(id: string, loc: ReturnType<typeof locate>) {
    const f = findNote(id)!;
    popover(loc.px - 16, loc.sys.trebleY + 58, f.n.lyric || "", "sí-la-ba", (v, ev) => {
      store.mutate(() => (f.n.lyric = v.trim() || null), "lyric");
      if (ev?.key === "Tab") { // avança para a próxima nota da camada
        const ns = [...f.l.notes].sort((a, b) => a.start - b.start);
        const nx = ns[ns.findIndex((x) => x.id === id) + 1];
        if (nx) setTimeout(() => { const el = paper.querySelector(`[data-id="${nx.id}"] .head`); if (el) { const r = el.getBoundingClientRect(); editLyric(nx.id, locate({ clientX: r.left + 4, clientY: r.top })); } }, 30);
      }
    });
  }

  function addAnnotation(loc: ReturnType<typeof locate>) {
    const bpm = beatsPerMeasure(store.score);
    popover(loc.px, loc.sys.y + 52, "", "anotação (ex.: respirar aqui)", (v) => {
      if (!v.trim()) return;
      store.mutate((s) => s.annotations.push({ id: uid(), measure: loc.measure, beat: loc.beat - loc.measure * bpm, text: v.trim(), color: "#ffd36e", layerId: store.selectedLayer || undefined }), "annotate");
    });
  }
  function editAnnotation(id: string, loc: ReturnType<typeof locate>) {
    const a = store.score.annotations.find((x) => x.id === id)!;
    popover(loc.px, loc.sys.y + 52, a.text, "vazio = remover", (v) => store.mutate((s) => {
      if (!v.trim()) s.annotations = s.annotations.filter((x) => x.id !== id); else a.text = v.trim();
    }, "annotate"));
  }
  function dragAnnotation(id: string, ev: PointerEvent) {
    const bpm = beatsPerMeasure(store.score);
    let first = true;
    const mv = (e: PointerEvent) => {
      const loc = locate(e);
      const a = store.score.annotations.find((x) => x.id === id); if (!a) return;
      if (first) { store.mutate(() => {}, "ann-drag"); first = false; }
      a.measure = loc.measure; a.beat = loc.beat - loc.measure * bpm; render();
    };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); store.emit("edit"); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
    void ev;
  }

  // ------------------------------------------------------------ ações
  function togglePlay() {
    if (audio.isPlaying()) { audio.stop(); playhead = -1; drawPlayhead(); playBtn.textContent = "▶ " + t("play"); return; }
    const s = store.score; const bpm = beatsPerMeasure(s);
    const sel = [...store.selectedMeasures].sort((a, b) => a - b);
    playBtn.textContent = "■ " + t("stop");
    audio.play(s, {
      fromBeat: sel.length ? sel[0] * bpm : 0, toBeat: sel.length ? (sel[sel.length - 1] + 1) * bpm : undefined,
      metronome, loop,
      onBeat: (b) => { playhead = b; drawPlayhead(); },
      onEnd: () => { playhead = -1; drawPlayhead(); playBtn.textContent = "▶ " + t("play"); },
    });
  }

  function melodyLayer() {
    return store.layer() && ["melody", "voice", "omr"].includes(store.layer()!.kind) ? store.layer()! : store.score.layers.find((l) => l.kind === "melody" || l.kind === "voice");
  }

  /** Harmonização local (gulosa, por compasso) – usada offline / sem login. */
  function localHarmonize(measures: number[]) {
    const s = store.score; const bpm = beatsPerMeasure(s);
    const mel = melodyLayer()?.notes || [];
    const tonicMaj = ((s.keySig * 7) % 12 + 12) % 12;
    const degs: [number, string][] = [[0, ""], [5, ""], [7, "7"], [9, "m"], [2, "m"], [4, "m"]];
    const out: Record<number, ChordEv[]> = {};
    let prevRoot = -1;
    for (const m of measures) {
      const ns = mel.filter((n) => n.start < (m + 1) * bpm && n.start + n.dur > m * bpm);
      let best: ChordEv | null = null, bs = -1e9;
      for (const [off, q] of degs) {
        const c: ChordEv = { root: (tonicMaj + off) % 12, quality: q, beat: 0, dur: bpm, symbol: "" };
        const pcs = chordPcs(c);
        let sc = ns.reduce((a, n) => a + (pcs.has(n.pitch % 12) ? n.dur * (n.start % bpm === 0 ? 1.6 : 1) : -0.3 * n.dur), 0);
        if (c.root === prevRoot) sc -= 0.4;
        if (m === s.measures - 1 && off === 0) sc += 1.5;
        if (sc > bs) { bs = sc; best = c; }
      }
      best!.symbol = symbolOf(best!.root, best!.quality, s.keySig < 0);
      out[m] = [best!]; prevRoot = best!.root;
    }
    return out;
  }

  async function harmonize(btn: HTMLButtonElement, all: boolean) {
    const s = store.score;
    const measures = all ? [...Array(s.measures).keys()] : [...store.selectedMeasures].sort((a, b) => a - b);
    if (!measures.length) { toast("Selecione compassos clicando na faixa numerada (Shift = intervalo)", "warn"); return; }
    const mel = melodyLayer();
    if (!mel?.notes.length) { toast("Escreva ou importe uma melodia primeiro", "warn"); return; }
    busy(btn, true, "Harmonizando…");
    let chords: Record<number, ChordEv[]>;
    try {
      if (currentUser) {
        const r = await runJob("harmonize", { score: s, measures, style: harmStyle, melodyLayer: mel.id });
        chords = Object.fromEntries(measures.map((m) => [m, r.chords[m]]));
      } else chords = localHarmonize(measures);
    } catch (e: any) {
      toast("Servidor indisponível — usando harmonização local. " + e.message, "warn");
      chords = localHarmonize(measures);
    } finally { busy(btn, false); }
    const bpm = beatsPerMeasure(s);
    store.mutate((sc) => {
      for (const m of measures) sc.chords[m] = chords[m] || [];
      let lh = sc.layers.find((l) => l.kind === "harmony" && l.name.startsWith("Harmonização"));
      if (!lh) { lh = newLayer("harmony", "Harmonização", "bass"); sc.layers.push(lh); }
      lh.notes = lh.notes.filter((n) => !measures.includes(Math.floor(n.start / bpm)));
      const cells = sc.chords.map((c, m) => (measures.includes(m) ? c : []));
      lh.notes.push(...voiceChords(cells, bpm, harmStyle));
    }, "harmonize");
    toast(`Harmonia gerada em ${measures.length} compasso(s). Dica: arraste notas para ajustar as vozes.`, "ok");
  }

  function extractMel() {
    const src = store.score.layers.filter((l) => (l.kind === "harmony" || l.kind === "omr") && l.visible);
    if (!src.length) { toast("Nenhuma camada de harmonia visível", "warn"); return; }
    const mel = extractMelody(src.flatMap((l) => l.notes));
    if (!mel.length) { toast("Nenhuma nota acima de G3 para formar melodia", "warn"); return; }
    store.mutate((s) => { const l = newLayer("melody", "Melodia (da harmonia)"); l.notes = mel; s.layers.push(l); store.selectedLayer = l.id; }, "extract");
    toast(`Melodia extraída: ${mel.length} notas`, "ok");
  }

  async function transcribeChords() {
    if (!currentUser) { toast("Entre na conta para reconhecer acordes com IA", "warn"); return; }
    try {
      const r = await runJob("transcribe_chords", { score: store.score });
      store.mutate((s) => r.chords.forEach((c: ChordEv[], m: number) => { if (c.length && (!store.selectedMeasures.size || store.selectedMeasures.has(m))) s.chords[m] = c; }), "chords");
      toast("Cifra escrita a partir das notas", "ok");
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function recordSection(btn: HTMLButtonElement) {
    const s = store.score; const bpm = beatsPerMeasure(s); const spb = 60 / s.tempo;
    let sel = [...store.selectedMeasures].sort((a, b) => a - b);
    if (!sel.length) { // trechos faltantes: compassos sem nenhuma nota
      sel = [...Array(s.measures).keys()].filter((m) => !s.layers.some((l) => l.notes.some((n) => Math.floor(n.start / bpm) === m)));
      if (!sel.length) { toast("Selecione os compassos a gravar", "warn"); return; }
      const gap = sel.findIndex((m, i) => i > 0 && m !== sel[i - 1] + 1);
      if (gap > 0) sel = sel.slice(0, gap); // primeiro trecho contínuo faltante
    }
    const from = sel[0], to = sel[sel.length - 1] + 1;
    try {
      busy(btn, true, "");
      const rec = await audio.record({ countInBeats: bpm, spb, onCount: (n) => (btn.innerHTML = `<b>${n}</b>`) });
      btn.innerHTML = "■ Gravando…"; btn.disabled = false;
      audio.play(s, { fromBeat: from * bpm, toBeat: to * bpm, metronome: true, onBeat: (b) => { playhead = b; drawPlayhead(); } });
      await new Promise((r) => setTimeout(r, (to - from) * bpm * spb * 1000));
      const blob = await rec.stop();
      audio.stop(); playhead = -1; drawPlayhead();
      busy(btn, false);
      const url = URL.createObjectURL(blob);
      const layer = { ...newLayer("recording", `Gravação c.${from + 1}–${to}`), audioUrl: url, audioOffset: from * bpm * spb, measures: sel };
      store.mutate((sc) => sc.layers.push(layer), "record");
      toast("Gravação adicionada como camada. Use 'Transcrever' no gestor de camadas para virar notas.", "ok", 5200);
      if (currentUser) {
        const up = await upload("recording", blob, "trecho.webm");
        store.mutate(() => { const l = store.score.layers.find((x) => x.id === layer.id); if (l) l.audio = up.path; }, "upload");
      }
    } catch (e: any) { busy(btn, false); toast("Microfone indisponível: " + e.message, "error"); }
  }

  const off = store.on((reason) => {
    if (reason === "autosave") return;
    if (reason === "load" || reason === "merge" || reason === "tempo" || reason === "key" || reason === "ts") {
      titleIn.value = store.score.title; tempoIn.value = String(store.score.tempo);
      keySel.value = String(store.score.keySig); tsSel.value = store.score.timeSig.join("/");
    }
    render();
  });
  const ro = new ResizeObserver(() => render());
  ro.observe(canvas);
  setTool("select");
  render();
  win.setTitle(`${t("compose")} — ${store.score.title}`);
  return () => { off(); ro.disconnect(); audio.stop(); };
}
