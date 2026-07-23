const WebSocket = require('ws');
const net = require('net');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

// ==================== KONSTANTA ====================
const vmessUUID = "3b01a777-55e7-49f6-8637-d94ee69607c6";
const PROXY_LIST_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";

const KDFSALT_CONST_VMESS_HEADER_PAYLOAD_LENGTH_AEAD_KEY = Buffer.from("VMess Header AEAD Key_Length");
const KDFSALT_CONST_VMESS_HEADER_PAYLOAD_LENGTH_AEAD_IV = Buffer.from("VMess Header AEAD Nonce_Length");
const KDFSALT_CONST_VMESS_HEADER_PAYLOAD_AEAD_KEY = Buffer.from("VMess Header AEAD Key");
const KDFSALT_CONST_VMESS_HEADER_PAYLOAD_AEAD_IV = Buffer.from("VMess Header AEAD Nonce");
const KDFSALT_CONST_AEAD_RESP_HEADER_LEN_KEY = Buffer.from("AEAD Resp Header Len Key");
const KDFSALT_CONST_AEAD_RESP_HEADER_LEN_IV = Buffer.from("AEAD Resp Header Len IV");
const KDFSALT_CONST_AEAD_RESP_HEADER_KEY = Buffer.from("AEAD Resp Header Key");
const KDFSALT_CONST_AEAD_RESP_HEADER_IV = Buffer.from("AEAD Resp Header IV");

const WS_READY_STATE_OPEN = 1;
const DNS_PORT = 53;

const PROTOCOLS = {
  P1: 'Trojan',
  P2: 'VLESS',
  P3: 'Shadowsocks',
  P4: 'VMess'
};

const ADDRESS_TYPES = { IPV4: 1, DOMAIN: 2, IPV6: 3, DOMAIN_ALT: 3 };
const COMMAND_TYPES = { TCP: 1, UDP: 2, UDP_ALT: 3 };

// ==================== PROXY LIST ====================
let cachedProxyList = null;
let cacheTime = 0;
const CACHE_TTL = 300000;

async function fetchProxyList() {
  const now = Date.now();
  if (cachedProxyList && (now - cacheTime) < CACHE_TTL) return cachedProxyList;
  try {
    const resp = await fetch(PROXY_LIST_URL);
    const text = await resp.text();
    const proxyMap = new Map();
    for (const line of text.split('\n')) {
      if (line.trim() && !line.startsWith('#')) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const ps = parts[0].trim() + ':' + parts[1].trim();
          const cc = parts[2].trim();
          if (!proxyMap.has(cc)) proxyMap.set(cc, []);
          proxyMap.get(cc).push(ps);
        }
      }
    }
    cachedProxyList = proxyMap;
    cacheTime = now;
    return proxyMap;
  } catch (e) { return cachedProxyList || new Map(); }
}

async function getProxyFromPath(pathname) {
  if (!pathname || pathname === '/') return null;
  const cmd = pathname.substring(1).split('/')[0].toUpperCase();
  const pm = await fetchProxyList();
  if (pm.has(cmd)) { const p = pm.get(cmd); return p[Math.floor(Math.random() * p.length)]; }
  const mi = cmd.match(/^([A-Z]{2})(\d+)$/);
  if (mi && pm.has(mi[1])) { const p = pm.get(mi[1]); return p[parseInt(mi[2]) - 1] || null; }
  if (cmd === 'ALL') { const all = []; for (const v of pm.values()) all.push(...v); return all.length ? all[Math.floor(Math.random() * all.length)] : null; }
  const ipm = pathname.match(/^\/([\d\.]+)[:=:-](\d+)$/);
  if (ipm) return ipm[1] + ':' + ipm[2];
  return null;
}

// ==================== CRYPTO ====================
function toBuffer(uuidStr) {
  return Buffer.from(uuidStr.replace(/-/g, ''), 'hex');
}

function kdf(key, paths) {
  let h = crypto.createHash('sha256').update(key).digest();
  h = crypto.createHmac('sha256', Buffer.from("VMess AEAD KDF")).update(h).digest();
  for (const p of paths) h = crypto.createHmac('sha256', p).update(h).digest();
  return h;
}

function aesGcmDecrypt(key, iv, data, aad) {
  const d = crypto.createDecipheriv('aes-128-gcm', key, iv, { authTagLength: 16 });
  d.setAAD(aad || Buffer.alloc(0));
  const tag = data.slice(-16);
  const ct = data.slice(0, -16);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

function aesGcmEncrypt(key, iv, data, aad) {
  const e = crypto.createCipheriv('aes-128-gcm', key, iv, { authTagLength: 16 });
  e.setAAD(aad || Buffer.alloc(0));
  return Buffer.concat([e.update(data), e.final(), e.getAuthTag()]);
}

// ==================== PROTOCOL PARSERS ====================
async function detectProtocol(buf) {
  if (buf.length >= 16 && await isVMess(buf)) return PROTOCOLS.P4;
  if (buf.length >= 62) {
    const d = buf.slice(56, 60);
    if (d[0] === 0x0d && d[1] === 0x0a && [0x01, 0x03, 0x7f].includes(d[2]) && [0x01, 0x03, 0x04].includes(d[3])) return PROTOCOLS.P1;
  }
  const h = buf.slice(1, 17).toString('hex');
  if (h.match(/^[0-9a-f]{8}[0-9a-f]{4}4[0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i)) return PROTOCOLS.P2;
  return PROTOCOLS.P3;
}

async function isVMess(buf) {
  if (buf.length < 42) return false;
  try {
    const uuidBytes = toBuffer(vmessUUID);
    const auth_id = buf.slice(0, 16);
    const len_encrypted = buf.slice(16, 34);
    const nonce = buf.slice(34, 42);
    const key = crypto.createHash('md5').update(Buffer.concat([uuidBytes, Buffer.from("c48619fe-8f02-49e0-b9e9-edf763e17e21")])).digest();
    const hlk = kdf(key, [KDFSALT_CONST_VMESS_HEADER_PAYLOAD_LENGTH_AEAD_KEY, auth_id, nonce]).slice(0, 16);
    const hln = kdf(key, [KDFSALT_CONST_VMESS_HEADER_PAYLOAD_LENGTH_AEAD_IV, auth_id, nonce]).slice(0, 12);
    const dec = aesGcmDecrypt(hlk, hln, len_encrypted, auth_id);
    const hl = (dec[0] << 8) | dec[1];
    return hl > 0 && hl < 4096;
  } catch (e) { return false; }
}

async function parseP4Header(buf) {
  const uuidBytes = toBuffer(vmessUUID);
  const auth_id = buf.slice(0, 16);
  let remaining = buf.slice(16);
  const len_encrypted = remaining.slice(0, 18);
  remaining = remaining.slice(18);
  const nonce = remaining.slice(0, 8);
  remaining = remaining.slice(8);
  const key = crypto.createHash('md5').update(Buffer.concat([uuidBytes, Buffer.from("c48619fe-8f02-49e0-b9e9-edf763e17e21")])).digest();
  const mainKey = key;
  const hlk = kdf(key, [KDFSALT_CONST_VMESS_HEADER_PAYLOAD_LENGTH_AEAD_KEY, auth_id, nonce]).slice(0, 16);
  const hln = kdf(key, [KDFSALT_CONST_VMESS_HEADER_PAYLOAD_LENGTH_AEAD_IV, auth_id, nonce]).slice(0, 12);
  const decLen = aesGcmDecrypt(hlk, hln, len_encrypted, auth_id);
  const header_length = (decLen[0] << 8) | decLen[1];
  const cmd_encrypted = remaining.slice(0, header_length + 16);
  const rawClientData = remaining.slice(header_length + 16);
  const pk = kdf(mainKey, [KDFSALT_CONST_VMESS_HEADER_PAYLOAD_AEAD_KEY, auth_id, nonce]).slice(0, 16);
  const pn = kdf(mainKey, [KDFSALT_CONST_VMESS_HEADER_PAYLOAD_AEAD_IV, auth_id, nonce]).slice(0, 12);
  const cmdBuf = aesGcmDecrypt(pk, pn, cmd_encrypted, auth_id);
  if (cmdBuf[0] !== 1) throw new Error("Invalid VMess version");
  const iv = cmdBuf.slice(1, 17);
  const keyResp = cmdBuf.slice(17, 33);
  const responseAuth = cmdBuf[33];
  const command = cmdBuf[37];
  const portRemote = (cmdBuf[38] << 8) | cmdBuf[39];
  const addrType = cmdBuf[40];
  let addrEnd = 41, addressRemote = "";
  if (addrType === 1) { addressRemote = cmdBuf[41] + '.' + cmdBuf[42] + '.' + cmdBuf[43] + '.' + cmdBuf[44]; addrEnd += 4; }
  else if (addrType === 2) { const l = cmdBuf[41]; addressRemote = cmdBuf.slice(42, 42 + l).toString(); addrEnd += 1 + l; }
  else if (addrType === 3) { const p = []; for (let i = 0; i < 8; i++) p.push(((cmdBuf[41 + i * 2] << 8) | cmdBuf[41 + i * 2 + 1]).toString(16)); addressRemote = p.join(':'); addrEnd += 16; }
  const respKeyBase = crypto.createHash('sha256').update(keyResp).digest().slice(0, 16);
  const respIvBase = crypto.createHash('sha256').update(iv).digest().slice(0, 16);
  const lk = kdf(respKeyBase, [KDFSALT_CONST_AEAD_RESP_HEADER_LEN_KEY]).slice(0, 16);
  const liv = kdf(respIvBase, [KDFSALT_CONST_AEAD_RESP_HEADER_LEN_IV]).slice(0, 12);
  const encLen = aesGcmEncrypt(lk, liv, Buffer.from([0, 4]));
  const pkResp = kdf(respKeyBase, [KDFSALT_CONST_AEAD_RESP_HEADER_KEY]).slice(0, 16);
  const pnResp = kdf(respIvBase, [KDFSALT_CONST_AEAD_RESP_HEADER_IV]).slice(0, 12);
  const encPayload = aesGcmEncrypt(pkResp, pnResp, Buffer.from([responseAuth, 0, 0, 0]));
  return { hasError: false, addressRemote, portRemote, rawClientData, version: Buffer.concat([encLen, encPayload]), isUDP: portRemote === DNS_PORT };
}

function parseP3Header(buf) {
  const at = buf[0]; let al = 0, avi = 1, av = "";
  if (at === 1) { al = 4; av = Array.from(buf.slice(avi, avi + al)).join('.'); }
  else if (at === 3) { al = buf[avi]; avi += 1; av = buf.slice(avi, avi + al).toString(); }
  else if (at === 4) { al = 16; const ip = []; for (let i = 0; i < 8; i++) ip.push(buf.readUInt16BE(avi + i * 2).toString(16)); av = ip.join(':'); }
  else return { hasError: true, message: 'Invalid addr type P3: ' + at };
  if (!av) return { hasError: true, message: 'Addr empty' };
  const pi = avi + al;
  const pr = buf.readUInt16BE(pi);
  return { hasError: false, addressRemote: av, portRemote: pr, rawDataIndex: pi + 2, rawClientData: buf.slice(pi + 2), version: null, isUDP: pr === DNS_PORT };
}

function parseP2Header(buf) {
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

function parseP1Header(buf) {
  const db = buf.slice(58);
  if (db.length < 6) return { hasError: true, message: "Invalid P1 data" };
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

// ==================== TCP/UDP HANDLERS ====================
function remoteSocketToWS(remoteSocket, webSocket, responseHeader) {
  let header = responseHeader;
  remoteSocket.on('data', (chunk) => {
    if (webSocket.readyState !== WS_READY_STATE_OPEN) { remoteSocket.destroy(); return; }
    if (header) { webSocket.send(Buffer.concat([Buffer.from(header), chunk])); header = null; }
    else webSocket.send(chunk);
  });
  remoteSocket.on('close', () => safeClose(webSocket));
  remoteSocket.on('error', () => safeClose(webSocket));
}

async function handleTCPOutbound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, responseHeader) {
  const ts = net.createConnection({ host: addressRemote, port: portRemote }, () => ts.write(rawClientData));
  remoteSocket.value = ts;
  ts.on('close', () => safeClose(webSocket));
  ts.on('error', () => safeClose(webSocket));
  remoteSocketToWS(ts, webSocket, responseHeader);
}

function safeClose(ws) { try { if (ws.readyState === WS_READY_STATE_OPEN) ws.close(); } catch (e) {} }

// ==================== WEBSOCKET HANDLER ====================
async function websocketHandler(ws, pathname) {
  let prxIP = '';
  const proxyFromPath = await getProxyFromPath(pathname);
  if (proxyFromPath) prxIP = proxyFromPath;

  let remoteSocketWrapper = { value: null };
  let addressLog = '', portLog = '';

  ws.on('message', async (message) => {
    try {
      const chunk = Buffer.from(message);
      if (remoteSocketWrapper.value) { remoteSocketWrapper.value.write(chunk); return; }

      const protocol = await detectProtocol(chunk);
      let protocolHeader;
      if (protocol === PROTOCOLS.P1) protocolHeader = parseP1Header(chunk);
      else if (protocol === PROTOCOLS.P2) protocolHeader = parseP2Header(chunk);
      else if (protocol === PROTOCOLS.P4) protocolHeader = await parseP4Header(chunk);
      else protocolHeader = parseP3Header(chunk);

      if (protocolHeader.hasError) throw new Error(protocolHeader.message);
      addressLog = protocolHeader.addressRemote;
      portLog = protocolHeader.portRemote;

      if (protocolHeader.isUDP) {
        if (protocolHeader.portRemote === DNS_PORT) {
          try {
            const resp = await fetch('https://cloudflare-dns.com/dns-query', {
              method: 'POST', headers: { 'content-type': 'application/dns-message' },
              body: protocolHeader.rawClientData
            });
            const dnsResult = Buffer.from(await resp.arrayBuffer());
            const sizeBuf = Buffer.alloc(2); sizeBuf.writeUInt16BE(dnsResult.length);
            if (protocolHeader.version) ws.send(Buffer.concat([protocolHeader.version, sizeBuf, dnsResult]));
            else ws.send(Buffer.concat([sizeBuf, dnsResult]));
          } catch (e) { console.error('DNS error', e); }
        }
        return;
      }

      handleTCPOutbound(remoteSocketWrapper, protocolHeader.addressRemote, protocolHeader.portRemote,
        protocolHeader.rawClientData, ws, protocolHeader.version);
    } catch (err) { ws.close(1011, err.message); }
  });

  ws.on('close', () => { if (remoteSocketWrapper.value) remoteSocketWrapper.value.end(); });
  ws.on('error', () => {});
}

// ==================== DOCS HTML ====================
const DOCS_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>VPN Config Manager - Docs</title>
<style>
body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;padding:2rem;max-width:800px;margin:0 auto;line-height:1.6}
h1{color:#60a5fa;border-bottom:2px solid #1e293b;padding-bottom:.5rem}
h2{color:#94a3b8;margin-top:2rem}
code{background:#1e293b;padding:.2rem .4rem;border-radius:4px;font-size:.9rem}
pre{background:#1e293b;padding:1rem;border-radius:8px;overflow-x:auto}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{border:1px solid #334155;padding:.5rem;text-align:left}
th{background:#1e293b}
a{color:#60a5fa}
</style></head>
<body>
<h1>📘 VPN Config Manager - Path Usage</h1>
<p>WebSocket tunneling ke berbagai proxy. Path menentukan target proxy:</p>
<table>
<tr><th>Pattern</th><th>Example</th><th>Description</th></tr>
<tr><td><code>/COUNTRY</code></td><td><code>/SG</code>, <code>/ID</code></td><td>Random proxy from that country</td></tr>
<tr><td><code>/COUNTRY{INDEX}</code></td><td><code>/SG1</code>, <code>/ID2</code></td><td>Specific proxy index</td></tr>
<tr><td><code>/ALL</code></td><td><code>/ALL</code></td><td>Random proxy from any country</td></tr>
<tr><td><code>/IP:PORT</code></td><td><code>/103.6.207.108:8080</code></td><td>Direct IP:port</td></tr>
</table>
<p>Protocols: <b>VMess</b>, <b>VLESS</b>, <b>Trojan</b>, <b>Shadowsocks</b></p>
<p>VMess UUID: <code>${vmessUUID}</code></p>
</body></html>`;

// ==================== HTTP SERVER ====================
const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url, true);

  if (p.pathname === '/docs') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(DOCS_HTML);
    return;
  }

  if (p.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AEROTUNNEL // GATEWAY</title>
<style>
:root{--bg:#000;--panel:#0a0a0a;--card:#000;--border:#1f1f1f;--text:#fff;--muted:#888;--blue:#0088FF;--green:#00df89}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:6vh 24px}
.win{width:100%;max-width:640px;background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.8)}
.head{background:#050505;border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
.brand{font-size:.8rem;font-weight:700;letter-spacing:3px;text-transform:uppercase}
.brand span{color:var(--blue)}
.badge{display:flex;align-items:center;gap:6px;font-size:.75rem;font-weight:600;color:var(--green);letter-spacing:.5px}
.dot{width:6px;height:6px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);animation:pulse 2.5s infinite}
.content{padding:32px}
.sec{text-align:center;padding-bottom:32px;border-bottom:1px solid var(--border);margin-bottom:24px}
.lbl{font-size:.7rem;text-transform:uppercase;color:var(--muted);letter-spacing:2px;margin-bottom:8px}
.val{font-size:3rem;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px}
.c{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px}
.c .val{font-size:1.5rem;margin-top:4px}
.gen{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
button{background:#111;color:#fff;border:1px solid var(--border);padding:12px;border-radius:6px;font-size:.85rem;font-weight:600;letter-spacing:1px;cursor:pointer;transition:all .2s}
button:hover{background:#222;border-color:#444}
.bv:hover{border-color:var(--blue);color:var(--blue)}
.bt:hover{border-color:#ff0080;color:#ff0080}
.row{display:flex;gap:8px}
input[type=text]{flex:1;background:#050505;border:1px solid var(--border);color:var(--muted);padding:12px 16px;border-radius:6px;font-family:monospace;font-size:.8rem;outline:none}
input[type=text]:focus{border-color:#333;color:var(--text)}
.cpy{background:var(--text);color:var(--bg);padding:0 20px;border:none}
.cpy:hover{background:#e0e0e0}
.engine{margin-top:16px;padding:12px;background:#050505;border-radius:6px;font-size:.75rem;color:var(--muted);text-align:center}
.engine b{color:var(--text)}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
@media(max-width:540px){.content{padding:24px}.grid{grid-template-columns:1fr}.val{font-size:2.25rem}.row{flex-direction:column}.cpy{padding:12px}}
</style></head>
<body>
<div class="win">
<div class="head">
<div style="display:flex;gap:8px"><div style="width:12px;height:12px;border-radius:50%;background:#ff5f56;opacity:.75"></div><div style="width:12px;height:12px;border-radius:50%;background:#ffbd2e;opacity:.75"></div><div style="width:12px;height:12px;border-radius:50%;background:#27c93f;opacity:.75"></div></div>
<div class="brand">AERO<span>TUNNEL</span></div>
<div class="badge"><div class="dot"></div>RUNNING</div>
</div>
<div class="content">
<div class="sec"><div class="lbl">System Uptime</div><div class="val" id="up">00:00:00</div></div>
<div class="grid">
<div class="c"><div class="lbl">Download (TX)</div><div class="val" id="dl">0 B</div></div>
<div class="c"><div class="lbl">Upload (RX)</div><div class="val" id="ul">0 B</div></div>
</div>
<div class="gen">
<div class="lbl">Quick Generator</div>
<div class="btns">
<button class="bv" onclick="gen('vless')">VLESS</button>
<button class="bt" onclick="gen('trojan')">TROJAN</button>
<button class="bv" onclick="gen('vmess')" style="border-color:var(--green);color:var(--green)">VMESS</button>
</div>
<div class="row">
<input type="text" id="out" readonly placeholder="Select a protocol..." />
<button class="cpy" id="cpy" onclick="cp()">Copy</button>
</div>
</div>
<div class="engine">Engine: <b>Direct Route</b> — powered by AeroTunnel</div>
</div></div>
<script>
function fmt(b){if(b===0)return'0 B';const k=1024,s=['B','KB','MB','GB','TB'];const i=Math.floor(Math.log(b)/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]}
function fmtT(s){const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),s2=s%60;return(d>0?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s2).padStart(2,'0')}
async function ref(){try{const r=await fetch('/api/stats'),d=await r.json();document.getElementById('up').innerText=fmtT(d.uptime);document.getElementById('dl').innerText=fmt(d.tx);document.getElementById('ul').innerText=fmt(d.rx)}catch(e){}}
ref();setInterval(ref,1000);
function uuid(){return'${vmessUUID}'}
function gen(t){const h=window.location.hostname,u=uuid(),uri=t==='vless'?'vless://'+u+'@'+h+':443?encryption=none&security=tls&sni='+h+'&type=ws&host='+h+'&path=%2Faerotunnel%2FID#AEROTUNNEL-VLESS':t==='trojan'?'trojan://'+u+'@'+h+':443?security=tls&sni='+h+'&type=ws&host='+h+'&path=%2Faerotunnel%2FID#AEROTUNNEL-TROJAN':'vmess://'+btoa(JSON.stringify({v:'2',ps:'AEROTUNNEL-VMESS',add:h,port:'443',id:u,aid:'0',scy:'auto',net:'ws',type:'none',host:h,path:'/aerotunnel/ID',tls:'tls',sni:h}));document.getElementById('out').value=uri;document.getElementById('cpy').innerText='Copy'}
function cp(){const t=document.getElementById('out');if(!t.value)return;t.select();navigator.clipboard.writeText(t.value).then(()=>{const b=document.getElementById('cpy');b.innerText='Copied!';setTimeout(()=>{if(b.innerText==='Copied!')b.innerText='Copy'},2000)}).catch(e=>console.error(e))}
</script></body></html>`);
    return;
  }

  if (p.pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ uptime: Math.floor(process.uptime()), rx: 0, tx: 0 }));
    return;
  }

  res.writeHead(404); res.end();
});

// ==================== WEBSOCKET SERVER ====================
const wss = new WebSocket.Server({ server, perMessageDeflate: false });
wss.on('connection', (ws, req) => {
  const path = url.parse(req.url).pathname;
  websocketHandler(ws, path);
});

// ==================== START ====================
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log('AeroTunnel active on :' + PORT));