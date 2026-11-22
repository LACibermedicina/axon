/* axon · icons.js — ícones volumétricos (estética "Pixar": base brilhante, sombra própria, realce especular). */
(function (g) {
  let uid = 0;
  function base(c1, c2, inner) {
    const id = "i" + (uid++);
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
      <radialGradient id="${id}s" cx=".5" cy=".2" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfe9ee"/></linearGradient></defs>
      <rect x="4" y="6" width="56" height="54" rx="15" fill="#000" opacity=".25"/>
      <rect x="4" y="3" width="56" height="54" rx="15" fill="url(#${id}b)"/>
      <rect x="4" y="3" width="56" height="54" rx="15" fill="none" stroke="#fff" stroke-opacity=".35"/>
      ${inner(id)}
      <ellipse cx="32" cy="14" rx="22" ry="9" fill="url(#${id}s)"/></svg>`;
  }
  const I = {
    app1: base("#3ee6c5", "#0d7f74", id => `<circle cx="32" cy="22" r="6" fill="url(#${id}m)"/><path d="M24 30h16l-3 16h-3l-1 8h-2l-1-8h-3z" fill="url(#${id}m)"/><path d="M24 31l-7 9M40 31l7 9" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M32 29v18" stroke="#ffb547" stroke-width="2"/>`),
    app2: base("#ffb547", "#c46a12", id => `<path d="M16 46 L44 14" stroke="#e8f4f8" stroke-width="3" stroke-linecap="round"/><rect x="40" y="10" width="8" height="10" rx="2" transform="rotate(42 44 15)" fill="#18a999"/><path d="M12 40c6-8 10 8 16 0s10 8 16 0 8 6 10 2" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>`),
    app3: base("#4fb3ff", "#1c4f9c", id => `<path d="M14 44V16M14 44h36" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M16 42C24 40 26 22 34 20s10 0 14-2" fill="none" stroke="#7af7dc" stroke-width="3.5" stroke-linecap="round"/><path d="M16 43C26 42 30 32 38 28s8-2 12-3" fill="none" stroke="#ffb547" stroke-width="3" stroke-linecap="round"/>`),
    app4: base("#5fe08f", "#147a45", id => `<path d="M32 12l15 6v11c0 10-7 17-15 20-8-3-15-10-15-20V18z" fill="url(#${id}m)"/><path d="M25 31l5 5 10-11" fill="none" stroke="#147a45" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
    app5: base("#c084fc", "#5b2b9c", id => `<path d="M10 34c3-10 5 10 8 0s4-14 7 0 4 12 7 0 4-8 7 0 4 10 7 0 3-6 8-2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="46" cy="20" r="5" fill="#ffd36b"/>`),
    app6: base("#ff7aa8", "#a3204f", id => `<path d="M18 20L32 32 46 20M32 32v12" stroke="#fff" stroke-width="3"/><circle cx="18" cy="20" r="6" fill="url(#${id}m)"/><circle cx="46" cy="20" r="6" fill="url(#${id}m)"/><circle cx="32" cy="32" r="6" fill="#ffd36b"/><circle cx="32" cy="46" r="6" fill="url(#${id}m)"/>`),
    app7: base("#2fc4f0", "#0b5f8a", id => `<circle cx="28" cy="30" r="15" fill="url(#${id}m)"/><path d="M13 30h30M28 15c-6 8-6 22 0 30M28 15c6 8 6 22 0 30" stroke="#0b5f8a" stroke-width="2" fill="none"/><path d="M40 36h14v10h-6l-4 4v-4h-4z" fill="#ffb547"/>`),
    app8: base("#2a3d48", "#0f1c22", id => `<circle cx="32" cy="32" r="12" fill="#bff7ee"/><circle cx="27" cy="31" r="3" fill="#0c2"/><circle cx="37" cy="31" r="3" fill="#0c2"/><path d="M27 38q5 3 10 0" stroke="#0a5" stroke-width="2" fill="none"/><path d="M32 20V12M22 24l-6-6M42 24l6-6M20 34h-8M44 34h8" stroke="#3ee6c5" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="11" r="3" fill="#3ee6c5"/>`),
    docs: base("#e9eef2", "#9aa9b4", id => `<rect x="18" y="12" width="28" height="36" rx="4" fill="#fff"/><path d="M23 22h18M23 28h18M23 34h12" stroke="#4fb3ff" stroke-width="2.5" stroke-linecap="round"/>`)
  };
  I.bot = `<svg viewBox="0 0 160 200" aria-hidden="true"><defs>
    <radialGradient id="bh" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#d8fbff"/><stop offset=".6" stop-color="#7fd6e0"/><stop offset="1" stop-color="#2b7d8c"/></radialGradient>
    <linearGradient id="bc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfdde2"/></linearGradient>
    <radialGradient id="be" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#eafffb"/><stop offset=".5" stop-color="#3ee6c5"/><stop offset="1" stop-color="#0a5"/></radialGradient></defs>
    <g stroke="#7fd6e0" stroke-width="7" stroke-linecap="round" fill="none"><path d="M80 40V12"/><path d="M58 48L36 22"/><path d="M102 48l22-26"/><path d="M48 70H20"/><path d="M112 70h28"/></g>
    <g fill="#bff7ee"><circle cx="80" cy="10" r="7"/><circle cx="34" cy="20" r="7"/><circle cx="126" cy="20" r="7"/><circle cx="18" cy="70" r="6"/><circle cx="142" cy="70" r="6"/></g>
    <circle cx="80" cy="76" r="40" fill="url(#bh)"/>
    <ellipse cx="80" cy="80" rx="28" ry="22" fill="#0e2430"/>
    <circle cx="69" cy="78" r="8" fill="url(#be)"/><circle cx="91" cy="78" r="8" fill="url(#be)"/>
    <circle cx="71" cy="75" r="2.5" fill="#fff"/><circle cx="93" cy="75" r="2.5" fill="#fff"/>
    <path d="M71 92q9 6 18 0" stroke="#3ee6c5" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="66" cy="56" rx="14" ry="7" fill="#fff" opacity=".45"/>
    <path d="M52 112h56l10 60H42z" fill="url(#bc)"/><path d="M80 112l-10 22 10 38 10-38z" fill="#2b7d8c"/>
    <path d="M52 118l-16 26M108 118l18-30" stroke="#7fd6e0" stroke-width="10" stroke-linecap="round"/>
    <circle cx="127" cy="86" r="7" fill="#bff7ee"/><rect x="58" y="140" width="12" height="4" rx="2" fill="#4fb3ff"/>
    <ellipse cx="80" cy="190" rx="36" ry="6" fill="#000" opacity=".3"/></svg>`;
  g.AxonIcons = I;
})(window);
