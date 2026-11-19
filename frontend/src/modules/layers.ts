// Gestor de camadas: visibilidade, mudo, solo, bloqueio, cor, volume, pauta, reordenar (drag & drop),
// mesclar, duplicar, transpor, transcrever gravações e alinhar letra.
import { store, newLayer } from "../core/store";
import { Layer, LayerKind } from "../core/types";
import { h, toast, tip } from "../core/ui";
import { currentUser, runJob, requireLogin } from "../core/api";
import { extractMelody } from "../core/theory";

const KIND_LABEL: Record<LayerKind, string> = { melody: "Melodia", harmony: "Harmonia", voice: "Voz", bass: "Baixo", omr: "OMR", recording: "Gravação" };

export function mountLayers(body: HTMLElement) {
  body.classList.add("layers-app");
  const list = h("ul", { class: "layer-list", role: "listbox", "aria-label": "Camadas" });
  const addSel = h("select", { "aria-label": "Tipo de nova camada" }, ...(["melody", "harmony", "voice", "bass"] as LayerKind[]).map((k) => h("option", { value: k }, KIND_LABEL[k])));
  const toolbar = h("div", { class: "toolbar" },
    addSel,
    h("button", { class: "btn primary", onclick: () => store.mutate((s) => { const k = addSel.value as LayerKind; const l = newLayer(k, KIND_LABEL[k], k === "harmony" || k === "bass" ? "bass" : "treble"); s.layers.push(l); store.selectedLayer = l.id; }, "layer") }, "+ Camada"),
    tip(h("button", { class: "btn", onclick: merge }, "Mesclar visíveis"), "Junta as camadas visíveis desbloqueadas numa só"),
    tip(h("button", { class: "btn", onclick: lyricsDialog }, "Letra → notas"), "Distribui a letra (silabada automaticamente) nas notas da camada ativa"));
  const help = h("p", { class: "hint" }, "Arraste ☰ para reordenar (a ordem define a prioridade na mixagem e na exportação). Clique numa camada para torná-la ativa no editor.");
  body.append(toolbar, list, help);

  let dragId: string | null = null;

  function row(l: Layer) {
    const active = l.id === store.selectedLayer;
    const toggle = (key: "visible" | "muted" | "solo" | "locked", on: string, off: string, label: string) =>
      h("button", { class: "ic-btn" + (l[key] ? " on" : ""), "aria-pressed": String(!!l[key]), title: label,
        onclick: (e: Event) => { e.stopPropagation(); store.mutate(() => { (l as any)[key] = !l[key]; }, "layer"); } }, l[key] ? on : off);
    const li = h("li", { class: "layer-row" + (active ? " active" : ""), draggable: "true", "data-id": l.id, style: { "--lc": l.color } as any,
      onclick: () => { store.selectedLayer = l.id; store.emit("selection"); } },
      h("span", { class: "grip", "aria-hidden": "true" }, "☰"),
      h("input", { type: "color", value: l.color, "aria-label": "Cor", onclick: (e: Event) => e.stopPropagation(), onchange: (e: Event) => store.mutate(() => (l.color = (e.target as HTMLInputElement).value), "layer") }),
      h("div", { class: "lname" },
        h("input", { value: l.name, "aria-label": "Nome", onclick: (e: Event) => e.stopPropagation(), onchange: (e: Event) => store.mutate(() => (l.name = (e.target as HTMLInputElement).value), "layer") }),
        h("small", {}, `${KIND_LABEL[l.kind]} · ${l.kind === "recording" ? "áudio" : l.notes.length + " notas"} · ${l.staff === "bass" ? "𝄢 Fá" : "𝄞 Sol"}`)),
      toggle("visible", "👁", "◌", "Visível"), toggle("muted", "🔇", "🔈", "Mudo"), toggle("solo", "S", "S", "Solo"), toggle("locked", "🔒", "🔓", "Bloquear edição"),
      h("input", { type: "range", min: 0, max: 1, step: 0.05, value: l.volume, class: "vol", "aria-label": "Volume", onclick: (e: Event) => e.stopPropagation(),
        onchange: (e: Event) => store.mutate(() => (l.volume = +(e.target as HTMLInputElement).value), "layer") }),
      menu(l));
    li.addEventListener("dragstart", (e) => { dragId = l.id; li.classList.add("dragging"); e.dataTransfer!.effectAllowed = "move"; });
    li.addEventListener("dragend", () => { li.classList.remove("dragging"); dragId = null; });
    li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("over"); });
    li.addEventListener("dragleave", () => li.classList.remove("over"));
    li.addEventListener("drop", (e) => {
      e.preventDefault(); li.classList.remove("over");
      if (!dragId || dragId === l.id) return;
      store.mutate((s) => { const from = s.layers.findIndex((x) => x.id === dragId); const [m] = s.layers.splice(from, 1); s.layers.splice(s.layers.findIndex((x) => x.id === l.id), 0, m); }, "reorder");
    });
    return li;
  }

  function menu(l: Layer) {
    const sel = h("select", { class: "row-menu", "aria-label": "Ações da camada", onclick: (e: Event) => e.stopPropagation() },
      h("option", { value: "" }, "⋯"),
      h("option", { value: "staff" }, "Trocar pauta (Sol/Fá)"),
      h("option", { value: "dup" }, "Duplicar"),
      h("option", { value: "up" }, "Transpor +1 st"), h("option", { value: "down" }, "Transpor −1 st"),
      h("option", { value: "oct+" }, "Oitava acima"), h("option", { value: "oct-" }, "Oitava abaixo"),
      h("option", { value: "melody" }, "Extrair melodia desta camada"),
      l.kind === "recording" ? h("option", { value: "transcribe" }, "Transcrever gravação → notas") : null,
      h("option", { value: "clear-lyrics" }, "Limpar letra"),
      h("option", { value: "delete" }, "Excluir camada"));
    sel.addEventListener("change", async () => {
      const v = sel.value; sel.value = "";
      const tr = (d: number) => store.mutate(() => l.notes.forEach((n) => (n.pitch = Math.max(21, Math.min(108, n.pitch + d)))), "layer");
      if (v === "staff") store.mutate(() => (l.staff = l.staff === "bass" ? "treble" : "bass"), "layer");
      if (v === "dup") store.mutate((s) => s.layers.push({ ...JSON.parse(JSON.stringify(l)), id: Math.random().toString(36).slice(2), name: l.name + " (cópia)" }), "layer");
      if (v === "up") tr(1); if (v === "down") tr(-1); if (v === "oct+") tr(12); if (v === "oct-") tr(-12);
      if (v === "melody") store.mutate((s) => { const m = newLayer("melody", "Melodia de " + l.name); m.notes = extractMelody(l.notes, 0); s.layers.push(m); }, "layer");
      if (v === "clear-lyrics") store.mutate(() => l.notes.forEach((n) => (n.lyric = null)), "layer");
      if (v === "delete" && confirmDelete(l)) store.mutate((s) => (s.layers = s.layers.filter((x) => x.id !== l.id)), "layer");
      if (v === "transcribe") await transcribeRecording(l);
    });
    return sel;
  }

  function confirmDelete(l: Layer) {
    if (!l.notes.length) return true;
    const ok = window.confirm(`Excluir "${l.name}" com ${l.notes.length} notas? (Pode desfazer com ⌘Z)`);
    return ok;
  }

  async function transcribeRecording(l: Layer) {
    if (!requireLogin()) return;
    if (!l.audio) { toast("A gravação ainda está sendo enviada…", "warn"); return; }
    const s = store.score; const bpm = (s.timeSig[0] * 4) / s.timeSig[1];
    toast("Transcrevendo gravação com IA…");
    try {
      const r = await runJob("transcribe_audio", { asset: l.audio, mode: "melody", separate: false, lyrics: true, tempo: s.tempo, timeSig: s.timeSig });
      const offBeats = (l.measures?.[0] ?? 0) * bpm;
      store.mutate((sc) => {
        for (const nl of r.layers) {
          nl.notes.forEach((n: any) => (n.start += offBeats));
          sc.layers.push({ ...newLayer(nl.kind, `${nl.name} (c.${(l.measures?.[0] ?? 0) + 1})`, nl.staff), ...nl, name: `${nl.name} (c.${(l.measures?.[0] ?? 0) + 1})` });
        }
      }, "merge");
      toast("Trecho transcrito e encaixado nos compassos gravados", "ok");
    } catch (e: any) { toast(e.message, "error"); }
  }

  function merge() {
    const vis = store.score.layers.filter((l) => l.visible && !l.locked && l.kind !== "recording");
    if (vis.length < 2) { toast("Deixe ao menos duas camadas visíveis e desbloqueadas", "warn"); return; }
    store.mutate((s) => {
      const m = newLayer("harmony", "Mesclada", vis[0].staff);
      m.notes = vis.flatMap((l) => l.notes.map((n) => ({ ...n })));
      s.layers = s.layers.filter((l) => !vis.includes(l)); s.layers.push(m);
    }, "merge");
  }

  function lyricsDialog() {
    const l = store.layer();
    if (!l || l.kind === "recording") { toast("Selecione uma camada de melodia/voz", "warn"); return; }
    const ta = h("textarea", { rows: 4, placeholder: "Cole a letra aqui…" }) as HTMLTextAreaElement;
    const dlg = h("div", { class: "sheet" }, h("h4", {}, `Letra para "${l.name}"`), ta,
      h("p", { class: "hint" }, "A letra é dividida em sílabas e encaixada nas notas, respeitando pausas (≥ 1 tempo) como fim de frase. Ajuste depois com a ferramenta Letra."),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => dlg.remove() }, "Cancelar"),
        h("button", { class: "btn primary", onclick: async () => {
          try {
            if (currentUser) {
              const r = await runJob("lyrics", { score: store.score, layer: l.id, text: ta.value });
              store.mutate(() => (l.notes = r.notes), "lyrics");
            } else {
              const syl = ta.value.split(/\s+/).filter(Boolean);
              store.mutate(() => [...l.notes].sort((a, b) => a.start - b.start).forEach((n, i) => (n.lyric = syl[i] ?? null)), "lyrics");
            }
            dlg.remove(); toast("Letra aplicada", "ok");
          } catch (e: any) { toast(e.message, "error"); }
        } }, "Aplicar")));
    body.append(dlg); ta.focus();
  }

  const render = () => list.replaceChildren(...store.score.layers.map(row), ...(store.score.layers.length ? [] : [h("li", { class: "empty" }, "Nenhuma camada. Importe áudio, foto ou cifra — ou crie uma camada.")]));
  const off = store.on((r) => r !== "autosave" && render());
  render();
  return () => off();
}
