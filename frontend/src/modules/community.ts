// Comunidade: salas de chat em tempo real + videochamada WebRTC (malha p2p, TURN efêmero).
import { h, toast } from "../core/ui";
import { getToken, currentUser, requireLogin } from "../core/api";

export function mountCommunity(body: HTMLElement) {
  body.classList.add("community");
  if (!currentUser) { body.append(h("div", { class: "empty-state" }, h("p", {}, "Entre na sua conta para conversar com outros músicos."), h("button", { class: "btn primary", onclick: () => requireLogin() }, "Entrar"))); return; }
  const rooms = ["geral", "harmonia", "composição", "piano", "voz-e-letra"];
  let room = "geral";
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/?token=${encodeURIComponent(getToken())}&nick=${encodeURIComponent(currentUser.name.split(" ")[0])}`);
  let ice: RTCIceServer[] = [];
  const peers = new Map<string, RTCPeerConnection>();
  let local: MediaStream | null = null;

  const roomList = h("nav", { class: "rooms" }, ...rooms.map((r) => h("button", { "data-room": r, onclick: () => join(r) }, "# " + r)));
  const log = h("div", { class: "chat-log", "aria-live": "polite" });
  const inp = h("input", { placeholder: "Mensagem… (compartilhe links /s/… de composições)", maxlength: 2000 }) as HTMLInputElement;
  const videos = h("div", { class: "videos" });
  const callBtn = h("button", { class: "btn accent", onclick: () => (local ? hangup() : call()) }, "📹 Entrar na chamada") as HTMLButtonElement;
  body.append(roomList, h("div", { class: "chat" }, h("div", { class: "toolbar" }, h("b", { class: "room-name" }), callBtn), videos, log,
    h("form", { class: "chat-form", onsubmit: (e: Event) => { e.preventDefault(); if (inp.value.trim()) { ws.send(JSON.stringify({ type: "chat", room, text: inp.value })); inp.value = ""; } } }, inp, h("button", { class: "btn primary" }, "Enviar"))));

  const line = (m: any) => h("div", { class: "msg" + (m.user.id === String(currentUser.id) ? " me" : "") }, h("b", {}, m.user.nick), h("span", {}, m.text), h("time", {}, new Date(m.at).toLocaleTimeString().slice(0, 5)));
  function join(r: string) {
    if (ws.readyState === 1) { ws.send(JSON.stringify({ type: "leave", room })); ws.send(JSON.stringify({ type: "join", room: r })); }
    room = r; roomList.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.room === r));
    body.querySelector(".room-name")!.textContent = "# " + r; log.replaceChildren();
  }
  ws.onopen = () => join(room);
  ws.onerror = () => { log.replaceChildren(h("p", { class: "hint" }, "Chat indisponível no momento — tentaremos de novo quando você reabrir.")); };
  ws.onmessage = async (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === "hello") ice = m.ice;
    if (m.type === "joined") log.replaceChildren(...m.history.map(line));
    if (m.type === "chat" && m.room === room) { log.append(line(m)); log.scrollTop = log.scrollHeight; }
    if (m.type === "peer-join" && local) offer(m.user.id);
    if (m.type === "peer-leave") { peers.get(m.user.id)?.close(); peers.delete(m.user.id); videos.querySelector(`[data-peer="${m.user.id}"]`)?.remove(); }
    if (m.type === "rtc") await onSignal(m.from, m.data);
  };

  function pc(id: string) {
    if (peers.has(id)) return peers.get(id)!;
    const p = new RTCPeerConnection({ iceServers: ice });
    local?.getTracks().forEach((t) => p.addTrack(t, local!));
    p.onicecandidate = (e) => e.candidate && ws.send(JSON.stringify({ type: "rtc", room, to: id, data: { ice: e.candidate } }));
    p.ontrack = (e) => {
      let v = videos.querySelector<HTMLVideoElement>(`[data-peer="${id}"]`);
      if (!v) { v = h("video", { autoplay: true, playsinline: true, "data-peer": id }) as HTMLVideoElement; videos.append(v); }
      v.srcObject = e.streams[0];
    };
    peers.set(id, p); return p;
  }
  async function offer(id: string) { const p = pc(id); const o = await p.createOffer(); await p.setLocalDescription(o); ws.send(JSON.stringify({ type: "rtc", room, to: id, data: { sdp: o } })); }
  async function onSignal(from: string, d: any) {
    const p = pc(from);
    if (d.sdp) {
      await p.setRemoteDescription(d.sdp);
      if (d.sdp.type === "offer") { const a = await p.createAnswer(); await p.setLocalDescription(a); ws.send(JSON.stringify({ type: "rtc", room, to: from, data: { sdp: a } })); }
    } else if (d.ice) await p.addIceCandidate(d.ice).catch(() => {});
  }
  async function call() {
    try {
      local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const me = h("video", { autoplay: true, muted: true, playsinline: true, class: "me" }) as HTMLVideoElement; me.srcObject = local; videos.append(me);
      callBtn.textContent = "Sair da chamada";
      ws.send(JSON.stringify({ type: "leave", room })); ws.send(JSON.stringify({ type: "join", room })); // reanuncia → pares enviam ofertas
    } catch (e: any) { toast("Câmera/microfone indisponível: " + e.message, "error"); }
  }
  function hangup() { local?.getTracks().forEach((t) => t.stop()); local = null; peers.forEach((p) => p.close()); peers.clear(); videos.replaceChildren(); callBtn.textContent = "📹 Entrar na chamada"; }
  return () => { hangup(); ws.close(); };
}


/** Versão para painel (acoplável/flutuante): remonta ao entrar/sair da conta. */
export function mountCommunityPanel(body: HTMLElement) {
  body.classList.add("community-panel");
  let cleanup: void | (() => void);
  const remount = () => { if (typeof cleanup === "function") cleanup(); body.replaceChildren(); cleanup = mountCommunity(body); };
  addEventListener("auth", remount);
  remount();
  return () => { removeEventListener("auth", remount); if (typeof cleanup === "function") cleanup(); };
}
