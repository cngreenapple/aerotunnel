package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var (
	rxBytes int64
	txBytes int64
	mu      sync.Mutex
	startAt = time.Now()
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	http.HandleFunc("/", handleDashboard)
	http.HandleFunc("/api/stats", handleStats)
	http.HandleFunc("/aerotunnel", handleWS)

	log.Printf("AeroTunnel Go — listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	rx, tx := rxBytes, txBytes
	mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"uptime":%.0f,"rx":%d,"tx":%d}`,
		time.Since(startAt).Seconds(), rx, tx)
}

func handleDashboard(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>AEROTUNNEL // SYSTEM STATUS</title><style>
:root{--bg:#000;--panel:#0a0a0a;--border:#1f1f1f;--text:#fff;--muted:#888;--accent:#0088FF;--green:#00df89}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:6vh 24px;-webkit-font-smoothing:antialiased}
.window{width:100%;max-width:640px;background:var(--panel);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.8)}
.head{background:#050505;border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
.brand{font-size:.8rem;font-weight:700;letter-spacing:3px;text-transform:uppercase}
.brand span{color:var(--accent)}
.badge{display:flex;align-items:center;gap:6px;font-size:.75rem;font-weight:600;color:var(--green);letter-spacing:.5px}
.dot{width:6px;height:6px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);animation:pulse 2.5s infinite}
.content{padding:32px}
.uptime{text-align:center;padding-bottom:32px;border-bottom:1px solid var(--border);margin-bottom:24px}
.label{font-size:.7rem;text-transform:uppercase;color:var(--muted);letter-spacing:2px;margin-bottom:8px}
.val{font-size:3rem;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px}
.card{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:20px;transition:border-color .2s}
.card:hover{border-color:#333}
.card .val{font-size:1.5rem;margin-top:4px}
.gen{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:20px}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
button{background:#111;color:#fff;border:1px solid var(--border);padding:12px;border-radius:6px;font-size:.85rem;font-weight:600;letter-spacing:1px;cursor:pointer;transition:all .2s}
button:hover{background:#222;border-color:#444}
.btn-vless:hover{border-color:var(--accent);color:var(--accent)}
.btn-trojan:hover{border-color:#ff0080;color:#ff0080}
.row{display:flex;gap:8px}
input[type=text]{flex:1;background:#050505;border:1px solid var(--border);color:var(--muted);padding:12px 16px;border-radius:6px;font-family:monospace;font-size:.8rem;outline:none}
input[type=text]:focus{border-color:#333;color:var(--text)}
.copy{background:var(--text);color:var(--bg);padding:0 20px;border:none}
.copy:hover{background:#e0e0e0}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
@media(max-width:540px){.content{padding:24px}.grid{grid-template-columns:1fr}.val{font-size:2.25rem}.row{flex-direction:column}.copy{padding:12px}}
</style></head><body><div class="window"><div class="head"><div class="brand">AERO<span>TUNNEL</span></div><div class="badge"><div class="dot"></div>RUNNING</div></div><div class="content"><div class="uptime"><div class="label">System Uptime</div><div class="val" id="u">00:00:00</div></div><div class="grid"><div class="card"><div class="label">Download (TX)</div><div class="val" id="d">0 B</div></div><div class="card"><div class="label">Upload (RX)</div><div class="val" id="r">0 B</div></div></div><div class="gen"><div class="label">Quick Generator</div><div class="btns"><button class="btn-vless" onclick="gen('vless')">VLESS</button><button class="btn-trojan" onclick="gen('trojan')">TROJAN</button></div><div class="row"><input type="text" id="o" readonly placeholder="Select protocol..." /><button class="copy" onclick="cp()">Copy</button></div></div></div></div><script>
function fmt(b){if(!b)return'0 B';const s=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(b)/Math.log(1024));return parseFloat((b/Math.pow(1024,i)).toFixed(2))+' '+s[i]}
function ft(s){const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),s2=Math.floor(s%60);return(d>0?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s2).padStart(2,'0')}
async function refresh(){try{const r=await fetch('/api/stats'),d=await r.json();document.getElementById('u').innerText=ft(d.uptime);document.getElementById('d').innerText=fmt(d.tx);document.getElementById('r').innerText=fmt(d.rx)}catch(e){}}
refresh();setInterval(refresh,1000);
function uuid(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c=='x'?r:r&3|8;return v.toString(16)})}
function gen(t){const h=location.hostname,u=uuid(),b=document.getElementById('o');if(t=='vless')b.value='vless://'+u+'@'+h+':443?encryption=none&security=tls&sni='+h+'&type=ws&host='+h+'&path=%2Faerotunnel#AEROTUNNEL-VLESS';else b.value='trojan://'+u+'@'+h+':443?security=tls&sni='+h+'&type=ws&host='+h+'&path=%2Faerotunnel#AEROTUNNEL-TROJAN'}
function cp(){const b=document.getElementById('o');if(!b.value)return;navigator.clipboard.writeText(b.value)}
</script></body></html>`))
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade: %v", err)
		return
	}
	defer conn.Close()

	var remote net.Conn
	var remoteMu sync.Mutex

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			remoteMu.Lock()
			if remote != nil {
				remote.Close()
			}
			remoteMu.Unlock()
			return
		}

		mu.Lock()
		rxBytes += int64(len(msg))
		mu.Unlock()

		remoteMu.Lock()
		if remote != nil {
			remote.Write(msg)
			remoteMu.Unlock()
			continue
		}
		remoteMu.Unlock()

		// Sniff protocol — simplified: check for trojan delimiter
		proto, header, err := sniff(msg)
		if err != nil {
			conn.WriteMessage(websocket.CloseMessage, []byte(err.Error()))
			return
		}

		if header.isUDP {
			go handleUDP(conn, header.address, header.port, msg[header.dataIdx:])
			continue
		}

		remoteMu.Lock()
		rc, err := net.Dial("tcp", net.JoinHostPort(header.address, fmt.Sprint(header.port)))
		if err != nil {
			remoteMu.Unlock()
			conn.Close()
			return
		}
		remote = rc
		rc.Write(msg)
		remoteMu.Unlock()
		go pipeBack(rc, conn, proto)
	}
}

func pipeBack(src net.Conn, dst *websocket.Conn, respHeader []byte) {
	buf := make([]byte, 32768)
	sent := false
	for {
		n, err := src.Read(buf)
		if err != nil {
			src.Close()
			return
		}
		mu.Lock()
		txBytes += int64(n)
		mu.Unlock()
		var data []byte
		if !sent && respHeader != nil {
			data = append(respHeader, buf[:n]...)
			sent = true
		} else {
			data = buf[:n]
		}
		if err := dst.WriteMessage(websocket.BinaryMessage, data); err != nil {
			src.Close()
			return
		}
	}
}

type headerInfo struct {
	address  string
	port     int
	isUDP    bool
	dataIdx  int
}

func sniff(buf []byte) ([]byte, *headerInfo, error) {
	if len(buf) < 62 {
		return nil, nil, fmt.Errorf("packet too short")
	}
	// Check trojan delimiter
	if buf[56] == 0x0d && buf[57] == 0x0a && (buf[58] == 0x01 || buf[58] == 0x03 || buf[58] == 0x7f) {
		return readTrojan(buf)
	}
	return readVless(buf)
}

func readTrojan(buf []byte) ([]byte, *headerInfo, error) {
	data := buf[58:]
	if len(data) < 6 {
		return nil, nil, fmt.Errorf("invalid trojan data")
	}
	isUDP := data[0] == 3
	if data[0] != 1 && data[0] != 3 {
		return nil, nil, fmt.Errorf("unsupported trojan cmd %d", data[0])
	}
	return parseAddrPort(data[1:], 1, isUDP, buf[:2])
}

func readVless(buf []byte) ([]byte, *headerInfo, error) {
	ver := buf[0]
	optLen := buf[17]
	cmd := buf[18+optLen]
	isUDP := cmd == 2
	if cmd != 1 && cmd != 2 {
		return nil, nil, fmt.Errorf("unsupported vless cmd %d", cmd)
	}
	idx := 18 + optLen + 1
	return parseAddrPort(buf[idx+2:], 2, isUDP, []byte{ver, 0})
}

func parseAddrPort(data []byte, addrOff int, isUDP bool, respHdr []byte) ([]byte, *headerInfo, error) {
	addrType := data[0]
	var addr string
	var skip int

	switch addrType {
	case 1: // IPv4
		if len(data) < 5 { return nil, nil, fmt.Errorf("short ipv4") }
		addr = net.IP(data[1:5]).String()
		skip = 5
	case 3: // IPv6
		if len(data) < 17 { return nil, nil, fmt.Errorf("short ipv6") }
		addr = net.IP(data[1:17]).String()
		skip = 17
	case 2: // Domain
		if len(data) < 2 { return nil, nil, fmt.Errorf("short domain") }
		dl := int(data[1])
		if len(data) < 2+dl { return nil, nil, fmt.Errorf("domain too short") }
		addr = string(data[2 : 2+dl])
		skip = 2 + dl
	default:
		return nil, nil, fmt.Errorf("unknown addr type %d", addrType)
	}

	if len(data) < skip+2 {
		return nil, nil, fmt.Errorf("missing port")
	}
	port := int(data[skip])<<8 | int(data[skip+1])

	return respHdr, &headerInfo{
		address: addr,
		port:    port,
		isUDP:   isUDP,
		dataIdx: skip + 2 + addrOff,
	}, nil
}

func handleUDP(ws *websocket.Conn, addr string, port int, payload []byte) {
	remote, err := net.Dial("udp", net.JoinHostPort(addr, fmt.Sprint(port)))
	if err != nil {
		return
	}
	defer remote.Close()

	remote.Write(payload)

	buf := make([]byte, 65507)
	n, err := remote.Read(buf)
	if err != nil {
		return
	}
	mu.Lock()
	txBytes += int64(n)
	mu.Unlock()

	ws.WriteMessage(websocket.BinaryMessage, buf[:n])
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
