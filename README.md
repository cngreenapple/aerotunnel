# 🚀 AEROTUNNEL

Backend tunneling WebSocket ringan buat VLESS, Trojan & SSH. Jalan di platform serverless/PaaS (Railway, Fly.io, dll) tanpa root/kernel access.

**Satu container = AeroTunnel (VLESS/Trojan) + SSH (via Stunnel).**

---

## ✨ Fitur

* **Pure Node.js:** Tanpa core eksternal (Xray/v2ray).
* **Protokol Ganda:** VLESS + Trojan dalam 1 port.
* **SSH Tunnel:** SSH via Stunnel + TLS, port terpisah.
* **Dashboard:** UI mac-style, monitor uptime & bandwidth real-time.
* **Quick Generator:** 1-click generate & copy URI VLESS/Trojan.
* **Auto-Port Binding:** Deteksi port dari cloud platform.

---

## 🧱 Port Mapping

| Service | Port | Env |
|---------|------|-----|
| AeroTunnel (WS/HTTP) | `$PORT` (default 8080) | `PORT` |
| SSH via Stunnel | `$PORT_SSH` (default 2222) | `PORT_SSH` |

---

## 🌍 Deployment (Railway)

1. Fork repositori ini ke GitHub.
2. **PENTING:** Ubah region Railway ke **Singapore (Asia)** sebelum deploy.
3. Buat proyek Railway → **New** → **GitHub Repo** → pilih repo ini.
4. Set deploy success → **Networking** → **Generate Domain**.
5. Buka domain → dashboard AeroTunnel muncul.

---

## 📱 Konfigurasi Klien VPN

### Opsi 1: Quick Generator (Dashboard)
Buka dashboard, klik **Generate VLESS** / **Generate TROJAN**, copy.

### Opsi 2: Manual

**VLESS (WSS):**
| Field | Value |
|-------|-------|
| Address | domain Railway |
| Port | 443 |
| UUID | uuid-v4 bebas |
| Network | `ws` |
| Path | `/aerotunnel` |
| TLS | `tls` |
| SNI | domain Railway |

**Trojan (WSS):**
| Field | Value |
|-------|-------|
| Address | domain Railway |
| Port | 443 |
| Password | bebas |
| Network | `ws` |
| Path | `/aerotunnel` |
| TLS | `tls` |
| SNI | domain Railway |

---

## 🔐 SSH Tunnel

Container ini punya **2 cara** akses SSH:

### Opsi 1: Stunnel (Port terpisah)
SSH via Stunnel + TLS di `$PORT_SSH` (default 2222). **Catatan:** Railway cuma expose 1 port (`$PORT`), jadi cara ini cuma jalan di VPS atau platform yg buka multiple port.

```bash
ssh -o ProxyCommand='openssl s_client -connect HOST:PORT_SSH -quiet' user@localhost
```

### Opsi 2: WebSocket (1 port — recommended untuk Railway)
AeroTunnel proxy SSH lewat WebSocket di path `/ssh` — pake port yg sama (`$PORT`). Butuh client `websocat`:

```bash
# Install websocat dulu
# Connect: WS pipe ke SSH
websocat ws://HOST/ssh -- ssh user@localhost
```

Atau pake script `ssh-ws.sh`:
```bash
#!/bin/bash
# ssh-ws.sh <host> <port> <user>
websocat ws://$1:$2/ssh -- ssh $3@localhost
```

### Env Variables
| Variable | Default | Fungsi |
|----------|---------|--------|
| `SSH_USER` | `j1btnl` | Username SSH default |
| `SSH_PASSWORD` | `j1btnl` | Password SSH default |
| `PORT_SSH` | `2222` | Port Stunnel (SSH) |

### Management di Container
```bash
addssh <user> <pass> <hari>   # buat user SSH
delssh <user>                  # hapus user
listssh                        # daftar user & expired
```

---

## ⚠️ Catatan

* **Data Volatil:** Bandwidth tracker in-memory — reset pas container restart.
* **UDP Limit:** UDP over TCP native. Enable TUN Mode di client VPN.
* **Rotasi IP:** IP pool dinamis Railway/GCP.

---

## 🔀 Alternatif

### Go rewrite — `golang-tunnel/`
```bash
cd golang-tunnel && go run main.go
```

### sing-box — `sing-box/`
Config-based, support VLESS/Trojan/Shadowsocks native.

### Xray-core — `xray-docker/`
Docker, performa native.

---

*Premium tunneling backend — AeroTunnel*
