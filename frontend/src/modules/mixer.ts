// Mesa de edição: canais por camada (fader, pan visual, mudo/solo), master, transporte e exportação
// MIDI (local) / MusicXML / PDF / WAV / MP3 (servidor) do resultado da combinação.
import { store } from "../core/store";
import { h, toast, busy, download } from "../core/ui";
import * as audio from "../core/audio";
import { scoreToMidi } from "../core/midi";
import { runJob, requireLogin } from "../core/api";

export function mountMixer(body: HTMLElement) {
  body.classList.add("mixer");
  const strips = h("div", { class: "strips" });
  const meter = h("div", { class: "meter" }, h("i"));
  const playBtn = h("button", { class: "btn primary" }, "▶ Tocar mix") as HTMLButtonElement;
  audio.onPlayer((st) => { if (!(st.playing && st.source?.id === "mixer")) playBtn.textContent = "▶ Tocar mix"; });
  playBtn.onclick = () => {
    if (audio.isPlaying() && audio.playerState().source?.id === "mixer") { audio.stop(); playBtn.textContent = "▶ Tocar mix"; return; }
    playBtn.textContent = "■ Parar";
    const total = store.score.measures * (store.score.timeSig[0] * 4) / store.score.timeSig[1];
    audio.play(store.score, { onBeat: (b) => ((meter.firstChild as HTMLElement).style.width = (b / total) * 100 + "%"), onEnd: () => { playBtn.textContent = "▶ Tocar mix"; (meter.firstChild as HTMLElement).style.width = "0"; } },
      { id: "mixer", label: "Mesa de Edição — mix", icon: "🎚", focus: () => dispatchEvent(new CustomEvent("open-app", { detail: "mixer" })) });
  };
  const fmts = ["mid", "musicxml", "pdf", "wav", "mp3"];
  const checks = fmts.map((f) => h("label", { class: "check" }, h("input", { type: "checkbox", value: f, checked: f === "mid" || f === "pdf" }), " ." + f));
  const exp = h("button", { class: "btn accent" }, "⇩ Exportar") as HTMLButtonElement;
  const links = h("div", { class: "links" });
  exp.onclick = async () => {
    const sel = checks.map((c) => c.querySelector("input")!).filter((i) => i.checked).map((i) => i.value);
    if (!sel.length) return;
    const slug = store.score.title.toLowerCase().replace(/[^\w]+/g, "-");
    if (sel.includes("mid")) download(scoreToMidi(store.score), slug + ".mid");
    const server = sel.filter((f) => f !== "mid");
    if (!server.length) return;
    if (!requireLogin()) return;
    busy(exp, true, "Renderizando…");
    try {
      const r = await runJob("export", { score: store.score, formats: server });
      links.replaceChildren(...Object.entries(r.files).map(([k, u]) => h("a", { class: "chip", href: u as string, download: "" }, "⇩ " + k.toUpperCase())));
      toast("Arquivos prontos para download", "ok");
    } catch (e: any) { toast(e.message, "error"); }
    finally { busy(exp, false); }
  };
  body.append(
    h("div", { class: "toolbar" }, playBtn, meter, h("span", { class: "sep" }), ...checks, exp),
    strips, links,
    h("p", { class: "hint" }, "A exportação usa a combinação atual: camadas em Solo têm prioridade; camadas mudas ficam de fora do áudio (mas aparecem na partitura PDF se visíveis). Gravações são mixadas no WAV/MP3."));

  const render = () => strips.replaceChildren(...store.score.layers.map((l) => {
    const fader = h("input", { type: "range", min: 0, max: 1, step: 0.01, value: l.volume, class: "fader", orient: "vertical", "aria-label": "Volume " + l.name,
      oninput: (e: Event) => { l.volume = +(e.target as HTMLInputElement).value; db.textContent = vol2db(l.volume); audio.liveMix(store.score); },
      onchange: () => store.mutate(() => {}, "mix") });
    const db = h("small", { class: "db" }, vol2db(l.volume));
    const prog = h("select", { "aria-label": "Timbre", onchange: (e: Event) => store.mutate(() => (l.program = +(e.target as HTMLSelectElement).value), "mix") },
      ...[[0, "Piano"], [4, "E. Piano"], [48, "Cordas"], [52, "Coro"], [73, "Flauta"], [32, "Baixo ac."], [24, "Violão"]].map(([v, n]) => h("option", { value: v, selected: (l.program || 0) === v }, n as string)));
    return h("div", { class: "strip" + (l.muted ? " muted" : "") + (l.solo ? " solo" : ""), style: { "--lc": l.color } as any },
      h("div", { class: "strip-name", title: l.name }, l.name), prog,
      h("div", { class: "fader-wrap" }, fader), db,
      h("div", { class: "row" },
        h("button", { class: "ic-btn" + (l.muted ? " on" : ""), onclick: () => { store.mutate(() => (l.muted = !l.muted), "mix"); audio.liveMix(store.score); } }, "M"),
        h("button", { class: "ic-btn" + (l.solo ? " on" : ""), onclick: () => { store.mutate(() => (l.solo = !l.solo), "mix"); audio.liveMix(store.score); } }, "S")));
  }));
  const off = store.on((r) => r !== "autosave" && render());
  render();
  return () => { off(); };
}
const vol2db = (v: number) => (v <= 0.001 ? "−∞" : (20 * Math.log10(v)).toFixed(1)) + " dB";
