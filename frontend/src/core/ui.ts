// Utilitários de DOM e notificações.
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith("--")) el.style.setProperty(sk, String(sv)); else (el.style as any)[sk] = sv;
      }
    }
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c as any);
  return el;
}

export function toast(msg: string, kind: "info" | "ok" | "warn" | "error" = "info", ms = 3800) {
  let box = document.getElementById("toasts");
  if (!box) { box = h("div", { id: "toasts" }); document.body.append(box); }
  const t = h("div", { class: `toast ${kind}`, role: "status" }, msg);
  box.append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, ms);
}

export function busy(btn: HTMLButtonElement, on: boolean, label?: string) {
  if (on) { btn.dataset.label = btn.textContent || ""; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${label || ""}`; }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || ""; }
}

export function download(blob: Blob, name: string) {
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Tooltip didático: explica o conceito musical por trás do controle. */
export function tip(el: HTMLElement, text: string) { el.dataset.tip = text; return el; }
