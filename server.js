const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8080;

// Stats
let stats = { rx: 0, tx: 0 };

function getCPU() {
  const c = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of c) {
    for (const type in cpu.times) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  return { idle, total };
}
let cpuPrev = getCPU();

// Spawn Xray
const xray = spawn('xray', ['-c', '/etc/xray/config.json'], { stdio: 'inherit' });
xray.on('error', (e) => console.error('xray:', e.message));

// HTTP server
const server = http.createServer((req, res) => {
  const p = url.parse(req.url, true);
  if (p.pathname === '/health') { res.writeHead(200); res.end('OK'); return; }
  if (p.pathname === '/stats') {
    const mem = process.memoryUsage();
    const memPct = Math.round(mem.heapUsed / mem.heapTotal * 100);
    const cpuCur = getCPU();
    const cpuDelta = cpuCur.total - cpuPrev.total;
    const cpuPct = cpuDelta > 0 ? Math.round((1 - (cpuCur.idle - cpuPrev.idle) / cpuDelta) * 100) : 0;
    cpuPrev = cpuCur;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ uptime: Math.floor(process.uptime()), cpu: cpuPct, mem: memPct, rx: stats.rx, tx: stats.tx }));
    return;
  }
  if (p.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('./public/index.html', 'utf-8'));
    return;
  }
  res.writeHead(404); res.end();
});

// WebSocket proxy ke Xray
const WS_PATHS = { '/vless-aero': 3002, '/vmess-aero': 3003, '/trojan-aero': 3004 };
const wss = new WebSocket.Server({ server, perMessageDeflate: false });
wss.on('connection', (ws, req) => {
  const path = url.parse(req.url).pathname;
  const port = WS_PATHS[path];
  if (!port) { ws.close(); return; }
  const xws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { perMessageDeflate: false });
  xws.on('open', () => {
    ws.on('message', (d) => { stats.rx += Buffer.from(d).length; xws.send(d); });
    xws.on('message', (d) => { stats.tx += Buffer.from(d).length; ws.send(d); });
    ws.on('close', () => xws.close());
    xws.on('close', () => ws.close());
    ws.on('error', () => {});
    xws.on('error', () => {});
  });
  xws.on('error', () => ws.close(1011, 'Xray unavailable'));
});

server.listen(PORT, '0.0.0.0', () => console.log('AeroTunnel active on :' + PORT));
