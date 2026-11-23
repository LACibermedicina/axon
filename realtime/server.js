// axon · sinalização WebRTC / salas de estudo (v0.1.0-alpha)
// Só repassa mensagens de sinalização (SDP/ICE) e chat entre pares da mesma sala.
// LGPD: sem persistência, sem nomes reais (apelido escolhido na hora), salas expiram vazias.
const http = require("http");
const { WebSocketServer } = require("ws");
const PORT = process.env.REALTIME_PORT || 8090;
const MAX_ROOM = 12;
const rooms = new Map();

const server = http.createServer((req, res) => {
  if (req.url === "/ws/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end('{"status":"ok","project":"axon-realtime"}'); }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ server, path: "/ws/rooms", maxPayload: 64 * 1024 });

wss.on("connection", (ws, req) => {
  const room = (new URL(req.url, "http://x").searchParams.get("room") || "lobby").replace(/[^\w-]/g, "").slice(0, 40);
  if (!rooms.has(room)) rooms.set(room, new Set());
  const peers = rooms.get(room);
  if (peers.size >= MAX_ROOM) { ws.close(1013, "sala cheia"); return; }
  ws.id = Math.random().toString(36).slice(2, 10);
  peers.add(ws);
  const broadcast = (msg, except) => peers.forEach(p => p !== except && p.readyState === 1 && p.send(JSON.stringify(msg)));
  ws.send(JSON.stringify({ type: "welcome", id: ws.id, peers: [...peers].filter(p => p !== ws).map(p => p.id) }));
  broadcast({ type: "join", id: ws.id }, ws);
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!["offer", "answer", "ice", "chat", "cursor", "scene"].includes(m.type)) return;
    m.from = ws.id;
    if (m.to) { const t = [...peers].find(p => p.id === m.to); t && t.send(JSON.stringify(m)); }
    else broadcast(m, ws);
  });
  ws.on("close", () => { peers.delete(ws); broadcast({ type: "leave", id: ws.id }); if (!peers.size) rooms.delete(room); });
});
server.listen(PORT, () => console.log(`[axon-realtime] :${PORT}`));
