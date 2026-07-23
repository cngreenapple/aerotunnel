# 🚀 AEROTUNNEL

Backend tunneling WebSocket ringan buat VLESS, Trojan & SSH. Jalan di platform serverless/PaaS (Railway, Fly.io, dll) tanpa root/kernel access.

---

## ✨ Fitur

* **Pure Node.js:** Tanpa core eksternal (Xray/v2ray).
* **Protokol Ganda:** VLESS + Trojan dalam 1 port.
* **Dashboard:** UI mac-style, monitor uptime & bandwidth real-time.
* **Quick Generator:** 1-click generate & copy URI VLESS/Trojan.
* **Auto-Port Binding:** Deteksi port dari cloud platform.

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
