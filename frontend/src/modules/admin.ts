// Administração (visível só para o papel admin): visão geral, usuários/papéis, moderação e auditoria.
import { h, toast } from "../core/ui";
import { api, currentUser } from "../core/api";

const ROLES: [string, string][] = [["admin", "Administrador"], ["composer", "Compositor"], ["student", "Estudante"], ["viewer", "Ouvinte"]];

export function mountAdmin(body: HTMLElement) {
  body.classList.add("admin-app");
  const tabs = h("div", { class: "tabs" });
  const main = h("div");
  body.append(tabs, main);
  const views: Record<string, () => Promise<HTMLElement>> = { "📊 Visão geral": overview, "👥 Usuários": users, "🌐 Moderação": moderation, "🧾 Auditoria LGPD": audit };
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
