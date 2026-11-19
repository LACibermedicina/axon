// Cliente da API harmonIA com token JWT e polling de jobs assíncronos.
import { toast } from "./ui";

let token = localStorage.getItem("harmonia.token") || "";
export let currentUser: any = null;
export let online = true;

export function setToken(t: string, user: any) {
  token = t; currentUser = user;
  if (t) localStorage.setItem("harmonia.token", t); else localStorage.removeItem("harmonia.token");
  window.dispatchEvent(new CustomEvent("auth", { detail: user }));
}
export const getToken = () => token;

export async function api<T = any>(path: string, opts: RequestInit & { json?: any } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = opts.body;
  if (opts.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.json); }
  let r: Response;
  try {
    r = await fetch(path, { ...opts, headers, body });
  } catch (e) {
    online = false;
    throw new Error("Sem conexão com o servidor");
  }
  if (r.status === 401 && token) { setToken("", null); }
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).detail || msg; } catch { /* corpo vazio */ }
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  online = true;
  return r.json();
}

export async function restoreSession() {
  if (!token) return null;
  try { currentUser = await api("/api/auth/me"); window.dispatchEvent(new CustomEvent("auth", { detail: currentUser })); return currentUser; }
  catch { return null; }
}

/** Executa job de IA. Jobs leves voltam na hora; pesados são acompanhados por polling. */
export async function runJob(type: string, payload: any, onProgress?: (s: string) => void): Promise<any> {
  const j = await api("/api/jobs", { method: "POST", json: { type, payload } });
  if (j.status === "done") return j.result;
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const s = await api(`/api/jobs/${j.id}`);
    onProgress?.(s.status);
    if (s.status === "done") return s.result;
    if (s.status === "error") throw new Error(s.error || "Falha no processamento");
  }
  throw new Error("Tempo esgotado");
}

export async function upload(kind: string, blob: Blob, filename: string) {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", blob, filename);
  return api<{ id: number; path: string; url: string }>("/api/assets", { method: "POST", body: fd });
}

export function requireLogin(): boolean {
  if (currentUser) return true;
  toast("Entre na sua conta para usar a IA e salvar na biblioteca", "warn");
  window.dispatchEvent(new CustomEvent("open-app", { detail: "account" }));
  return false;
}
