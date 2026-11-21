// harmonIA — desktop estilo macOS: barra de menus, seletor de idiomas, menu lateral, ícones, Dock e janelas.
import "./styles/main.css";
import { initWM, openApp, AppDef, onWindowsChange, openWindows, restoreWindow, minimizeAll } from "./core/wm";
import { initDevice, isMobile, preference, setPreference, toggleLargeText, toggleContrast } from "./core/device";
import { ICONS, installIconDefs } from "./core/icons";
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
import { PanelDock } from "./core/paneldock";
import { mountProperties, mountAnnotations } from "./modules/inspector";
import * as audio from "./core/audio";

const VERSION = "0.1.9-alpha";

const APPS: Record<string, AppDef> = {
  compose: { id: "compose", title: t("compose"), icon: ICONS.compose, width: Math.max(560, Math.min(1060, innerWidth - 206 - 312 - 24)), height: 640, x: 206, y: 46, mount: mountScoreEditor },
  import: { id: "import", title: t("import"), icon: ICONS.import, width: 760, height: 560, mount: mountImporter },
  mixer: { id: "mixer", title: t("mixer"), icon: ICONS.mixer, width: 820, height: 460, mount: mountMixer },
  library: { id: "library", title: t("library"), icon: ICONS.library, width: 900, height: 560, mount: mountLibrary },
  graph: { id: "graph", title: t("graph"), icon: ICONS.graph, width: 1100, height: 420, mount: mountGraph },
  agenda: { id: "agenda", title: t("agenda"), icon: ICONS.agenda, width: 820, height: 520, mount: mountAgenda },
  community: { id: "community", title: t("community"), icon: ICONS.community, width: 860, height: 540, mount: mountCommunity },
  account: { id: "account", title: t("account"), icon: ICONS.account, width: 460, height: 560, mount: mountAccount },
  admin: { id: "admin", title: t("admin"), icon: ICONS.admin, width: 920, height: 560, mount: mountAdmin },
};
const ORDER = ["compose", "props", "layers", "notes", "import", "mixer", "library", "graph", "agenda", "community", "admin", "account"];
// Funções administrativas: visíveis e acessíveis somente ao papel admin (o servidor também valida)
const ADMIN_ONLY = new Set(["graph", "admin"]);
const isAdmin = () => currentUser?.role === "admin";
const allowed = (id: string) => !ADMIN_ONLY.has(id) || isAdmin();
const titleOf = (id: string) => APPS[id]?.title ?? t(id);
const iconOf = (id: string) => APPS[id]?.icon ?? PANEL_ICONS[id];
const visible = () => ORDER.filter(allowed);
// Painéis da partitura (dock direito acoplável) — abrem como painel, não como janela
const PANEL_IDS = new Set(["props", "layers", "notes"]);
let panels: PanelDock;
const PANEL_ICONS: Record<string, string> = { props: ICONS.props, layers: ICONS.layers, notes: ICONS.notes };
const open = (id: string) => {
  if (PANEL_IDS.has(id)) { panels?.reveal(id); return; }
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
    menuDyn("Janelas", () => visible().map((id) => [(PANEL_IDS.has(id) ? "▸ Painel: " : "") + titleOf(id), () => open(id)] as [string, () => void])),
    menu("Ajuda", [["Atalhos de teclado", shortcuts], ["Versão para celular", () => setPreference("mobile")], ["Detectar dispositivo automaticamente", () => setPreference("auto")],
      ["Texto maior (liga/desliga)", () => toggleLargeText()], ["Alto contraste (liga/desliga)", () => toggleContrast()], ["Sobre / versão", about]]),
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
    ...visible().filter((id) => !PANEL_IDS.has(id)).map((id) => h("button", { class: "sb-item" + (openWindows().some((w) => w.app.id === id) ? " running" : ""), onclick: () => open(id), title: titleOf(id) },
      h("span", { class: "sb-ic", html: iconOf(id) }), h("span", { class: "sb-label", "data-i18n": id }, t(id)))));
  onWindowsChange(draw); addEventListener("auth", draw); draw();
  return nav;
}

function dock() {
  const d = h("footer", { class: "dock", role: "toolbar", "aria-label": "Dock" });
  const draw = () => {
    d.replaceChildren(...visible().filter((id) => !PANEL_IDS.has(id)).map((id) => {
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

/** O servidor se atualiza sozinho; quando a versão muda, oferece recarregar sem perder o trabalho. */
function watchForUpdates() {
  let running = "";
  const check = async () => {
    try {
      const v = (await (await fetch("/api/health", { cache: "no-store" })).json()).version as string;
      if (!running) { running = v; return; }
      if (v && v !== running && !document.querySelector(".update-bar")) {
        const bar = h("div", { class: "update-bar", role: "status" },
          h("span", {}, `✨ Nova versão do harmonIA instalada (${v}).`),
          h("button", { class: "btn primary", onclick: async () => {
            if (currentUser && store.compositionId) {
              try { await api(`/api/compositions/${store.compositionId}`, { method: "PATCH", json: { score: store.score, version: store.version } }); } catch { /* segue */ }
            }
            location.reload();
          } }, "Recarregar agora"),
          h("button", { class: "btn ghost", onclick: () => bar.remove() }, "Depois"));
        document.body.append(bar);
      }
    } catch { /* offline: tenta de novo depois */ }
  };
  check();
  setInterval(check, 3 * 60 * 1000);
  addEventListener("focus", check);
}

// ============================================================ versão celular
// Início (lançador) + barra inferior fixa (polegar) + folha "Mais". Janelas abrem em tela cheia,
// "‹ Voltar" fecha; os painéis da partitura viram folha inferior.
function mobileShell() {
  const greet = h("p", { class: "m-greet" });
  const setGreet = () => (greet.textContent = currentUser ? `Olá, ${currentUser.name.split(" ")[0]}! O que vamos compor?` : "Bem-vindo ao harmonIA");
  addEventListener("auth", setGreet); setGreet();
  const tile = (id: string, sub: string) => h("button", { class: "m-tile", onclick: () => open(id) },
    h("span", { class: "m-tile-ic", html: iconOf(id) }), h("b", { "data-i18n": id }, t(id)), h("small", {}, sub));
  const tiles = h("div", { class: "m-tiles" });
  const drawTiles = () => tiles.replaceChildren(
    tile("compose", "Editar partitura"), tile("import", "Áudio, foto ou cifra"), tile("library", "Obras e playlists"),
    tile("mixer", "Ouvir e exportar"), tile("agenda", "Estudos e ensaios"), tile("community", "Chat e vídeo"),
    ...(allowed("admin") ? [tile("admin", "Usuários, IA, sistema")] : []), tile("account", currentUser ? "Perfil e privacidade" : "Entrar"));
  addEventListener("auth", drawTiles); drawTiles();
  const home = h("main", { class: "m-home", id: "m-home", "aria-label": "Início" },
    h("div", { class: "m-brand" }, h("b", {}, "harmon"), h("i", {}, "IA")), greet, tiles);

  const more = h("div", { class: "m-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Mais opções", hidden: true });
  const closeMore = () => { more.hidden = true; };
  const drawMore = () => more.replaceChildren(
    h("div", { class: "m-sheet-head" }, h("b", {}, "Mais"), h("button", { class: "sheet-close", "aria-label": "Fechar", onclick: closeMore }, "✕")),
    h("div", { class: "m-list" }, ...visible().filter((id) => !PANEL_IDS.has(id) && !["compose", "import"].includes(id)).map((id) =>
      h("button", { onclick: () => { closeMore(); open(id); } }, h("span", { class: "m-li-ic", html: iconOf(id) }), h("span", { "data-i18n": id }, t(id))))),
    h("h5", {}, "Idioma"),
    h("div", { class: "m-flags", "data-noi18n": "" }, ...LANGS.map((l) => h("button", { class: "flag" + (l.code === lang ? " on" : ""), "aria-label": l.name, "aria-pressed": String(l.code === lang),
      onclick: async () => { closeMore(); await setLang(l.code); } }, l.flag, h("small", {}, l.name)))),
    h("h5", {}, "Acessibilidade"),
    h("div", { class: "m-list" },
      h("button", { "aria-pressed": String(document.body.classList.contains("large-text")), onclick: () => { toggleLargeText(); drawMore(); } }, "🔠 Texto maior", h("small", {}, document.body.classList.contains("large-text") ? "ligado" : "desligado")),
      h("button", { "aria-pressed": String(document.body.classList.contains("high-contrast")), onclick: () => { toggleContrast(); drawMore(); } }, "◐ Alto contraste", h("small", {}, document.body.classList.contains("high-contrast") ? "ligado" : "desligado")),
      h("button", { onclick: () => { closeMore(); setPreference("desktop"); toast("Versão desktop ativada. Para voltar: Ajuda → Versão para celular", "info", 5000); } }, "🖥 Usar versão desktop", h("small", {}, preference() === "auto" ? "detecção automática" : "escolha fixa")),
      h("button", { onclick: () => { closeMore(); shortcuts(); } }, "⌨️ Atalhos e ajuda")));

  const tab = (id: string, label: string, icon: string, fn: () => void) => h("button", { class: "m-tab", "data-tab": id, "aria-label": label, onclick: fn },
    h("span", { class: "m-tab-ic", "aria-hidden": "true" }, icon), h("small", {}, label));
  const tabbar = h("nav", { class: "m-tabbar", "aria-label": "Navegação principal" },
    tab("home", "Início", "⌂", () => { closeMore(); panels.toggleSheet(false); minimizeAll(); }),
    tab("compose", "Compor", "♫", () => { closeMore(); panels.toggleSheet(false); open("compose"); }),
    tab("import", "Importar", "⇪", () => { closeMore(); panels.toggleSheet(false); open("import"); }),
    tab("panels", "Painéis", "☰", () => { closeMore(); panels.toggleSheet(); }),
    tab("more", "Mais", "⋯", () => { panels.toggleSheet(false); if (more.hidden) { drawMore(); more.hidden = false; (more.querySelector("button") as HTMLElement)?.focus(); } else closeMore(); }));
  const markTab = () => {
    const top = openWindows().filter((w) => !w.el.classList.contains("min")).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0];
    const cur = !more.hidden ? "more" : document.body.classList.contains("sheet-open") ? "panels" : top ? (["compose", "import"].includes(top.app.id) ? top.app.id : "") : "home";
    tabbar.querySelectorAll<HTMLElement>(".m-tab").forEach((b) => { const on = b.dataset.tab === cur; b.classList.toggle("on", on); b.setAttribute("aria-current", on ? "page" : "false"); });
    document.body.classList.toggle("m-has-window", !!top);
  };
  onWindowsChange(markTab); addEventListener("sheetchange", markTab);
  new MutationObserver(markTab).observe(more, { attributes: true, attributeFilter: ["hidden"] });
  addEventListener("keydown", (e) => { if (e.key === "Escape") { closeMore(); panels?.toggleSheet(false); } });
  setTimeout(markTab, 0);
  return [home, more, tabbar];
}

async function boot() {
  installIconDefs();
  initDevice();
  const app = document.getElementById("app")!;
  const winLayer = h("div", { class: "win-layer", id: "main-content" });
  const skip = h("a", { class: "skip-link", href: "#main-content" }, "Pular para o conteúdo");
  app.append(skip, menubar(), langbar(), sidebar(), desktopIcons(), winLayer, dock());
  initWM(winLayer);
  panels = new PanelDock(app);
  panels.register([
    { id: "props", title: t("props"), icon: ICONS.props, mount: mountProperties },
    { id: "layers", title: t("layers"), icon: ICONS.layers, mount: mountLayers },
    { id: "notes", title: t("notes"), icon: ICONS.notes, mount: mountAnnotations },
  ]);
  app.append(...mobileShell());
  watchI18n(winLayer);
  mountAvatar();
  addEventListener("layoutchange", (e: any) => toast(e.detail === "mobile" ? "📱 Layout para celular ativado" : "🖥 Layout desktop ativado", "info", 2200));
  addEventListener("open-app", (e: any) => open(e.detail));
  // autosave remoto da composição aberta
  store.on(async (r) => {
    if (r !== "autosave" || !currentUser || !store.compositionId) return;
    try { const x = await api(`/api/compositions/${store.compositionId}`, { method: "PATCH", json: { score: store.score, version: store.version } }); store.version = x.version; }
    catch (e: any) { toast("Autosave: " + e.message, "warn"); }
  });
  document.addEventListener("visibilitychange", () => document.hidden && audio.stop());
  watchForUpdates();
  await restoreSession();
  if (!(await publicRoutes()) && !isMobile()) {
    open("compose"); // no celular começa na tela Início (lançador)
  }
  if (lang !== "pt") setLang(lang);
}
boot();
