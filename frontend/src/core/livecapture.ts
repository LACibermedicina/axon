// Captura de notas ao vivo: a pauta é escrita em tempo real enquanto você canta ou toca.
//  • Microfone: detecção de altura (autocorrelação normalizada, estilo YIN) a cada ~23 ms, com segmentação
//    em notas (estável ≥ 3 quadros = nota; silêncio/troca = fim) e quantização na grade do andamento.
//  • Teclado MIDI (Web MIDI), quando houver: notas e intensidade exatas.
// Cada nota terminada entra na camada "Captura ao vivo" (com contagem de 1 compasso e metrônomo opcional).
import * as audio from "./audio";
import { store, newLayer } from "./store";
import { beatsPerMeasure, Note, uid } from "./types";

export interface CaptureOpts {
  fromBeat?: number; grid?: number; metronome?: boolean;
  onPitch?: (midi: number | null, level: number) => void; // indicador ao vivo
  onNote?: (n: Note) => void;
}
export interface Capture { stop: () => Promise<number>; layerId: string; midi: boolean }

/** Frequência fundamental por autocorrelação normalizada (diferença cumulativa, YIN simplificado). */
export function detectPitch(buf: Float32Array, sr: number): { f: number; clarity: number } | null {
  const n = buf.length, half = Math.floor(n / 2);
  let rms = 0; for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n); if (rms < 0.012) return null;
  const minLag = Math.floor(sr / 1050), maxLag = Math.min(half - 1, Math.floor(sr / 65));
  const d = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) { let s = 0; for (let i = 0; i < half; i++) { const x = buf[i] - buf[i + lag]; s += x * x; } d[lag] = s; }
  // diferença cumulativa normalizada
  let run = 0; const cm = new Float32Array(maxLag + 1); cm[minLag] = 1;
  for (let lag = minLag; lag <= maxLag; lag++) { run += d[lag]; cm[lag] = run ? (d[lag] * (lag - minLag + 1)) / run : 1; }
  let best = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) if (cm[lag] < 0.15 && cm[lag] <= cm[lag + 1]) { best = lag; break; }
  if (best < 0) { let mn = 1; for (let lag = minLag; lag <= maxLag; lag++) if (cm[lag] < mn) { mn = cm[lag]; best = lag; } if (mn > 0.35) return null; }
  // interpolação parabólica
  const a = cm[best - 1] ?? cm[best], b = cm[best], c = cm[best + 1] ?? cm[best];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { f: sr / (best + (isFinite(shift) ? shift : 0)), clarity: 1 - b };
}
export const freqToMidi = (f: number) => Math.round(69 + 12 * Math.log2(f / 440));

export async function startCapture(o: CaptureOpts = {}): Promise<Capture> {
  const s = store.score, bpm = beatsPerMeasure(s), spb = 60 / s.tempo, grid = o.grid ?? 0.25;
  const fromBeat = o.fromBeat ?? 0;
  const layer = newLayer("melody", "Captura ao vivo", "treble");
  store.mutate((sc) => { sc.layers.push(layer); store.selectedLayer = layer.id; }, "capture");
  const c = audio.ac();
  // contagem de 1 compasso (cliques) e, depois, metrônomo contínuo opcional
  const t0 = c.currentTime + 0.1 + bpm * spb;
  for (let i = 0; i < bpm; i++) audio.click(c.currentTime + 0.1 + i * spb, i === 0);
  let metroTimer = 0;
  if (o.metronome) { let k = 0; metroTimer = window.setInterval(() => { const t = t0 + k * spb; if (t - c.currentTime < 0.3) { audio.click(Math.max(t, c.currentTime), k % bpm === 0); k++; } }, 40); }
  const beatAt = (time: number) => fromBeat + (time - t0) / spb;
  const q = (b: number) => Math.max(fromBeat, Math.round(b / grid) * grid);
  const add = (pitch: number, onT: number, offT: number, vel: number) => {
    const st = q(beatAt(onT)); const dur = Math.max(grid, Math.round((beatAt(offT) - beatAt(onT)) / grid) * grid);
    if (beatAt(offT) < fromBeat) return;
    const n: Note = { id: uid(), pitch, start: st, dur, vel };
    store.mutate((sc) => { const l = sc.layers.find((x) => x.id === layer.id); if (l) l.notes.push(n); sc.measures = Math.max(sc.measures, Math.ceil((st + dur) / bpm)); while (sc.chords.length < sc.measures) sc.chords.push([]); }, "capture-note");
    o.onNote?.(n);
  };

  // ---- teclado MIDI (preferido quando existe)
  let midiAccess: any = null; const held = new Map<number, { t: number; v: number }>();
  try {
    if ((navigator as any).requestMIDIAccess) {
      midiAccess = await (navigator as any).requestMIDIAccess();
      const inputs = [...midiAccess.inputs.values()];
      if (!inputs.length) midiAccess = null;
      else inputs.forEach((inp: any) => (inp.onmidimessage = (e: any) => {
        const [st, note, vel] = e.data; const cmd = st & 0xf0;
        if (cmd === 0x90 && vel > 0) { held.set(note, { t: c.currentTime, v: vel }); audio.playNote(note, 0, 0.4, vel); o.onPitch?.(note, vel / 127); }
        else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) { const h = held.get(note); if (h) { held.delete(note); add(note, h.t, c.currentTime, h.v); } o.onPitch?.(null, 0); }
      }));
    }
  } catch { midiAccess = null; }

  // ---- microfone
  let stream: MediaStream | null = null, timer = 0;
  if (!midiAccess) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const src = c.createMediaStreamSource(stream);
    const an = c.createAnalyser(); an.fftSize = 2048; src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let cur: { midi: number; t: number; lvl: number } | null = null, cand = -1, candN = 0, silentN = 0;
    timer = window.setInterval(() => {
      an.getFloatTimeDomainData(buf);
      const now = c.currentTime;
      let lvl = 0; for (let i = 0; i < buf.length; i += 4) lvl = Math.max(lvl, Math.abs(buf[i]));
      const p = now >= t0 - 0.05 ? detectPitch(buf, c.sampleRate) : null;
      const m = p && p.clarity > 0.6 ? freqToMidi(p.f) : null;
      o.onPitch?.(m, Math.min(1, lvl * 2));
      if (m === null || m < 28 || m > 100) {
        if (cur && ++silentN >= 3) { add(cur.midi, cur.t, now - 0.05, Math.round(50 + cur.lvl * 70)); cur = null; }
        cand = -1; candN = 0; return;
      }
      silentN = 0;
      if (cur && Math.abs(m - cur.midi) <= 0) { cur.lvl = Math.max(cur.lvl, lvl); return; }
      if (m === cand) candN++; else { cand = m; candN = 1; }
      if (candN >= 3) { // altura estável: termina a anterior e começa a nova
        if (cur) add(cur.midi, cur.t, now - 0.07, Math.round(50 + cur.lvl * 70));
        cur = { midi: m, t: now - 0.07, lvl }; candN = 0;
      }
    }, 23);
    return {
      layerId: layer.id, midi: false,
      stop: async () => {
        clearInterval(timer); clearInterval(metroTimer);
        if (cur) add(cur.midi, cur.t, c.currentTime, Math.round(50 + cur.lvl * 70));
        stream?.getTracks().forEach((t) => t.stop());
        o.onPitch?.(null, 0);
        return store.score.layers.find((x) => x.id === layer.id)?.notes.length ?? 0;
      },
    };
  }
  return {
    layerId: layer.id, midi: true,
    stop: async () => {
      clearInterval(metroTimer);
      held.forEach((h, note) => add(note, h.t, c.currentTime, h.v)); held.clear();
      [...midiAccess.inputs.values()].forEach((inp: any) => (inp.onmidimessage = null));
      return store.score.layers.find((x) => x.id === layer.id)?.notes.length ?? 0;
    },
  };
}
