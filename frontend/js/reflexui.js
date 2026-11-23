/* axon · reflexui.js — janela "Pontos reflexos": identificação por cores, associações reveladas em camadas
   e controle de visibilidade por categoria. Os dados vêm de anatomy.json (gerado por scripts/build_anatomy.py). */
(function (g) {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let last = null;
  const TAGK = { LITERATURA: "lit", PREMISSA: "pre", DERIVADO: "der" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tag = (k, title) => `<span class="tag ${k}" title="${esc(title || "")}">${{ lit: "LITERATURA", pre: "PREMISSA", der: "DERIVADO", hip: "HIPÓTESE / EVIDÊNCIA EM INVESTIGAÇÃO", mod: "RESULTADO DE MODELO · SEMENTE 42" }[k]}</span>`;

  function ST() { return g.AxonStage; }
  function render(b) {
    const S = ST(), list = S.reflexPoints(), rs = S.reflexState();
    if (!rs) { b.innerHTML = `<div class="card"><p class="note">Os pontos reflexos são ancorados na anatomia real (BodyParts3D). Aguarde o carregamento do pacote anatômico…</p></div>`; setTimeout(() => b.isConnected && render(b), 1200); return; }
    const C = S.RX_CAT, A = S.RX_ASSOC, cnt = k => list.filter(r => r.cat === k).length;
    b.innerHTML = `
      <div class="card rxv"><h4>Visibilidade por categoria</h4>
        ${Object.entries(C).map(([k, c]) => `<label class="rxrow"><input type="checkbox" data-cat="${k}" ${rs.cat[k] ? "checked" : ""}><i class="sw" style="--c:${c.color}"></i><span>${c.label}</span><b>${cnt(k)}</b></label>`).join("")}
        <div class="rxbtns"><button class="btn sm" data-all="1">Todas</button><button class="btn sm" data-all="0">Nenhuma</button><button class="btn sm" id="rxHome" title="Recentrar a câmera no corpo inteiro">⤢ Corpo inteiro</button></div>
      </div>
      <div class="card"><h4>Associações em camadas</h4>
        <label class="rxrow"><input type="checkbox" id="rxAssoc" ${rs.assoc ? "checked" : ""}><span>Evidenciar elementos associados</span></label>
        <label class="rxrow"><input type="checkbox" id="rxReveal" ${rs.reveal ? "checked" : ""}><span>Revelar a camada de cada associação</span></label>
        <div class="rxleg">${[["derm", "Dermátomo / faixa segmentar"], ["nerve", "Nervo"], ["muscle", "Músculo / osso"], ["organ", "Órgão"]].map(([k, l]) => `<span><i class="sw" style="--c:${A[k]}"></i>${l}</span>`).join("")}</div>
        <label class="rxrow col"><span>Opacidade da pele <b id="rxAv">${Math.round(rs.alpha * 100)} %</b></span><input type="range" id="rxAlpha" min="0.1" max="1" step="0.05" value="${rs.alpha}"><span class="note">Ao revelar músculos ou órgãos a pele passa a 40 % automaticamente e volta ao limpar.</span></label>
      </div>
      <div class="card"><h4>Pontos</h4>
        ${Object.entries(C).map(([k, c]) => `<div class="rxgrp" style="--c:${c.color}"><div class="rxgl">${c.label}</div>${list.filter(r => r.cat === k).map(r => `<button class="rxchip ${rs.sel === r.id ? "on" : ""} ${rs.cat[k] ? "" : "off"}" data-id="${r.id}" title="${esc(r.name)}">${esc(r.id.replace("HEAD_", ""))}</button>`).join("")}</div>`).join("")}
      </div>
      <div id="rxDet"></div>`;
    $$("[data-cat]", b).forEach(i => i.onchange = () => { S.setReflex({ cat: { [i.dataset.cat]: i.checked } }); render(b); });
    $$("[data-all]", b).forEach(x => x.onclick = () => { const v = x.dataset.all === "1"; S.setReflex({ cat: Object.fromEntries(Object.keys(C).map(k => [k, v])) }); render(b); });
    $("#rxHome", b).onclick = () => S.resetView();
    $("#rxAssoc", b).onchange = e => S.setReflex({ assoc: e.target.checked });
    $("#rxReveal", b).onchange = e => S.setReflex({ reveal: e.target.checked });
    $("#rxAlpha", b).oninput = e => { S.setSkinOpacity(+e.target.value); $("#rxAv", b).textContent = Math.round(e.target.value * 100) + " %"; };
    $$(".rxchip", b).forEach(x => x.onclick = () => { const id = x.dataset.id, r = list.find(p => p.id === id); if (!rs.cat[r.cat]) S.setReflex({ cat: { [r.cat]: true } }); S.selectReflex(id, true); });
    detail(b);
  }
  function detail(b) {
    const el = $("#rxDet", b); if (!el) return;
    const d = last; if (!d) { el.innerHTML = `<div class="card"><p class="note">Clique num ponto colorido sobre o corpo (nível 1) ou num botão acima. O ponto pulsa e os elementos associados são coloridos nas suas camadas, com linhas de ligação.</p></div>`; return; }
    const r = d.point, S = ST(), C = S.RX_CAT[r.cat], A = S.RX_ASSOC;
    const li = (col, lab, val) => `<div class="rxa"><i class="sw" style="--c:${col}"></i><span>${lab}</span><b>${val}</b></div>`;
    const mus = d.muscles.length ? d.muscles.map(m => esc(m.name) + (m.fma ? ` <code>${m.fma}</code>` : "") + (m.pending ? " <em>(carregando)</em>" : "")).join("<br>") : "—";
    const org = d.organs.length ? d.organs.map(m => esc(m.name) + (m.fma ? ` <code>${m.fma}</code>` : "")).join("<br>") : "—";
    el.innerHTML = `<div class="card rxcard" style="--c:${C.color}">
      <div class="rxh"><i class="sw big" style="--c:${C.color}"></i><div><b>${esc(r.name)}</b><div class="note">${C.label}</div></div><button class="btn sm" id="rxClr">Limpar</button></div>
      ${li(A.derm, "Segmento (literatura)", esc(r.seg || r.derm))}
      ${li(A.derm, "Dermátomo no mapa do app", esc(d.derm || r.mapDerm || "—"))}
      ${li(A.nerve, "Nervo modelado", esc(d.nerve ? d.nerve.replace(/ (right|left)$/, m => m === " right" ? " (dir.)" : " (esq.)") : (r.nerveLabel !== "—" ? r.nerveLabel + " (não modelado)" : "—")))}
      ${li(A.muscle, "Músculo / osso", mus)}
      ${li(A.organ, "Órgão", org)}
      ${r.refers ? `<div class="rxa"><i class="sw" style="--c:${C.color}"></i><span>Dor referida</span><b>${esc(r.refers)}</b></div>` : ""}
      <p class="note">${esc(r.note)}</p>
      <div class="rxtags">${tag(TAGK[r.tag] || "lit", r.ref)}<span class="note">${esc(r.ref)}</span></div>
      <div class="rxtags">${tag("pre")}<span class="note">Posição projetada sobre a malha de pele a partir de marcos ósseos/viscerais BodyParts3D; trajetos nervosos didáticos ancorados nos ossos.</span></div>
      ${r.tcm ? `<div class="rxtags">${tag("hip")}<span class="note">Correspondência tradicional (MTC): meridiano ${esc(r.tcm)}. Não é relação anatômica demonstrada.</span></div>` : ""}
    </div>`;
    $("#rxClr", el).onclick = () => { ST().selectReflex(null); };
  }
  const APP = { title: "reflex", w: 370, h: 620, pos: (d, W) => ({ x: Math.max(70, innerWidth - W - 14), y: 78 }), render };
  function boot() {
    const A = g.AxonApp; if (!A || !A.registerApp) return setTimeout(boot, 60);
    A.registerApp("reflex", APP);
    document.addEventListener("axon:reflex", e => {
      last = e.detail; if (last && !A.isOpen("reflex")) A.openApp("reflex");
      const b = A.body("reflex"); if (b) render(b);
      if (last) A.botSay && A.botSay(`${last.point.name}: ${[last.derm && "dermátomo " + last.derm, last.nerve && "nervo", last.muscles.length && last.muscles.length + " músculo(s)", last.organs.length && "órgão"].filter(Boolean).join(" · ")} evidenciados.`);
    });
  }
  boot();
})(window);
