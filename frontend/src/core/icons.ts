// Ícones 3D estilo "Pixar": volumes com gradiente radial, brilho especular, sombra de contato
// e personagens amigáveis. Micro-animações via CSS (.dock-item:hover .ic-*).
// Gradientes ficam num único <svg> global (sempre renderizado). Assim o mesmo ícone pode aparecer em
// vários lugares — inclusive dentro de elementos ocultos — sem IDs duplicados quebrando o preenchimento.
const DEFS: string[] = [];
const base = (id: string, c1: string, c2: string, inner: string) => {
  DEFS.push(`<radialGradient id="hg${id}" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`);
  return `
<svg viewBox="0 0 64 64" class="ic3d" aria-hidden="true">
  <ellipse cx="32" cy="59" rx="20" ry="3.2" fill="#000" opacity=".22"/>
  <rect x="5" y="4" width="54" height="52" rx="15" fill="url(#hg${id})"/>
  <rect x="5" y="4" width="54" height="52" rx="15" fill="none" stroke="#fff" stroke-opacity=".35"/>
  <path d="M12 12 Q32 2 52 12 L52 22 Q32 14 12 22Z" fill="url(#hgshine)" opacity=".55"/>
  ${inner}
</svg>`;
};
DEFS.push(`<linearGradient id="hgshine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);

/** Injeta as definições de gradiente uma única vez no documento. */
export function installIconDefs() {
  if (document.getElementById("harmonia-icon-defs")) return;
  const d = document.createElement("div");
  d.innerHTML = `<svg id="harmonia-icon-defs" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>${DEFS.join("")}</defs></svg>`;
  document.body.prepend(d.firstElementChild!);
}

const eyes = (x: number, y: number) => `<g class="ic-eyes"><circle cx="${x}" cy="${y}" r="3.2" fill="#fff"/><circle cx="${x + 10}" cy="${y}" r="3.2" fill="#fff"/><circle cx="${x + .8}" cy="${y + .6}" r="1.6" fill="#1b1b2f"/><circle cx="${x + 10.8}" cy="${y + .6}" r="1.6" fill="#1b1b2f"/></g>`;

export const ICONS: Record<string, string> = {
  compose: base("c", "#a58bff", "#5a35d6", `<g class="ic-bounce"><ellipse cx="25" cy="42" rx="8" ry="6" fill="#fff" transform="rotate(-20 25 42)"/><rect x="31" y="16" width="4" height="27" rx="2" fill="#fff"/><path d="M35 16 q10 4 9 13 q-3-6-9-6z" fill="#ffd36e"/>${eyes(20, 40)}</g>`),
  import: base("i", "#7fe3ff", "#1b8fd6", `<g class="ic-bounce"><path d="M32 14 v20" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M22 27 l10 10 l10-10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="16" y="40" width="32" height="7" rx="3.5" fill="#fff" opacity=".9"/></g>`),
  layers: base("l", "#ffb3d1", "#e0397a", `<g class="ic-stack"><path d="M32 16 L50 25 L32 34 L14 25Z" fill="#fff"/><path d="M14 31 L32 40 L50 31" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round" opacity=".85"/><path d="M14 37 L32 46 L50 37" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round" opacity=".6"/></g>`),
  mixer: base("m", "#ffd98a", "#f08a1c", `<g class="ic-faders">${[18, 32, 46].map((x, i) => `<rect x="${x - 1.5}" y="14" width="3" height="32" rx="1.5" fill="#fff" opacity=".6"/><rect class="fd fd${i}" x="${x - 5}" y="${[30, 20, 36][i]}" width="10" height="6" rx="3" fill="#fff"/>`).join("")}</g>`),
  library: base("b", "#8ef0c0", "#16a37a", `<g class="ic-bounce"><rect x="15" y="15" width="8" height="30" rx="2" fill="#fff"/><rect x="26" y="18" width="8" height="27" rx="2" fill="#fff" opacity=".85"/><rect x="37" y="14" width="9" height="31" rx="2" fill="#fff" transform="rotate(10 41 30)" opacity=".95"/><circle cx="41" cy="22" r="2" fill="#16a37a"/></g>`),
  graph: base("g", "#b7c4ff", "#4057e0", `<g class="ic-pulse"><path d="M20 22 L44 22 M20 22 L32 42 M44 22 L32 42" stroke="#fff" stroke-width="3" opacity=".8"/><circle cx="20" cy="22" r="6" fill="#fff"/><circle cx="44" cy="22" r="6" fill="#ffd36e"/><circle cx="32" cy="42" r="6" fill="#fff"/></g>`),
  agenda: base("a", "#ffeaa0", "#ff9f43", `<g class="ic-bounce"><rect x="14" y="17" width="36" height="30" rx="6" fill="#fff"/><rect x="14" y="17" width="36" height="9" rx="4" fill="#ff5d5d"/><text x="32" y="43" text-anchor="middle" font-size="15" font-weight="800" fill="#ff7a2f" font-family="system-ui">18</text></g>`),
  community: base("u", "#ffb0a0", "#ff5f6d", `<g class="ic-bounce"><path d="M14 20 h24 a6 6 0 0 1 6 6 v8 a6 6 0 0 1 -6 6 h-14 l-7 6 v-6 h-3 a6 6 0 0 1 -6 -6 v-8 a6 6 0 0 1 6 -6z" fill="#fff"/>${eyes(21, 29)}<path d="M26 34 q4 3 8 0" stroke="#1b1b2f" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`),
  account: base("p", "#c9d6e8", "#5c6f8c", `<g class="ic-bounce"><circle cx="32" cy="25" r="9" fill="#fff"/><path d="M16 48 q16 -18 32 0z" fill="#fff"/></g>`),
  props: base("r", "#9ee7ff", "#3b6fd6", `<g class="ic-faders"><rect x="15" y="17" width="34" height="4" rx="2" fill="#fff" opacity=".7"/><rect x="15" y="30" width="34" height="4" rx="2" fill="#fff" opacity=".7"/><rect x="15" y="43" width="34" height="4" rx="2" fill="#fff" opacity=".7"/><circle class="fd fd0" cx="38" cy="19" r="5" fill="#fff"/><circle class="fd fd1" cx="24" cy="32" r="5" fill="#ffd36e"/><circle class="fd fd2" cx="42" cy="45" r="5" fill="#fff"/></g>`),
  notes: base("n", "#fff2a8", "#f5b700", `<g class="ic-bounce"><rect x="16" y="14" width="32" height="36" rx="4" fill="#fff" transform="rotate(-4 32 32)"/><path d="M22 24h20M22 31h20M22 38h12" stroke="#f5b700" stroke-width="3" stroke-linecap="round" transform="rotate(-4 32 32)"/></g>`),
  admin: base("d", "#ffcf6e", "#d9480f", `<g class="ic-bounce"><path d="M32 12 L48 18 V30 C48 40 41 46 32 50 C23 46 16 40 16 30 V18Z" fill="#fff"/><path d="M25 31 l5 5 l10-11" fill="none" stroke="#d9480f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`),
  maestro: base("x", "#ffe1f0", "#b46cff", `<g class="ic-bounce"><circle cx="32" cy="30" r="13" fill="#fff"/>${eyes(26, 29)}<path d="M27 35 q5 4 10 0" stroke="#1b1b2f" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M44 18 l8 -8" stroke="#3a2a12" stroke-width="2.5" stroke-linecap="round"/></g>`),
};
