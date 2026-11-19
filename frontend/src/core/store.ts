// Estado da composição aberta com desfazer/refazer e eventos.
import { Score, Layer, uid, LayerKind } from "./types";

type Listener = (reason: string) => void;

const LAYER_COLORS: Record<LayerKind, string> = {
  melody: "#ff6b9a", harmony: "#5b8cff", voice: "#ffb547", bass: "#36c99a", omr: "#a77bff", recording: "#ff8a4c",
};

export function newLayer(kind: LayerKind, name: string, staff: "treble" | "bass" = "treble"): Layer {
  return { id: uid(), name, kind, staff, notes: [], visible: true, muted: false, solo: false, locked: false,
    volume: 0.8, color: LAYER_COLORS[kind], program: 0 };
}

export function demoScore(): Score {
  const mel = newLayer("melody", "Melodia");
  const notes: [number, number, number, string?][] = [
    [67, 0, 1, "Se"], [72, 1, 1, "eu"], [71, 2, 1, "pu-"], [72, 3, 1, "des-"],
    [74, 4, 2, "se"], [72, 6, 1, "can-"], [71, 7, 1, "tar"],
    [69, 8, 1, "o"], [72, 9, 1, "teu"], [77, 10, 1.5, "no-"], [76, 11.5, 0.5, "me"],
    [74, 12, 3, "_"], [79, 15, 1, "e"],
    [76, 16, 2, "ou-"], [74, 18, 1, "vir"], [72, 19, 1, "a"],
    [74, 20, 1, "tua"], [71, 21, 1, "voz"], [67, 22, 2, "_"],
    [69, 24, 1, "no"], [71, 25, 1, "mar"], [72, 26, 2, "_"], [72, 28, 4, ""],
  ];
  mel.notes = notes.map(([pitch, start, dur, lyric]) => ({ id: uid(), pitch, start, dur, vel: 84, lyric: lyric || null }));
  return {
    title: "Canção do Mar (demo)", tempo: 92, timeSig: [4, 4], keySig: 0, measures: 8,
    layers: [mel], chords: Array.from({ length: 8 }, () => []),
    annotations: [{ id: uid(), measure: 0, beat: 0, text: "dolce, cantabile", color: "#ffb547" }],
  };
}

class Store {
  score: Score = demoScore();
  compositionId: number | null = null;
  version = 1;
  selectedLayer: string | null = this.score.layers[0]?.id ?? null;
  selectedMeasures = new Set<number>();
  selectedNotes = new Set<string>();
  private undo: string[] = [];
  private redo: string[] = [];
  private listeners = new Set<Listener>();

  on(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(reason = "change") { this.listeners.forEach((l) => l(reason)); }

  /** Aplica mutação com snapshot para desfazer. */
  mutate(fn: (s: Score) => void, reason = "edit") {
    this.undo.push(JSON.stringify(this.score));
    if (this.undo.length > 200) this.undo.shift();
    this.redo = [];
    fn(this.score);
    this.ensureMeasures();
    this.emit(reason);
    scheduleSave();
  }
  undoOp() { const s = this.undo.pop(); if (!s) return; this.redo.push(JSON.stringify(this.score)); this.score = JSON.parse(s); this.emit("undo"); }
  redoOp() { const s = this.redo.pop(); if (!s) return; this.undo.push(JSON.stringify(this.score)); this.score = JSON.parse(s); this.emit("redo"); }

  load(score: Score, id: number | null = null, version = 1) {
    this.score = score; this.compositionId = id; this.version = version;
    this.undo = []; this.redo = [];
    this.selectedLayer = score.layers[0]?.id ?? null;
    this.selectedMeasures.clear(); this.selectedNotes.clear();
    this.ensureMeasures(); this.emit("load");
  }

  layer(id = this.selectedLayer) { return this.score.layers.find((l) => l.id === id) || null; }

  ensureMeasures() {
    const s = this.score;
    const bpm = (s.timeSig[0] * 4) / s.timeSig[1];
    let max = s.measures;
    for (const l of s.layers) for (const n of l.notes) max = Math.max(max, Math.floor((n.start + n.dur - 1e-6) / bpm) + 1);
    s.measures = Math.max(1, max);
    while (s.chords.length < s.measures) s.chords.push([]);
  }

  /** Mescla resultado de IA (transcrição/cifra/harmonização) na composição aberta. */
  mergeResult(r: Partial<Score> & { layers?: Layer[]; chords?: any[][] }, opts: { replaceChordsIn?: number[] } = {}) {
    this.mutate((s) => {
      if (r.tempo) s.tempo = r.tempo;
      if (r.timeSig) s.timeSig = r.timeSig as [number, number];
      if (typeof r.keySig === "number") s.keySig = r.keySig;
      if (r.measures) s.measures = Math.max(s.measures, r.measures);
      for (const l of r.layers || []) s.layers.push({ ...newLayer(l.kind, l.name, l.staff), ...l });
      if (r.chords) {
        r.chords.forEach((cell, m) => {
          if (!cell?.length) return;
          if (opts.replaceChordsIn && !opts.replaceChordsIn.includes(m)) return;
          s.chords[m] = cell;
        });
      }
    }, "merge");
  }
}

export const store = new Store();

// Autosave com debounce (quando autenticado e com composição aberta)
let t: number | undefined;
function scheduleSave() {
  clearTimeout(t);
  t = window.setTimeout(() => store.emit("autosave"), 1500);
}
