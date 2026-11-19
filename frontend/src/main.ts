// harmonIA — desktop estilo macOS: barra de menus, seletor de idiomas, menu lateral, ícones, Dock e janelas.
import "./styles/main.css";
import { initWM, openApp, AppDef, onWindowsChange, openWindows, restoreWindow } from "./core/wm";
import { ICONS } from "./core/icons";
import { h, toast } from "./core/ui";
import { LANGS, setLang, lang, t, watchI18n } from "./core/i18n";
import { restoreSession, currentUser, api } from "./core/api";
import { store } from "./core/store";
import { mountScoreEditor } from "./modules/score-editor";
import { mountLayers } from "./modules/layers";
import { mountImporter } from "./modules/importer";
import { mountMixer } from "./modules/mixer";
import { mountLibrary } from "./modules/library";
import { mountGraph } from "./modules/graph";
import { mountAgenda } from "./modules/agenda";
import { mountCommunity } from "./modules/community";
import { mountAccount } from "./modules/account";
import { mountAvatar } from "./modules/avatar";
import { mountAdmin } from "./modules/admin";
import * as audio from "./core/audio";

const VERSION = "0.1.3-alpha";

const APPS: Record<string, AppDef> = {
  compose: { id: "compose", title: t("compose"), icon: ICONS.compose, width: 1060, height: 640, x: 206, y: 46, mount: mountScoreEditor },
  import: { id: "import", title: t("import"), icon: ICONS.import, width: 760, height: 560, mount: mountImporter },
  layers: { id: "layers", title: t("layers"), icon: ICONS.layers, width: 560, height: 440, mount: mountLayers },
  mixer: { id: "mixer", title: t("mixer"), icon: ICONS.mixer, width: 820, height: 460, mount: mountMixer },
  library: { id: "library", title: t("library"), icon: ICONS.library, width: 900, height: 560, mount: mountLibrary },
  graph: { id: "graph", title: t("graph"), icon: ICONS.graph, width: 1100, height: 420, mount: mountGraph },
  agenda: { id: "agenda", title: t("agenda"), icon: ICONS.agenda, width: 820, height: 520, mount: mountAgenda },
  community: { id: "community", title: t("community"), icon: ICONS.community, width: 860, height: 540, mount: mountCommunity },
  account: { id: "account", title: t("account"), icon: ICONS.account, width: 460, height: 560, mount: mountAccount },
  admin: { id: "admin", title: t("admin"), icon: ICONS.admin, width: 920, height: 560, mount: mountAdmin },
};
const ORDER = ["compose", "import", "layers", "mixer", "library", "graph", "agenda", "community", "admin", "account"];
// Funções administrativas: visíveis e acessíveis somente ao papel admin (o servidor também valida)
const ADMIN_ONLY = new Set(["graph", "admin"]);
const isAdmin = () => currentUser?.role === "admin";
const allowed = (id: string) => !ADMIN_ONLY.has(id) || isAdmin();
const visible = () => ORDER.filter(allowed);
const open = (id: string) => {
  if (!APPS[id]) return;
  if (!allowed(id)) { toast("Acesso restrito ao administrador", "warn"); return; }
  return openApp(APPS[id]);
};
// Ao sair/trocar de conta, fecha janelas administrativas abertas
addEventListener("auth", () => openWindows().forEach((w) => !allowed(w.app.id) && w.close()));

function menubar() {
  const clock = h("span", { class: "clock", "data-noi18n": "" });
  const tick = () => (clock.textContent = new Date().toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }));
  tick(); setInterval(tick, 20000);
  const userBtn = h("button", { class: "mb-item", onclick: () => open("account") });
  const setUser = () => (userBtn.textContent = currentUser ? "👤 " + currentUser.name.split(" ")[0] : "Entrar");
  addEventListener("auth", setUser); setUser();
  const menu = (label: string, items: [string, () => void][]) => {
    const dd = h("div", { class: "dropdown" }, ...items.map(([l, fn]) => h("button", { onclick: () => { dd.parentElement!.classList.remove("open"); fn(); } }, l)));
    const m = h("div", { class: "mb-menu" }, h("button", { class: "mb-item", onclick: (e: Event) => { e.stopPropagation(); document.querySelectorAll(".mb-menu.open").forEach((x) => x !== m && x.classList.remove("open")); m.classList.toggle("open"); } }, label), dd);
    return m;
  };
  const menuDyn = (label: string, items: () => [string, () => void][]) => {
    const m = menu(label, []);
    const dd = m.querySelector(".dropdown")!;
    m.querySelector(".mb-item")!.addEventListener("click", () => dd.replaceChildren(...items().map(([l, fn]) => h("button", { onclick: () => { m.classList.remove("open"); fn(); } }, l))));
    return m;
  };
  addEventListener("click", () => document.querySelectorAll(".mb-menu.open").forEach((x) => x.classList.remove("open")));
  return h("header", { class: "menubar" },
    h("button", { class: "mb-logo", onclick: () => about(), "aria-label": "Sobre o harmonIA" }, h("b", {}, "harmon"), h("i", {}, "IA")),
    menu("Arquivo", [["Nova composição", () => { if (confirm("Começar uma composição nova? (a atual continua na biblioteca se foi salva)")) store.load({ title: "Sem título", tempo: 96, timeSig: [4, 4], keySig: 0, measures: 8, layers: [], chords: [], annotations: [] }); }],
      ["Importar áudio / foto / cifra…", () => open("import")], ["Biblioteca", () => open("library")], ["Exportar…", () => open("mixer")]]),
    menu("Editar", [["Desfazer ⌘Z", () => store.undoOp()], ["Refazer ⇧⌘Z", () => store.redoOp()], ["Selecionar todos os compassos", () => { store.selectedMeasures = new Set([...Array(store.score.measures).keys()]); store.emit("selection"); }]]),
    menuDyn("Janelas", () => visible().map((id) => [APPS[id].title, () => open(id)] as [string, () => void])),
    menu("Ajuda", [["Atalhos de teclado", shortcuts], ["Sobre / versão", about]]),
    h("span", { class: "spacer" }), clock, userBtn);
}

function langbar() {
  const bar = h("div", { class: "langbar", role: "group", "aria-label": "Idioma" }, ...LANGS.map((l) =>
    h("button", { class: "flag" + (l.code === lang ? " on" : ""), title: l.name, "aria-label": l.name, "data-noi18n": "",
      onclick: async (e: Event) => { bar.querySelectorAll(".flag").forEach((b) => b.classList.remove("on")); (e.currentTarget as HTMLElement).classList.add("on"); await setLang(l.code); } }, l.flag)));
  return bar;
}

function sidebar() {
  const nav = h("nav", { class: "sidebar", "aria-label": "Navegação" });
  const draw = () => nav.replaceChildren(
    h("button", { class: "sb-toggle", title: "Recolher/expandir", onclick: () => document.body.classList.toggle("sb-collapsed") }, "☰"),
    ...visible().map((id) => h("button", { class: "sb-item" + (openWindows().some((w) => w.app.id === id) ? " running" : ""), onclick: () => open(id), title: APPS[id].title },
      h("span", { class: "sb-ic", html: APPS[id].icon }), h("span", { class: "sb-label", "data-i18n": id }, t(id)))));
  onWindowsChange(draw); addEventListener("auth", draw); draw();
  return nav;
}

function dock() {
  const d = h("footer", { class: "dock", role: "toolbar", "aria-label": "Dock" });
  const draw = () => {
    d.replaceChildren(...visible().map((id) => {
      const running = openWindows().filter((w) => w.app.id === id);
      return h("button", { class: "dock-item" + (running.length ? " running" : ""), "aria-label": APPS[id].title,
        onclick: () => (running.length && running[0].el.classList.contains("min") ? restoreWindow(running[0]) : open(id)) },
        h("span", { class: "dock-ic", html: APPS[id].icon }), h("span", { class: "dock-tip", "data-i18n": id }, t(id)));
    }));
    // magnificação estilo macOS
    d.onpointermove = (e) => d.querySelectorAll<HTMLElement>(".dock-item").forEach((it) => {
      const r = it.getBoundingClientRect(); const dist = Math.abs(e.clientX - (r.left + r.width / 2));
      it.style.setProperty("--s", String(1 + Math.max(0, 1 - dist / 150) * 0.55));
    });
    d.onpointerleave = () => d.querySelectorAll<HTMLElement>(".dock-item").forEach((it) => it.style.setProperty("--s", "1"));
  };
  onWindowsChange(draw); addEventListener("auth", draw); draw();
  return d;
}

function desktopIcons() {
  const box = h("div", { class: "desk-icons" });
  const draw = () => box.replaceChildren(...["import", "library", "graph", "admin"].filter(allowed).map((id) =>
    h("button", { class: "desk-icon", ondblclick: () => open(id), onclick: (e: Event) => (e.currentTarget as HTMLElement).classList.toggle("sel") },
      h("span", { html: APPS[id].icon }), h("small", { "data-i18n": id }, t(id)))));
  addEventListener("auth", draw); draw();
  return box;
}

function shortcuts() {
  openApp({ id: "help", title: "Atalhos", icon: ICONS.maestro, width: 460, height: 420, mount: (b) => {
    b.append(h("table", { class: "kbd" }, ...[["Espaço", "Tocar / parar"], ["V N E C L A", "Ferramentas: mover, nota, apagar, cifra, letra, anotação"], ["1–5", "Duração: semibreve → semicolcheia"],
      ["↑ ↓ (Shift = oitava)", "Transpor notas selecionadas"], ["← →", "Mover no tempo"], ["Delete", "Apagar seleção"], ["⌘Z / ⇧⌘Z", "Desfazer / refazer"], ["⌘A", "Selecionar camada"],
      ["Alt + arrastar", "Duplicar nota"], ["⌘W", "Fechar janela"], ["Duplo clique no desktop", "Fecha a janela ativa"]].map(([k, v]) => h("tr", {}, h("td", {}, h("kbd", {}, k)), h("td", {}, v)))));
  } });
}
async function about() {
  let api_v = "offline";
  try { api_v = (await api("/api/health")).version; } catch { /* */ }
  toast(`harmonIA web ${VERSION} · API ${api_v} · harmonia.m3d.pro`, "info", 5000);
}

/** Rotas públicas: /s/<token> (link compartilhado) e /biblioteca (link principal). */
async function publicRoutes() {
  const m = location.pathname.match(/^\/s\/([\w-]+)/);
  if (m) {
    try {
      const r = await api(`/api/share/${m[1]}`);
      if (r.type === "composition") { store.load(r.score); open("compose"); toast(`"${r.title}" por ${r.author} — modo visualização. Toque ▶ para ouvir.`, "info", 7000); }
      else { open("library"); toast(`${r.kind === "album" ? "Álbum" : "Playlist"} compartilhado: ${r.title}`, "info"); }
    } catch (e: any) { toast(e.message, "error"); }
    return true;
  }
  if (location.pathname.startsWith("/biblioteca")) { open("library"); return true; }
  return false;
}

async function boot() {
  const app = document.getElementById("app")!;
  const winLayer = h("div", { class: "win-layer" });
  app.append(menubar(), langbar(), sidebar(), desktopIcons(), winLayer, dock());
  initWM(winLayer);
  watchI18n(winLayer);
  mountAvatar();
  addEventListener("open-app", (e: any) => open(e.detail));
  // autosave remoto da composição aberta
  store.on(async (r) => {
    if (r !== "autosave" || !currentUser || !store.compositionId) return;
    try { const x = await api(`/api/compositions/${store.compositionId}`, { method: "PATCH", json: { score: store.score, version: store.version } }); store.version = x.version; }
    catch (e: any) { toast("Autosave: " + e.message, "warn"); }
  });
  document.addEventListener("visibilitychange", () => document.hidden && audio.stop());
  await restoreSession();
  if (!(await publicRoutes())) {
    open("compose");
    setTimeout(() => open("layers"), 150);
  }
  if (lang !== "pt") setLang(lang);
}
boot();
