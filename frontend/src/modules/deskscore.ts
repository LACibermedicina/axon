// Pentagrama final no desktop: mostra o resultado da composição (todas as camadas visíveis) em overlay
// sobre o fundo, com ▶ tocar / ■ parar e cursor de reprodução. Movível (arraste pelo título), recolhível,
// e abre o editor com um clique em "Editar".
import { h } from "../core/ui";
import { store } from "../core/store";
import { beatsPerMeasure, staves, Clef, Score } from "../core/types";
import { KEY_NAMES } from "../core/theory";
import { instrument } from "../core/instruments";
import * as audio from "../core/audio";

const NS = "http://www.w3.org/2000/svg";
const LS = 7; // espaçamento entre linhas (compacto)
const TOP: Record<Clef, number> = { G: 38, F: 26, C: 32 };
const GLYPH: Record<Clef, string> = { G: "𝄞", F: "𝄢", C: "𝄡" };
const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const KEY = "harmonia.deskscore.v1";

const el = <K extends keyof SVGElementTagNameMap>(tag: K, a: Record<string, any> = {}, text?: string) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
};

export function mountDeskScore(openEditor: () => void, newScore: () => void) {
  let pos: { x?: number; y?: number; min?: boolean } = {};
  try { pos = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch { /* */ } };

  const title = h("b", { class: "ds-title" });
  const meta = h("small", { class: "ds-meta", "data-noi18n": "" });
  const play = h("button", { class: "btn primary ds-play", "aria-label": "Tocar a composição", onclick: () => toggle() }, "▶ Tocar");
  const edit = h("button", { class: "btn ds-edit", onclick: () => openEditor() }, "✎ Editar");
  const fresh = h("button", { class: "btn ghost", title: "Começar uma partitura nova", onclick: () => newScore() }, "＋ Nova");
  const minB = h("button", { class: "p-btn", title: "Recolher / expandir", onclick: () => { pos.min = !pos.min; save(); apply(); } });
  const head = h("header", { class: "ds-head" }, h("span", { class: "ds-ic", "aria-hidden": "true" }, "🎼"), h("div", { class: "ds-tt" }, title, meta), play, edit, minB);
  void fresh;
  const svg = el("svg", { class: "ds-svg", role: "img" });
  const body = h("div", { class: "ds-body", title: "Duplo clique para editar" }, svg as unknown as HTMLElement);
  body.addEventListener("dblclick", () => openEditor());
  const card = h("section", { class: "desk-score", "aria-label": "Pentagrama da composição" }, head, body);
  document.getElementById("app")!.append(card);

  let sys: { y: number; m0: number; n: number; left: number; up: number; lo: number }[] = [];
  let mW = 0, ppb = 0, playhead = -1;

  function apply() {
    card.classList.toggle("min", !!pos.min);
    minB.textContent = pos.min ? "▴" : "▾";
    if (pos.x !== undefined && pos.y !== undefined) Object.assign(card.style, { left: pos.x + "px", top: pos.y + "px", transform: "none" });
    if (!pos.min) render();
  }

  function render() {
    const s: Score = store.score;
    const bpm = beatsPerMeasure(s);
    const st = staves(s);
    const both = st.upper.visible && st.lower.visible;
    title.textContent = s.title || "Sem título";
    const inst = instrument(st.upper.instrument);
    meta.textContent = `${KEY_NAMES[s.keySig] ?? ""} · ${s.timeSig.join("/")} · ♩=${s.tempo} · ${s.measures} compassos · ${inst.icon} ${inst.name}`;
    const W = Math.max(320, body.clientWidth - 8);
    ppb = 18; mW = bpm * ppb + 10;
    const keyW = Math.abs(s.keySig) * 6;
    const left0 = 46 + keyW + 16;
    const per = Math.max(1, Math.floor((W - left0 - 6) / mW));
    const SH = both ? 128 : 74;
    sys = [];
    for (let m = 0, i = 0; m < s.measures; m += per, i++) {
      const y = 8 + i * SH;
      sys.push({ y, m0: m, n: Math.min(per, s.measures - m), left: i === 0 ? left0 : 40 + keyW, up: y + 22, lo: both ? y + 22 + 28 + 32 : y + 22 });
    }
    svg.setAttribute("width", String(W)); svg.setAttribute("height", String(sys.length * SH + 10));
    svg.setAttribute("aria-label", `Partitura de ${s.title}: ${s.layers.reduce((a, l) => a + l.notes.length, 0)} notas`);
    svg.replaceChildren();
    for (const y of sys) {
      const g = el("g");
      svg.append(g);
      const x1 = y.left + y.n * mW;
      const staffs: [number, Clef, "treble" | "bass"][] = [];
      if (st.upper.visible) staffs.push([y.up, st.upper.clef, "treble"]);
      if (st.lower.visible) staffs.push([y.lo, st.lower.clef, "bass"]);
      for (const [sy, clef] of staffs) {
        for (let i = 0; i < 5; i++) g.append(el("line", { x1: 4, x2: x1, y1: sy + i * LS, y2: sy + i * LS, class: "ds-line" }));
        g.append(el("text", { x: 8, y: clef === "G" ? sy + 22 : clef === "F" ? sy + 15 : sy + 21, class: "ds-clef" + (clef === "G" ? " g" : "") }, GLYPH[clef]));
        for (let k = 0; k < Math.abs(s.keySig); k++) g.append(el("text", { x: 32 + k * 6, y: sy + 8 + (k % 2) * 6, class: "ds-acc" }, s.keySig > 0 ? "♯" : "♭"));
      }
      const yt = staffs[0][0], yb = staffs[staffs.length - 1][0] + 4 * LS;
      for (let k = 0; k <= y.n; k++) g.append(el("line", { x1: y.left + k * mW, x2: y.left + k * mW, y1: yt, y2: yb, class: "ds-bar" + (y.m0 + k === s.measures ? " fin" : "") }));
      g.append(el("line", { x1: 4, x2: 4, y1: yt, y2: yb, class: "ds-bar" }));
      for (let k = 0; k < y.n; k++) {
        const m = y.m0 + k;
        for (const c of s.chords[m] || []) g.append(el("text", { x: y.left + k * mW + 4 + c.beat * ppb, y: yt - 6, class: "ds-chord" }, c.symbol));
      }
      for (const l of s.layers) {
        if (!l.visible || l.kind === "recording") continue;
        const cfg = l.staff === "bass" ? st.lower : st.upper;
        if (!cfg.visible) continue;
        const sy = l.staff === "bass" ? y.lo : y.up, top = TOP[cfg.clef];
        for (const n of l.notes) {
          const m = Math.floor(n.start / bpm);
          if (m < y.m0 || m >= y.m0 + y.n) continue;
          const step = (Math.floor(n.pitch / 12) - 1) * 7 + LETTER[n.pitch % 12];
          const ny = sy + (top - step) * LS / 2;
          const nx = y.left + (m - y.m0) * mW + 5 + (n.start - m * bpm) * ppb;
          for (let s2 = top - 10; s2 >= step; s2 -= 2) g.append(el("line", { x1: nx - 5, x2: nx + 7, y1: sy + (top - s2) * LS / 2, y2: sy + (top - s2) * LS / 2, class: "ds-line" }));
          for (let s2 = top + 2; s2 <= step; s2 += 2) g.append(el("line", { x1: nx - 5, x2: nx + 7, y1: sy + (top - s2) * LS / 2, y2: sy + (top - s2) * LS / 2, class: "ds-line" }));
          if (SHARP[n.pitch % 12]) g.append(el("text", { x: nx - 10, y: ny + 3, class: "ds-acc" }, "♯"));
          const hollow = n.dur >= 1.99;
          g.append(el("ellipse", { cx: nx + 1, cy: ny, rx: 4.3, ry: 3.1, transform: `rotate(-20 ${nx + 1} ${ny})`, fill: hollow ? "#fff" : l.color, stroke: l.color, "stroke-width": 1.4 }));
          if (n.dur < 3.99) {
            const up = step < top - 4;
            g.append(el("line", { x1: up ? nx + 5 : nx - 3, x2: up ? nx + 5 : nx - 3, y1: ny, y2: up ? ny - 22 : ny + 22, stroke: l.color, "stroke-width": 1.1 }));
          }
        }
      }
    }
    drawHead();
  }

  function drawHead() {
    svg.querySelector(".ds-head-line")?.remove();
    if (playhead < 0) return;
    const bpm = beatsPerMeasure(store.score);
    const m = Math.floor(playhead / bpm);
    const y = sys.find((q) => m >= q.m0 && m < q.m0 + q.n); if (!y) return;
    const x = y.left + (m - y.m0) * mW + 5 + (playhead - m * bpm) * ppb;
    svg.append(el("line", { x1: x, x2: x, y1: y.up - 14, y2: y.lo + 36, class: "ds-head-line" }));
  }

  function toggle() {
    if (audio.isPlaying() && audio.playerState().source?.id === "desk") { audio.stop(); return; }
    audio.play(store.score, { onBeat: (b) => { playhead = b; drawHead(); }, onEnd: () => { playhead = -1; drawHead(); } },
      { id: "desk", label: `Pentagrama do desktop — ${store.score.title}`, icon: "🎼", focus: () => { pos.min = false; save(); apply(); card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 700); } });
  }
  audio.onPlayer((st) => { const on = st.playing && st.source?.id === "desk"; play.textContent = on ? "■ Parar" : "▶ Tocar"; if (!on) { playhead = -1; drawHead(); } });

  // arrastar pelo cabeçalho
  head.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = card.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => {
      pos.x = Math.max(0, Math.min(innerWidth - 160, ev.clientX - ox)); pos.y = Math.max(34, Math.min(innerHeight - 60, ev.clientY - oy));
      Object.assign(card.style, { left: pos.x + "px", top: pos.y + "px", transform: "none" });
    };
    const up = () => { head.removeEventListener("pointermove", mv); head.removeEventListener("pointerup", up); save(); };
    head.addEventListener("pointermove", mv); head.addEventListener("pointerup", up);
  });
  head.addEventListener("dblclick", (e) => { if (!(e.target as HTMLElement).closest("button")) { delete pos.x; delete pos.y; card.removeAttribute("style"); save(); } });

  let pending = 0;
  store.on((r) => { if (r === "autosave" || r === "selection" || pos.min) return; cancelAnimationFrame(pending); pending = requestAnimationFrame(render); });
  new ResizeObserver(() => !pos.min && render()).observe(body);
  apply();
  return card;
}
