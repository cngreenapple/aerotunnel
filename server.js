const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');
const http = require('http');
const url = require('url');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 8080;
const WS_OPEN = 1;

// Stats
let stats = { rx: 0, tx: 0 };
let activeUDP = new Map();

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

// ==================== PROTOCOL PARSERS ====================

function readTrojan(buf) {
  const db = buf.slice(58);
  if (db.length < 6) return null;
  const isUDP = db[0] === 3;
  if (db[0] !== 1 && db[0] !== 3) return null;
  const atype = db[1];
  let addr, off = 2;
  if (atype === 1) { addr = Array.from(db.slice(off, off+4)).join('.'); off += 4; }
  else if (atype === 3) { const al = db[off++]; addr = db.slice(off, off+al).toString(); off += al; }
  else if (atype === 4) { const v6=[]; for(let i=0;i<8;i++) v6.push(db.readUInt16BE(off+i*2).toString(16)); addr = v6.join(':'); off += 16; }
  else return null;
  const port = db.readUInt16BE(off); off += 2;
  // Skip \r\n after port
  if (off + 1 < db.length && db[off] === 0x0d && db[off+1] === 0x0a) off += 2;
  // Skip password hash to next \r\n
  while (off + 1 < db.length && !(db[off] === 0x0d && db[off+1] === 0x0a)) off++;
  if (off + 1 < db.length) off += 2;
  return { addr, port, isUDP, data: db.slice(off) };
}

function readVLESS(buf) {
  const optLen = buf[17];
  const cmd = buf[18 + optLen];
  const isUDP = cmd === 2;
  if (cmd !== 1 && cmd !== 2) return null;
  const portOff = 18 + optLen + 1;
  const port = buf.readUInt16BE(portOff);
  let off = portOff + 2;
  const atype = buf[off++];
  let addr;
  if (atype === 1) { addr = Array.from(buf.slice(off, off+4)).join('.'); off += 4; }
  else if (atype === 3) { const al = buf[off++]; addr = buf.slice(off, off+al).toString(); off += al; }
  else if (atype === 4) { const v6=[]; for(let i=0;i<8;i++) v6.push(buf.readUInt16BE(off+i*2).toString(16)); addr = v6.join(':'); off += 16; }
  else return null;
  return { addr, port, isUDP, data: buf.slice(off) };
}

function sniff(buf) {
  // Trojan: bytes 56-59 = 0d 0a + cmd(01/03) + atype(01/03/04)
  if (buf.length >= 60 && buf[56] === 0x0d && buf[57] === 0x0a &&
      [0x01, 0x03].includes(buf[58]) && [0x01, 0x03, 0x04].includes(buf[59])) {
    const h = readTrojan(buf);
    if (h) return h;
  }
  // VLESS only (VMess needs AEAD decrypt — skip)
  // VLESS: version(1) + cmd(1) + opt[16] + atype + addr + port
  if (buf.length >= 20) {
    const h = readVLESS(buf);
    if (h) return h;
  }
  return null;
}

// ==================== UDP ====================
function handleUDP(addr, port, chunk, ws) {
  const key = `${addr}:${port}:${Date.now()}`;
  const sock = dgram.createSocket('udp4');
  activeUDP.set(key, { sock, ws });
  sock.on('error', () => { try{sock.close()}catch(e){}; activeUDP.delete(key); });
  sock.on('message', (msg) => {
    stats.tx += msg.length;
    if (ws.readyState === WS_OPEN) ws.send(msg);
  });
  sock.send(chunk, port, addr, (err) => { if (err) { try{sock.close()}catch(e){}; activeUDP.delete(key); } });
  const tmr = setTimeout(() => { try{sock.close()}catch(e){}; activeUDP.delete(key); }, 30000);
  sock.on('message', () => tmr.refresh());
}

function cleanupUDP(ws) {
  for (const [k, v] of activeUDP) {
    if (v.ws === ws) { try{v.sock.close()}catch(e){}; activeUDP.delete(k); }
  }
}

// ==================== HTTP SERVER ====================
const server = http.createServer((req, res) => {
  const p = url.parse(req.url, true);

  if (p.pathname === '/health') {
    res.writeHead(200); res.end('OK');
    return;
  }

  if (p.pathname === '/stats') {
    const mem = process.memoryUsage();
    const memPct = Math.round(mem.heapUsed / mem.heapTotal * 100);
    const cpuCur = getCPU();
    const cpuDelta = cpuCur.total - cpuPrev.total;
    const cpuPct = cpuDelta > 0 ? Math.round((1 - (cpuCur.idle - cpuPrev.idle) / cpuDelta) * 100) : 0;
    cpuPrev = cpuCur;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      uptime: Math.floor(process.uptime()), cpu: cpuPct, mem: memPct,
      rx: stats.rx, tx: stats.tx
    }));
    return;
  }

  if (p.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('./public/index.html', 'utf-8'));
    return;
  }

  res.writeHead(404); res.end();
});

// ==================== WEBSOCKET ====================
const wss = new WebSocket.Server({ server, perMessageDeflate: false });

wss.on('connection', (ws, req) => {
  const path = url.parse(req.url).pathname;
  if (!['/vless-aero', '/vmess-aero', '/trojan-aero'].includes(path)) { ws.close(); return; }

  let remote = null;

  ws.on('message', (msg) => {
    const buf = Buffer.from(msg);
    stats.rx += buf.length;
    if (remote) { remote.write(buf); return; }

    const h = sniff(buf);
    if (!h) { ws.close(1002, 'bad protocol'); return; }

    if (h.isUDP) { handleUDP(h.addr, h.port, h.data, ws); return; }

    const sock = net.createConnection({ host: h.addr, port: h.port }, () => {
      sock.write(h.data);
      remote = sock;
    });
    sock.on('error', () => ws.close());
    sock.on('close', () => ws.close());
    sock.on('data', (chunk) => {
      stats.tx += chunk.length;
      if (ws.readyState === WS_OPEN) ws.send(chunk);
    });
  });

  ws.on('close', () => { if (remote) remote.end(); cleanupUDP(ws); });
  ws.on('error', () => cleanupUDP(ws));
});

server.listen(PORT, '0.0.0.0', () => console.log('AeroTunnel active on :' + PORT));