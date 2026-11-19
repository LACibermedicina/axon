// Motor de áudio: síntese de piano (WebAudio), reprodução por camadas (mute/solo/volume),
// metrônomo, gravação por microfone com contagem, e recorte/ganho de áudio antes do envio.
import { Score, Layer } from "./types";

let ctx: AudioContext | null = null;
let master: GainNode;
export const ac = () => {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};

const freq = (p: number) => 440 * Math.pow(2, (p - 69) / 12);

/** Piano sintetizado: parciais inarmônicos com envelope percussivo. */
export function playNote(pitch: number, when: number, dur: number, vel = 80, gain = 1, dest?: AudioNode) {
  const c = ac();
  const out = c.createGain();
  const v = (vel / 127) * 0.32 * gain;
  const t0 = Math.max(c.currentTime, when);
  const decay = Math.max(0.4, 3.2 - (pitch - 40) * 0.03);
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(v, t0 + 0.005);
  out.gain.exponentialRampToValueAtTime(v * 0.35, t0 + 0.15);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0001, v * 0.35 * Math.exp(-dur / decay)), t0 + dur);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.25);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1200 + vel * 40;
  out.connect(lp).connect(dest || master);
  const f = freq(pitch);
  [[1, 1], [2, 0.45], [3, 0.22], [4, 0.12], [5, 0.06]].forEach(([k, a]) => {
    const o = c.createOscillator();
    o.type = k === 1 ? "triangle" : "sine";
    o.frequency.value = f * k * (1 + 0.0004 * k * k);
    const g = c.createGain(); g.gain.value = a;
    o.connect(g).connect(out);
    o.start(t0); o.stop(t0 + dur + 0.3);
  });
}

export function click(when: number, accent: boolean) {
  const c = ac();
  const o = c.createOscillator(); const g = c.createGain();
  o.frequency.value = accent ? 1600 : 1000;
  g.gain.setValueAtTime(0.25, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(g).connect(master); o.start(when); o.stop(when + 0.06);
}

export interface Transport { stop: () => void; startedAt: number; spb: number; fromBeat: number; }
let current: Transport | null = null;
const audioCache = new Map<string, AudioBuffer>();

async function loadBuffer(url: string) {
  if (audioCache.has(url)) return audioCache.get(url)!;
  const buf = await ac().decodeAudioData(await (await fetch(url)).arrayBuffer());
  audioCache.set(url, buf); return buf;
}

export function audibleLayers(s: Score): Layer[] {
  const solo = s.layers.filter((l) => l.solo);
  return (solo.length ? solo : s.layers.filter((l) => !l.muted));
}

/** Toca a partitura a partir de `fromBeat` (opcionalmente só um trecho). */
export async function play(s: Score, opts: { fromBeat?: number; toBeat?: number; metronome?: boolean; loop?: boolean; onBeat?: (b: number) => void; onEnd?: () => void } = {}) {
  stop();
  const c = ac();
  const spb = 60 / s.tempo;
  const from = opts.fromBeat || 0;
  const bpmM = (s.timeSig[0] * 4) / s.timeSig[1];
  const end = opts.toBeat ?? Math.max(s.measures * bpmM, ...s.layers.flatMap((l) => l.notes.map((n) => n.start + n.dur)));
  const t0 = c.currentTime + 0.12;
  const sources: AudioScheduledSourceNode[] = [];
  for (const l of audibleLayers(s)) {
    for (const n of l.notes) {
      if (n.start + n.dur <= from || n.start >= end) continue;
      const st = Math.max(n.start, from);
      playNote(n.pitch, t0 + (st - from) * spb, (Math.min(n.start + n.dur, end) - st) * spb, n.vel ?? 80, l.volume);
    }
    const url = l.audioUrl || (l.audio ? `/api/media/${l.audio}` : "");
    if (url) {
      try {
        const buf = await loadBuffer(url);
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = l.volume;
        src.connect(g).connect(master);
        const offset = from * spb - (l.audioOffset || 0);
        if (offset >= 0) src.start(t0, offset); else src.start(t0 - offset);
        sources.push(src);
      } catch { /* mídia indisponível */ }
    }
  }
  if (opts.metronome) for (let b = Math.ceil(from); b < end; b++) click(t0 + (b - from) * spb, b % bpmM === 0);
  let raf = 0;
  const tick = () => {
    const b = from + (c.currentTime - t0) / spb;
    if (b >= end) {
      if (opts.loop) { play(s, opts); return; }
      stop(); opts.onEnd?.(); return;
    }
    opts.onBeat?.(Math.max(from, b));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  current = {
    startedAt: t0, spb, fromBeat: from,
    stop: () => { cancelAnimationFrame(raf); sources.forEach((x) => { try { x.stop(); } catch { /* */ } }); master.gain.cancelScheduledValues(0); const g = master.gain.value; master.gain.setValueAtTime(0, c.currentTime); master.gain.setValueAtTime(g, c.currentTime + 0.05); },
  };
  return current;
}

export function stop() { current?.stop(); current = null; }
export const isPlaying = () => !!current;

// ------------------------------------------------------------- gravação
export async function record(opts: { countInBeats: number; spb: number; onCount?: (n: number) => void }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const c = ac();
  for (let i = opts.countInBeats; i > 0; i--) {
    click(c.currentTime + 0.01, i === opts.countInBeats);
    opts.onCount?.(i);
    await new Promise((r) => setTimeout(r, opts.spb * 1000));
  }
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  return {
    stop: () => new Promise<Blob>((res) => {
      rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: rec.mimeType })); };
      rec.stop();
    }),
  };
}

// --------------------------------------------- recorte/ganho antes do envio
export async function decode(blob: Blob) { return ac().decodeAudioData(await blob.arrayBuffer()); }

export function peaks(buf: AudioBuffer, n: number) {
  const d = buf.getChannelData(0); const step = Math.floor(d.length / n) || 1; const out: number[] = [];
  for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < (i + 1) * step && j < d.length; j += 8) m = Math.max(m, Math.abs(d[j])); out.push(m); }
  return out;
}

/** Recorta [start,end] s, aplica ganho e fade, reamostra para 22.05 kHz mono e codifica WAV 16-bit. */
export async function trimToWav(buf: AudioBuffer, start: number, end: number, gainDb = 0, fade = 0.02): Promise<Blob> {
  const sr = 22050;
  const len = Math.max(1, Math.floor((end - start) * sr));
  const off = new OfflineAudioContext(1, len, sr);
  const src = off.createBufferSource(); src.buffer = buf;
  const g = off.createGain(); const lin = Math.pow(10, gainDb / 20);
  g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(lin, fade);
  g.gain.setValueAtTime(lin, Math.max(fade, (end - start) - fade)); g.gain.linearRampToValueAtTime(0, end - start);
  src.connect(g).connect(off.destination); src.start(0, start, end - start);
  const out = await off.startRendering();
  const data = out.getChannelData(0);
  const ab = new ArrayBuffer(44 + data.length * 2); const v = new DataView(ab);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + data.length * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
  return new Blob([ab], { type: "audio/wav" });
}
