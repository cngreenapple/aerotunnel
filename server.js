const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');
const http = require('http');
const url = require('url');
const fs = require('fs');
const os = require('os');

const WS_OPEN = 1;
const AUTH = 'Basic ' + Buffer.from('aero:aero').toString('base64');

function serve(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// ==================== STATS ====================
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

// ==================== PROTOCOL HANDLERS ====================

// Trojan header: 56 bytes salt + 0d0a + cmd(01/03) + atype + addr + port + data
function readTrojan(buf) {
  const db = buf.slice(58);
  if (db.length < 6) return null;
  const isUDP = db[0] === 3;
  if (db[0] !== 1 && db[0] !== 3) return null;
  const atype = db[1];
  let addrLen, addrOff = 2, addr;
  if (atype === 1) { addrLen = 4; addr = Array.from(db.slice(addrOff, addrOff+4)).join('.'); }
  else if (atype === 3) { addrLen = db[addrOff] + 1; addrOff++; addr = db.slice(addrOff, addrOff+db[addrOff]).toString(); addrLen = db[addrOff] + 1; }
  else if (atype === 4) { addrLen = 16; const v6=[]; for(let i=0;i<8;i++) v6.push(db.readUInt16BE(addrOff+i*2).toString(16)); addr = v6.join(':'); }
  else return null;
  const port = db.readUInt16BE(addrOff + addrLen);
  return { addr, port, isUDP, data: db.slice(addrOff + addrLen + 2), version: null };
}

// VLESS/VMess header: version(1) + cmd(1) + opt(16) + atype + addr + port + data
function readVLESS(buf) {
  const ver = buf[0];
  if (ver !== 0 && ver !== 1) return null;
  const optLen = buf[17];
  const cmd = buf[18 + optLen];
  const isUDP = cmd === 2;
  if (cmd !== 1 && cmd !== 2) return null;
  const portOff = 18 + optLen + 1;
  const port = buf.readUInt16BE(portOff);
  let addrOff = portOff + 2;
  const atype = buf[addrOff]; addrOff++;
  let addr;
  if (atype === 1) { addr = Array.from(buf.slice(addrOff, addrOff+4)).join('.'); addrOff += 4; }
  else if (atype === 3) { const al = buf[addrOff]; addrOff++; addr = buf.slice(addrOff, addrOff+al).toString(); addrOff += al; }
  else if (atype === 4) { const v6=[]; for(let i=0;i<8;i++) v6.push(buf.readUInt16BE(addrOff+i*2).toString(16)); addr = v6.join(':'); addrOff += 16; }
  else return null;
  return { addr, port, isUDP, data: buf.slice(addrOff), version: ver };
}

function sniff(buf) {
  // Trojan: check 0d0a delimiter at byte 56-57
  if (buf.length >= 60 && buf[56] === 0x0d && buf[57] === 0x0a) return readTrojan(buf);
  // VLESS/VMess
  return readVLESS(buf);
}

// ==================== UDP HANDLER ====================
function handleUDP(addr, port, chunk, ws, respHeader) {
  const key = `${addr}:${port}:${Date.now()}`;
  const sock = dgram.createSocket('udp4');
  activeUDP.set(key, { sock, ws });

  sock.on('error', () => { try{sock.close()}catch(e){}; activeUDP.delete(key); });
  sock.on('message', (msg) => {
    stats.tx += msg.length;
    if (ws.readyState === WS_OPEN) {
      const p = respHeader ? Buffer.concat([Buffer.from(respHeader), msg]) : msg;
      ws.send(p);
      respHeader = null;
    }
  });

  sock.send(chunk, port, addr, (err) => { if (err) { try{sock.close()}catch(e){}; activeUDP.delete(key); } });

  // idle timeout 30s
  const tmr = setTimeout(() => { try{sock.close()}catch(e){}; activeUDP.delete(key); }, 30000);
  sock.on('message', () => { tmr.refresh(); });
}

// ==================== HTTP SERVER ====================
const server = http.createServer((req, res) => {
  const p = url.parse(req.url, true);

  if (p.pathname === '/stats') {
    const mem = process.memoryUsage();
    const memPct = Math.round(mem.heapUsed / mem.heapTotal * 100);
    const cpuCur = getCPU();
    const cpuDelta = cpuCur.total - cpuPrev.total;
    const cpuPct = cpuDelta > 0 ? Math.round((1 - (cpuCur.idle - cpuPrev.idle) / cpuDelta) * 100) : 0;
    cpuPrev = cpuCur;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      uptime: Math.floor(process.uptime()),
      cpu: cpuPct,
      mem: memPct,
      rx: stats.rx, tx: stats.tx
    }));
    return;
  }

  if (p.pathname === '/') {
    serve(res, 200, 'text/html', fs.readFileSync('./public/index.html', 'utf-8'));
    return;
  }

  res.writeHead(404); res.end();
});

// ==================== WEBSOCKET SERVER ====================
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

    if (h.isUDP) {
      handleUDP(h.addr, h.port, h.data, ws, h.version != null ? [h.version, 0] : null);
      return;
    }

    // TCP
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

function cleanupUDP(ws) {
  for (const [k, v] of activeUDP) {
    if (v.ws === ws) { try{v.sock.close()}catch(e){}; activeUDP.delete(k); }
  }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log('AeroTunnel active on :' + PORT));