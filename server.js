const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const AUTH = 'Basic ' + Buffer.from('aero:aero').toString('base64');
function authed(req) { return req.headers['authorization'] === AUTH; }

function serve(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// Spawn Xray-core
const xray = spawn('xray', ['-c', '/etc/xray/config.json'], { stdio: 'inherit' });
xray.on('error', (e) => console.error('xray error:', e.message));

const WS_PATHS = {
  '/vless-aero': 3002,
  '/vmess-aero': 3003,
  '/trojan-aero': 3004
};

let stats = { rx: 0, tx: 0 };
let lastRxCache = 0, lastTxCache = 0;

function getCPU() {
  const c = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of c) {
    for (const type in cpu.times) { total += cpu.times[type]; }
    idle += cpu.times.idle;
  }
  return { idle, total, count: c.length };
}

let cpuPrev = getCPU();

// ==================== HTTP SERVER ====================
const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url, true);

  // Stats — public
  if (p.pathname === '/stats') {
    const mem = process.memoryUsage();
    const memPct = Math.round(mem.heapUsed / mem.heapTotal * 100);
    const cpuCur = getCPU();
    const cpuDelta = cpuCur.total - cpuPrev.total;
    const cpuPct = cpuDelta > 0 ? Math.round((1 - (cpuCur.idle - cpuPrev.idle) / cpuDelta) * 100) : 0;
    cpuPrev = cpuCur;
    const lastRx = stats.rx - lastRxCache;
    const lastTx = stats.tx - lastTxCache;
    lastRxCache = stats.rx; lastTxCache = stats.tx;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      uptime: Math.floor(process.uptime()),
      cpu: cpuPct,
      mem: memPct,
      rx: stats.rx, tx: stats.tx,
      rxd: lastRx, txd: lastTx
    }));
    return;
  }

  // Root — single page with inline login
  if (p.pathname === '/') {
    serve(res, 200, 'text/html', fs.readFileSync('./public/dashboard.html', 'utf-8'));
    return;
  }

  res.writeHead(404); res.end();
});

// ==================== WEBSOCKET SERVER (proxy to Xray) ====================
const wss = new WebSocket.Server({ server, perMessageDeflate: false, maxPayload: 1024 * 256 });
wss.on('connection', (ws, req) => {
  const path = url.parse(req.url).pathname;
  const port = WS_PATHS[path];
  if (!port) { ws.close(); return; }

  const xws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { perMessageDeflate: false });
  xws.on('open', () => {
    ws.on('message', (d) => {
      stats.rx += Buffer.from(d).length;
      if (xws.readyState === WebSocket.OPEN) xws.send(d);
    });
    xws.on('message', (d) => {
      stats.tx += Buffer.from(d).length;
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    });
    ws.on('close', () => xws.close());
    xws.on('close', () => ws.close());
    ws.on('error', () => {});
    xws.on('error', () => {});
  });
  xws.on('error', () => ws.close(1011, 'Xray unavailable'));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log('AeroTunnel+Xray active on :' + PORT));