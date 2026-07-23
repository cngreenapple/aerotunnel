const WebSocket = require('ws');
const net = require('net');
const http = require('http');
const url = require('url');

const WS_READY_STATE_OPEN = 1;

const PROTOCOLS = { TROJAN: 'Trojan', VLESS: 'VLESS' };

// ==================== PROTOCOL PARSERS ====================
function detectProtocol(buf) {
  if (buf.length >= 62) {
    const d = buf.slice(56, 60);
    if (d[0] === 0x0d && d[1] === 0x0a && [0x01, 0x03, 0x7f].includes(d[2]) && [0x01, 0x03, 0x04].includes(d[3])) return PROTOCOLS.TROJAN;
  }
  return PROTOCOLS.VLESS;
}

function parseVLESS(buf) {
  const v = buf[0]; let udp = false;
  const ol = buf[17]; const cmd = buf[18 + ol];
  if (cmd === 2) udp = true; else if (cmd !== 1) return { hasError: true, message: 'Cmd ' + cmd + ' unsupported' };
  const pi = 18 + ol + 1; const pr = buf.readUInt16BE(pi);
  let ai = pi + 2; const at = buf[ai]; let al = 0, avi = ai + 1, av = "";
  if (at === 1) { al = 4; av = Array.from(buf.slice(avi, avi + al)).join('.'); }
  else if (at === 2) { al = buf[avi]; avi += 1; av = buf.slice(avi, avi + al).toString(); }
  else if (at === 3) { al = 16; const ip = []; for (let i = 0; i < 8; i++) ip.push(buf.readUInt16BE(avi + i * 2).toString(16)); av = ip.join(':'); }
  else return { hasError: true, message: 'Invalid addr type: ' + at };
  if (!av) return { hasError: true, message: 'Addr empty' };
  return { hasError: false, addressRemote: av, portRemote: pr, rawDataIndex: avi + al, rawClientData: buf.slice(avi + al), version: Buffer.from([v, 0]), isUDP: udp };
}

function parseTrojan(buf) {
  const db = buf.slice(58);
  if (db.length < 6) return { hasError: true, message: "Invalid Trojan data" };
  let udp = false; const cmd = db[0];
  if (cmd === 3) udp = true; else if (cmd !== 1) throw new Error("Unsupported cmd");
  let at = db[1], al = 0, avi = 2, av = "";
  if (at === 1) { al = 4; av = Array.from(db.slice(avi, avi + al)).join('.'); }
  else if (at === 3) { al = db[avi]; avi += 1; av = db.slice(avi, avi + al).toString(); }
  else if (at === 4) { al = 16; const ip = []; for (let i = 0; i < 8; i++) ip.push(db.readUInt16BE(avi + i * 2).toString(16)); av = ip.join(':'); }
  else return { hasError: true, message: 'Invalid addr type: ' + at };
  if (!av) return { hasError: true, message: 'Addr empty' };
  const pi = avi + al; const pr = db.readUInt16BE(pi);
  return { hasError: false, addressRemote: av, portRemote: pr, rawDataIndex: pi + 4, rawClientData: db.slice(pi + 4), version: null, isUDP: udp };
}

// ==================== TCP HANDLER ====================
let stats = { rx: 0, tx: 0 };

function handleTCP(remoteSocket, addressRemote, portRemote, rawClientData, ws, responseHeader) {
  let header = responseHeader;
  const ts = net.createConnection({ host: addressRemote, port: portRemote }, () => ts.write(rawClientData));
  remoteSocket.value = ts;
  ts.on('data', (chunk) => {
    stats.tx += chunk.length;
    if (ws.readyState !== WS_READY_STATE_OPEN) { ts.destroy(); return; }
    if (header) { ws.send(Buffer.concat([Buffer.from(header), chunk])); header = null; }
    else ws.send(chunk);
  });
  ts.on('close', () => { try { if (ws.readyState === WS_READY_STATE_OPEN) ws.close(); } catch (e) {} });
  ts.on('error', () => { try { if (ws.readyState === WS_READY_STATE_OPEN) ws.close(); } catch (e) {} });
}

// ==================== WEBSOCKET HANDLER ====================
async function websocketHandler(ws) {
  let remoteSocketWrapper = { value: null };

  ws.on('message', async (message) => {
    try {
      const chunk = Buffer.from(message);
      stats.rx += chunk.length;
      if (remoteSocketWrapper.value) { remoteSocketWrapper.value.write(chunk); return; }

      const protocol = detectProtocol(chunk);
      const h = protocol === PROTOCOLS.TROJAN ? parseTrojan(chunk) : parseVLESS(chunk);
      if (h.hasError) throw new Error(h.message);

      if (h.isUDP) {
        if (h.portRemote === 53) {
          try {
            const resp = await fetch('https://cloudflare-dns.com/dns-query', {
              method: 'POST', headers: { 'content-type': 'application/dns-message' }, body: h.rawClientData
            });
            const dnsResult = Buffer.from(await resp.arrayBuffer());
            const sb = Buffer.alloc(2); sb.writeUInt16BE(dnsResult.length);
            ws.send(h.version ? Buffer.concat([h.version, sb, dnsResult]) : Buffer.concat([sb, dnsResult]));
          } catch (e) { console.error('DNS error', e); }
        }
        return;
      }

      handleTCP(remoteSocketWrapper, h.addressRemote, h.portRemote, h.rawClientData, ws, h.version);
    } catch (err) { ws.close(1011, err.message); }
  });

  ws.on('close', () => { if (remoteSocketWrapper.value) remoteSocketWrapper.value.end(); });
}

// ==================== HTTP SERVER ====================
const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url, true);

  if (p.pathname === '/api/stats') {
    const mem = process.memoryUsage();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      uptime: Math.floor(process.uptime()),
      mem: { heap: mem.heapUsed, total: mem.heapTotal },
      rx: stats.rx, tx: stats.tx
    }));
    return;
  }

  if (p.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AeroTunnel - Gateway</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{font-family:'Inter',sans-serif}
.glow{box-shadow:0 0 20px rgba(59,130,246,.15)}
.card-hover{transition:all .2s}
.card-hover:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.3)}
</style>
</head>
<body class="bg-[#0a0b10] text-white min-h-screen">
<div class="max-w-3xl mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Aero<span class="text-blue-400">Tunnel</span></h1>
      <p class="text-sm text-gray-500 mt-1">WebSocket VPN Gateway</p>
    </div>
    <div class="flex items-center gap-2 bg-[#11131f] border border-gray-800 rounded-full px-4 py-2">
      <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
      <span class="text-xs font-medium text-green-400 tracking-wide">RUNNING</span>
    </div>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    <div class="bg-[#11131f] border border-gray-800 rounded-xl p-4 card-hover glow">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Uptime</p>
      <p class="text-xl font-bold" id="uptime">00:00:00</p>
    </div>
    <div class="bg-[#11131f] border border-gray-800 rounded-xl p-4 card-hover">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Download (TX)</p>
      <p class="text-xl font-bold text-green-400" id="tx">0 B</p>
    </div>
    <div class="bg-[#11131f] border border-gray-800 rounded-xl p-4 card-hover">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Upload (RX)</p>
      <p class="text-xl font-bold text-blue-400" id="rx">0 B</p>
    </div>
    <div class="bg-[#11131f] border border-gray-800 rounded-xl p-4 card-hover">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Memory</p>
      <p class="text-xl font-bold" id="mem">-</p>
    </div>
  </div>

  <div class="bg-[#11131f] border border-gray-800 rounded-xl p-6 mb-8">
    <p class="text-xs text-gray-500 uppercase tracking-wider mb-4">Quick Config Generator</p>
    <div class="flex flex-wrap gap-3 mb-4">
      <button onclick="gen('vless')" class="bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 px-5 py-2.5 rounded-lg text-sm font-semibold transition">VLESS</button>
      <button onclick="gen('trojan')" class="bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 px-5 py-2.5 rounded-lg text-sm font-semibold transition">TROJAN</button>
    </div>
    <div class="flex gap-2">
      <input type="text" id="out" readonly class="flex-1 bg-[#0a0b10] border border-gray-800 text-gray-400 px-4 py-3 rounded-lg text-sm font-mono outline-none focus:border-gray-600" placeholder="Select protocol...">
      <button onclick="cp()" id="cpy" class="bg-white text-black px-5 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">Copy</button>
    </div>
  </div>

  <div class="bg-[#11131f] border border-gray-800 rounded-xl p-6">
    <p class="text-xs text-gray-500 uppercase tracking-wider mb-3">Cara Pakai</p>
    <p class="text-sm text-gray-400">Hubungkan klien VPN ke <code class="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">wss://domain-anda.up.railway.app/aerotunnel</code></p>
    <p class="text-sm text-gray-500 mt-2">Path: <code class="text-gray-400">/aerotunnel</code>, Port: 443, TLS aktif</p>
  </div>
</div>

<script>
function fmt(b){if(b===0)return'0 B';const k=1024,s=['B','KB','MB','GB','TB'];const i=Math.floor(Math.log(b)/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]}
function fmtT(s){const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),s2=s%60;return(d>0?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s2).padStart(2,'0')}
async function ref(){try{const r=await fetch('/api/stats'),d=await r.json();document.getElementById('uptime').innerText=fmtT(d.uptime);document.getElementById('tx').innerText=fmt(d.tx);document.getElementById('rx').innerText=fmt(d.rx);document.getElementById('mem').innerText=Math.round(d.mem.heap/d.mem.total*100)+'%'}catch(e){}}
ref();setInterval(ref,2000);
function gen(t){const h=window.location.hostname,u='3b01a777-55e7-49f6-8637-d94ee69607c6',uri=t==='vless'?'vless://'+u+'@'+h+':443?encryption=none&security=tls&sni='+h+'&type=ws&host='+h+'&path=%2Faerotunnel#AEROTUNNEL-VLESS':'trojan://'+u+'@'+h+':443?security=tls&sni='+h+'&type=ws&host='+h+'&path=%2Faerotunnel#AEROTUNNEL-TROJAN';document.getElementById('out').value=uri;document.getElementById('cpy').innerText='Copy'}
function cp(){const t=document.getElementById('out');if(!t.value)return;t.select();navigator.clipboard.writeText(t.value).then(()=>{const b=document.getElementById('cpy');b.innerText='Copied!';setTimeout(()=>{if(b.innerText==='Copied!')b.innerText='Copy'},2000)}).catch(e=>console.error(e))}
</script>
</body>
</html>`);
    return;
  }

  res.writeHead(404); res.end();
});

// ==================== WEBSOCKET SERVER ====================
const wss = new WebSocket.Server({ server, perMessageDeflate: false });
wss.on('connection', (ws, req) => {
  const path = url.parse(req.url).pathname;
  if (path === '/aerotunnel') websocketHandler(ws);
  else ws.close();
});

// ==================== START ====================
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log('AeroTunnel active on :' + PORT));