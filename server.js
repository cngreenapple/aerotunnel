const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');
const http = require('http');
const url = require('url');

const horse = Buffer.from("dHJvamFu", 'base64').toString();
const flash = Buffer.from("dm1lc3M=", 'base64').toString();

const WS_READY_STATE_OPEN = 1;

class GatewayServer {
  constructor() {
    this.wss = null;
    this.httpServer = null;
    this.activeUDPConnections = new Map();
    this.stats = { rx: 0, tx: 0 };
  }

  async handleHttpRequest(req, res) {
    const p = url.parse(req.url, true);

    if (p.pathname === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ uptime: Math.floor(process.uptime()), rx: this.stats.rx, tx: this.stats.tx }));
      return;
    }

    if (p.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AEROTUNNEL // GATEWAY</title>
<style>
:root{--bg:#000;--panel:#0a0a0a;--card:#000;--border:#1f1f1f;--text:#fff;--muted:#888;--blue:#0088FF;--green:#00df89}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:6vh 24px;-webkit-font-smoothing:antialiased}
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
.c{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;transition:border-color .2s}
.c:hover{border-color:#333}
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
</style>
</head>
<body>
<div class="win">
<div class="head">
<div style="display:flex;gap:8px"><div style="width:12px;height:12px;border-radius:50%;background:#ff5f56;opacity:.75"></div><div style="width:12px;height:12px;border-radius:50%;background:#ffbd2e;opacity:.75"></div><div style="width:12px;height:12px;border-radius:50%;background:#27c93f;opacity:.75"></div></div>
<div class="brand">AERO<span>TUNNEL</span></div>
<div class="badge"><div class="dot"></div>RUNNING</div>
</div>
<div class="content">
<div class="sec">
<div class="lbl">System Uptime</div>
<div class="val" id="up">00:00:00</div>
</div>
<div class="grid">
<div class="c"><div class="lbl">Download (TX)</div><div class="val" id="dl">0 B</div></div>
<div class="c"><div class="lbl">Upload (RX)</div><div class="val" id="ul">0 B</div></div>
</div>
<div class="gen">
<div class="lbl">Quick Generator</div>
<div class="btns">
<button class="bv" onclick="gen('vless')">VLESS</button>
<button class="bt" onclick="gen('trojan')">TROJAN</button>
</div>
<div class="row">
<input type="text" id="out" readonly placeholder="Select a protocol..." />
<button class="cpy" id="cpy" onclick="cp()">Copy</button>
</div>
</div>
<div class="engine">Engine: <b>Direct Route</b> — powered by AeroTunnel</div>
</div>
</div>
<script>
function fmt(b){if(b===0)return'0 B';const k=1024,s=['B','KB','MB','GB','TB'];const i=Math.floor(Math.log(b)/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]}
function fmtT(s){const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),s2=s%60;return(d>0?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s2).padStart(2,'0')}
async function ref(){try{const r=await fetch('/api/stats'),d=await r.json();document.getElementById('up').innerText=fmtT(d.uptime);document.getElementById('dl').innerText=fmt(d.tx);document.getElementById('ul').innerText=fmt(d.rx)}catch(e){}}
ref();setInterval(ref,1000);
function uuid(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c=='x'?r:(r&0x3|0x8);return v.toString(16)})}
function gen(t){const h=window.location.hostname,u=uuid(),p=t==='vless'?'%2Fvless':'%2Ftrojan',uri=t==='vless'?'vless://'+u+'@'+h+':443?encryption=none&security=tls&sni='+h+'&type=ws&host='+h+'&path='+p+'#AEROTUNNEL-VLESS':'trojan://'+u+'@'+h+':443?security=tls&sni='+h+'&type=ws&host='+h+'&path='+p+'#AEROTUNNEL-TROJAN';document.getElementById('out').value=uri;document.getElementById('cpy').innerText='Copy'}
function cp(){const t=document.getElementById('out');if(!t.value)return;t.select();navigator.clipboard.writeText(t.value).then(()=>{const b=document.getElementById('cpy');b.innerText='Copied!';setTimeout(()=>{if(b.innerText==='Copied!')b.innerText='Copy'},2000)}).catch(e=>console.error(e))}
</script>
</body>
</html>`);
      return;
    }

    res.writeHead(404);res.end();
  }

  async handleWebSocketConnection(ws, request) {
    try {
      const path = url.parse(request.url).pathname;
      if (path === '/vless' || path === '/trojan') {
        await this.websocketHandler(ws);
        return;
      }
      ws.close(1000, "Invalid WebSocket path");
    } catch (err) {
      ws.close(1011, 'Internal server error');
    }
  }

  async websocketHandler(ws) {
    let remoteSocketWrapper = { value: null };

    ws.on('message', async (message) => {
      try {
        const chunk = Buffer.from(message);
        this.stats.rx += chunk.length;

        if (remoteSocketWrapper.value) {
          remoteSocketWrapper.value.write(chunk);
          return;
        }

        const protocol = this.protocolSniffer(chunk);
        let protocolHeader;

        if (protocol === horse) {
          protocolHeader = this.readHorseHeader(chunk);
        } else {
          protocolHeader = this.readFlashHeader(chunk);
        }

        if (protocolHeader.hasError) throw new Error(protocolHeader.message);

        if (protocolHeader.isUDP) {
          return await this.handleUDPOutbound(
            protocolHeader.addressRemote,
            protocolHeader.portRemote,
            chunk.slice(protocolHeader.rawDataIndex),
            ws,
            protocolHeader.version
          );
        }

        this.handleTCPOutBound(
          remoteSocketWrapper,
          protocolHeader.addressRemote,
          protocolHeader.portRemote,
          protocolHeader.rawClientData,
          ws,
          protocolHeader.version
        );
      } catch (err) {
        ws.close(1011, err.message);
      }
    });

    ws.on('close', () => {
      if (remoteSocketWrapper.value) remoteSocketWrapper.value.end();
      this.cleanupUDPConnections(ws);
    });

    ws.on('error', () => {
      this.cleanupUDPConnections(ws);
    });
  }

  protocolSniffer(buffer) {
    if (buffer.length >= 62) {
      const horseDelimiter = buffer.slice(56, 60);
      if (horseDelimiter[0] === 0x0d && horseDelimiter[1] === 0x0a) {
        if ([0x01, 0x03, 0x7f].includes(horseDelimiter[2])) {
          if ([0x01, 0x03, 0x04].includes(horseDelimiter[3])) {
            return horse;
          }
        }
      }
    }
    return flash;
  }

  async handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, responseHeader) {
    const connectAndWrite = (address, port) => {
      return new Promise((resolve, reject) => {
        const tcpSocket = net.createConnection({ host: address, port: port }, () => {
          tcpSocket.write(rawClientData);
          resolve(tcpSocket);
        });
        tcpSocket.on('error', reject);
      });
    };

    try {
      const tcpSocket = await connectAndWrite(addressRemote, portRemote);
      remoteSocket.value = tcpSocket;
      tcpSocket.on('close', () => webSocket.close());
      tcpSocket.on('error', () => webSocket.close());
      this.remoteSocketToWS(tcpSocket, webSocket, responseHeader);
    } catch (error) {
      webSocket.close();
    }
  }

  async handleUDPOutbound(targetAddress, targetPort, dataChunk, webSocket, responseHeader) {
    return new Promise((resolve) => {
      try {
        let protocolHeader = responseHeader;
        const connectionKey = `${targetAddress}:${targetPort}:${Date.now()}`;
        const udpSocket = dgram.createSocket('udp4');

        this.activeUDPConnections.set(connectionKey, { socket: udpSocket, webSocket: webSocket });

        udpSocket.on('error', () => {
          try { udpSocket.close(); } catch (_) {}
          this.activeUDPConnections.delete(connectionKey);
        });

        udpSocket.send(dataChunk, targetPort, targetAddress, (error) => {
          if (error) {
            try { udpSocket.close(); } catch (_) {}
            this.activeUDPConnections.delete(connectionKey);
            return;
          }
        });

        udpSocket.on('message', (message) => {
          this.stats.tx += message.length;

          if (webSocket.readyState === WebSocket.OPEN) {
            if (protocolHeader) {
              const combined = Buffer.concat([Buffer.from(protocolHeader), message]);
              webSocket.send(combined);
              protocolHeader = null;
            } else {
              webSocket.send(message);
            }
          }
        });

        udpSocket.on('close', () => {
          this.activeUDPConnections.delete(connectionKey);
        });

        let idleTimeout = setTimeout(() => {
          if (udpSocket) {
            try { udpSocket.close(); } catch (_) {}
            this.activeUDPConnections.delete(connectionKey);
          }
        }, 30000);

        udpSocket.on('message', () => {
          clearTimeout(idleTimeout);
          idleTimeout = setTimeout(() => {
            if (udpSocket) {
              try { udpSocket.close(); } catch (_) {}
              this.activeUDPConnections.delete(connectionKey);
            }
          }, 30000);
        });

      } catch (e) {}
    });
  }

  cleanupUDPConnections(webSocket) {
    for (const [key, connection] of this.activeUDPConnections.entries()) {
      if (connection.webSocket === webSocket) {
        try { connection.socket.close(); } catch (_) {}
        this.activeUDPConnections.delete(key);
      }
    }
  }

  readFlashHeader(buffer) {
    const version = buffer[0];
    let isUDP = false;
    const optLength = buffer[17];
    const cmd = buffer[18 + optLength];

    if (cmd === 2) isUDP = true;
    else if (cmd !== 1) return { hasError: true, message: `command ${cmd} is not supported` };

    const portIndex = 18 + optLength + 1;
    const portRemote = buffer.readUInt16BE(portIndex);
    let addressIndex = portIndex + 2;
    const addressType = buffer[addressIndex];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = "";

    switch (addressType) {
      case 1:
        addressLength = 4;
        addressValue = Array.from(buffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
        break;
      case 2:
        addressLength = buffer[addressValueIndex];
        addressValueIndex += 1;
        addressValue = buffer.slice(addressValueIndex, addressValueIndex + addressLength).toString();
        break;
      case 3:
        addressLength = 16;
        const ipv6 = [];
        for (let i = 0; i < 8; i++) ipv6.push(buffer.readUInt16BE(addressValueIndex + i * 2).toString(16));
        addressValue = ipv6.join(":");
        break;
      default:
        return { hasError: true, message: `invalid addressType is ${addressType}` };
    }

    if (!addressValue) return { hasError: true, message: `addressValue is empty` };

    return {
      hasError: false,
      addressRemote: addressValue,
      addressType: addressType,
      portRemote: portRemote,
      rawDataIndex: addressValueIndex + addressLength,
      rawClientData: buffer.slice(addressValueIndex + addressLength),
      version: Buffer.from([version, 0]),
      isUDP: isUDP,
    };
  }

  readHorseHeader(buffer) {
    const dataBuffer = buffer.slice(58);
    if (dataBuffer.length < 6) return { hasError: true, message: "invalid request data" };

    let isUDP = false;
    const cmd = dataBuffer[0];
    if (cmd == 3) isUDP = true;
    else if (cmd != 1) throw new Error("Unsupported command type!");

    let addressType = dataBuffer[1];
    let addressLength = 0;
    let addressValueIndex = 2;
    let addressValue = "";

    switch (addressType) {
      case 1:
        addressLength = 4;
        addressValue = Array.from(dataBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
        break;
      case 3:
        addressLength = dataBuffer[addressValueIndex];
        addressValueIndex += 1;
        addressValue = dataBuffer.slice(addressValueIndex, addressValueIndex + addressLength).toString();
        break;
      case 4:
        addressLength = 16;
        const ipv6 = [];
        for (let i = 0; i < 8; i++) ipv6.push(dataBuffer.readUInt16BE(addressValueIndex + i * 2).toString(16));
        addressValue = ipv6.join(":");
        break;
      default:
        return { hasError: true, message: `invalid addressType is ${addressType}` };
    }

    if (!addressValue) return { hasError: true, message: `address is empty` };

    const portIndex = addressValueIndex + addressLength;
    const portRemote = dataBuffer.readUInt16BE(portIndex);
    return {
      hasError: false,
      addressRemote: addressValue,
      addressType: addressType,
      portRemote: portRemote,
      rawDataIndex: portIndex + 4,
      rawClientData: dataBuffer.slice(portIndex + 4),
      version: null,
      isUDP: isUDP,
    };
  }

  remoteSocketToWS(remoteSocket, webSocket, responseHeader) {
    let header = responseHeader;

    remoteSocket.on('data', (chunk) => {
      this.stats.tx += chunk.length;

      if (webSocket.readyState !== WS_READY_STATE_OPEN) {
        remoteSocket.destroy();
        return;
      }
      if (header) {
        const combined = Buffer.concat([Buffer.from(header), chunk]);
        webSocket.send(combined);
        header = null;
      } else {
        webSocket.send(chunk);
      }
    });
  }

  start(port) {
    const server = http.createServer((req, res) => this.handleHttpRequest(req, res));
    this.wss = new WebSocket.Server({ server, perMessageDeflate: false });
    this.wss.on('connection', (ws, req) => this.handleWebSocketConnection(ws, req));

    const gracefulShutdown = () => {
      if (this.wss) {
        this.wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.close();
        });
        this.wss.close();
      }
      for (const [key, connection] of this.activeUDPConnections.entries()) {
        try { connection.socket.close(); } catch (err) {}
      }
      this.activeUDPConnections.clear();
      if (this.httpServer) {
        this.httpServer.close(() => process.exit(0));
      }
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    server.listen(port, '0.0.0.0', () => console.log('AeroTunnel active on :' + port));
    this.httpServer = server;
  }
}

if (require.main === module) {
  new GatewayServer().start(process.env.PORT || 8080);
}