// Administração (visível só para o papel admin): visão geral, usuários/papéis, moderação e auditoria.
import { h, toast } from "../core/ui";
import { api, currentUser } from "../core/api";

const ROLES: [string, string][] = [["admin", "Administrador"], ["composer", "Compositor"], ["student", "Estudante"], ["viewer", "Ouvinte"]];

export function mountAdmin(body: HTMLElement) {
  body.classList.add("admin-app");
  const tabs = h("div", { class: "tabs" });
  const main = h("div");
  body.append(tabs, main);
  const views: Record<string, () => Promise<HTMLElement>> = { "📊 Visão geral": overview, "👥 Usuários": users, "🌐 Moderação": moderation, "🧾 Auditoria LGPD": audit, "🔄 Atualizações": updates, "🤖 IA": aiProviders };

  async function aiProviders() {
    const r = await api("/api/admin/ai");
    const out = h("div", { class: "row" });
    const table = (provs: any[]) => h("table", { class: "grid-table" },
      h("thead", {}, h("tr", {}, ...["Ordem", "Provedor", "Chave", "Modelo", "Estado", "Chamadas"].map((t) => h("th", {}, t)))),
      h("tbody", {}, ...provs.map((p: any) => h("tr", { class: p.configured ? "" : "muted" },
        h("td", {}, String(p.position)), h("td", {}, h("b", {}, p.name)), h("td", {}, p.configured ? "✅ configurada" : "—"),
        h("td", { class: "mono" }, p.model),
        h("td", {}, !p.configured ? "inativo" : p.paused ? `⏸ em pausa (${p.lastError})` : p.lastOk ? "✅ ok" : "pronto"),
        h("td", {}, String(p.calls))))));
    const box = h("div", {}, table(r.providers));
    const btn = h("button", { class: "btn primary", onclick: async () => {
      btn.disabled = true; out.textContent = "Testando…";
      try { const t = await api("/api/admin/ai/test", { method: "POST" }); out.textContent = `✅ Respondeu: ${t.provider} em ${t.ms} ms`; box.replaceChildren(table(t.providers)); }
      catch (e: any) { out.textContent = "❌ " + e.message; }
      finally { btn.disabled = false; }
    } }, "Testar failover") as HTMLButtonElement;
    return h("div", {}, box, h("div", { class: "row" }, btn, out),
      h("p", { class: "hint" }, "Se um provedor falhar (erro, limite ou lentidão), o próximo da lista responde e o que falhou fica em pausa por alguns minutos. As chaves ficam só no .env da VPS e nunca aparecem aqui. Para gravar ou trocar: sudo bash /opt/harmonia/infra/scripts/configurar-ia.sh"));
  }

  async function updates() {
    const [sys, hc] = await Promise.all([api("/api/admin/system"), api("/api/health")]);
    const au = sys.autoupdate;
    const label: Record<string, string> = { ok: "✅ Em dia", updating: "⏳ Aplicando atualização", waiting: "⏳ Aguardando testes (CI)", blocked: "⛔ Versão bloqueada", rolled_back: "↩️ Revertido", error: "⚠️ Erro", disabled: "⏸ Desativado" };
    return h("div", {},
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("b", {}, hc.version), h("small", {}, "versão em execução")),
        h("div", { class: "stat" }, h("b", { style: { fontSize: "16px" } }, au ? (label[au.state] || au.state) : "—"), h("small", {}, au ? new Date(au.at).toLocaleString() : "sem registro ainda")),
        h("div", { class: "stat" }, h("b", { style: { fontSize: "16px" } }, au?.sha ? au.sha.slice(0, 7) : hc.commit), h("small", {}, "commit"))),
      h("p", {}, au ? au.message : "A atualização automática registra o estado aqui após a primeira verificação (a cada 5 minutos)."),
      h("p", { class: "hint" }, "Fluxo: alteração publicada no GitHub → testes automáticos (CI) → a VPS verifica a cada 5 min e aplica só versões aprovadas → se o app não responder, volta sozinho para a versão anterior."),
      sys.log.length ? h("pre", { class: "mono log-box" }, sys.log.join("\n")) : "");
  }
  let cur = Object.keys(views)[0];
  const go = async (k: string) => {
    cur = k;
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.textContent === k));
    main.replaceChildren(h("div", { class: "spin-wrap" }, h("span", { class: "spin" })));
    try { main.replaceChildren(await views[k]()); } catch (e: any) { main.replaceChildren(h("p", { class: "hint" }, e.message)); }
  };
  Object.keys(views).forEach((k) => tabs.append(h("button", { onclick: () => go(k) }, k)));

  async function overview() {
    const [st, hc] = await Promise.all([api("/api/admin/stats"), api("/api/health")]);
    const card = (n: any, l: string) => h("div", { class: "stat" }, h("b", {}, String(n)), h("small", {}, l));
    return h("div", {},
      h("div", { class: "stats" }, card(st.users, "usuários"), card(st.activeUsers, "ativos"), card(st.compositions, "composições"),
        card(st.public, "públicas"), card(st.featured, "em destaque"), card(st.playlists, "playlists/álbuns"), card(st.storageMB + " MB", "mídia enviada")),
      h("p", { class: "hint" }, `API ${hc.version} · commit ${hc.commit} · IA ${hc.ai_full ? "completa" : "leve (sem transcrição de áudio/foto)"}`));
  }

  async function users() {
    const rows = await api<any[]>("/api/admin/users");
    const q = h("input", { placeholder: "Buscar nome ou e-mail…", oninput: () => draw() }) as HTMLInputElement;
    const tbody = h("tbody");
    const draw = () => tbody.replaceChildren(...rows.filter((u) => !q.value || (u.name + u.email).toLowerCase().includes(q.value.toLowerCase())).map((u) => {
      const self = u.id === currentUser?.id;
      const role = h("select", { disabled: self, onchange: async () => {
        try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { role: role.value } }); u.role = role.value; toast(`${u.name}: papel ${role.value}`, "ok"); }
        catch (e: any) { toast(e.message, "error"); role.value = u.role; }
      } }, ...ROLES.map(([v, l]) => h("option", { value: v, selected: v === u.role }, l))) as HTMLSelectElement;
      const active = h("input", { type: "checkbox", checked: u.active, disabled: self, onchange: async () => {
        try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { active: active.checked } }); u.active = active.checked; toast(active.checked ? "Acesso liberado" : "Acesso bloqueado", "ok"); }
        catch (e: any) { toast(e.message, "error"); active.checked = u.active; }
      } }) as HTMLInputElement;
      return h("tr", { class: u.active ? "" : "muted" }, h("td", {}, h("b", {}, u.name), self ? h("small", { class: "chip" }, "você") : ""),
        h("td", {}, u.email), h("td", {}, role), h("td", {}, active), h("td", {}, String(u.compositions)), h("td", {}, new Date(u.createdAt).toLocaleDateString()));
    }));
    draw();
    return h("div", {}, h("div", { class: "row" }, q, h("span", { class: "hint" }, `${rows.length} usuários · dados pessoais exibidos apenas para fins administrativos (acesso registrado na auditoria)`)),
      h("table", { class: "grid-table" }, h("thead", {}, h("tr", {}, ...["Nome", "E-mail", "Papel", "Ativo", "Obras", "Desde"].map((t) => h("th", {}, t)))), tbody));
  }

  async function moderation() {
    const rows = await api<any[]>("/api/library/public");
    if (!rows.length) return h("p", { class: "hint" }, "Nenhuma composição pública no momento.");
    return h("table", { class: "grid-table" }, h("thead", {}, h("tr", {}, ...["Título", "Autor", "Destaque", "Atualizada", ""].map((t) => h("th", {}, t)))),
      h("tbody", {}, ...rows.map((c) => h("tr", {}, h("td", {}, c.title), h("td", {}, c.author || "—"), h("td", {}, c.featured ? "⭐" : ""),
        h("td", {}, new Date(c.updatedAt).toLocaleDateString()),
        h("td", {}, h("button", { class: "btn ghost danger", onclick: async () => {
          if (!confirm(`Retirar "${c.title}" da biblioteca pública?`)) return;
          await api(`/api/admin/compositions/${c.id}/unpublish`, { method: "POST" }); toast("Retirada da biblioteca pública", "ok"); go(cur);
        } }, "Despublicar"))))));
  }

  async function audit() {
    const rows = await api<any[]>("/api/admin/audit?limit=200");
    return h("table", { class: "grid-table" }, h("thead", {}, h("tr", {}, ...["Quando", "Usuário", "Ação", "Detalhe"].map((t) => h("th", {}, t)))),
      h("tbody", {}, ...rows.map((a) => h("tr", {}, h("td", {}, new Date(a.at).toLocaleString()), h("td", {}, a.userId ?? "—"), h("td", {}, a.action),
        h("td", { class: "mono" }, Object.keys(a.detail || {}).length ? JSON.stringify(a.detail) : "")))));
  }

  go(cur);
}
