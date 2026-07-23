# 🚀 AEROTUNNEL

Tunnel backend WebSocket buat VLESS & Trojan, powered by **Xray-core**. Dashboard Web UI + Quick Generator. Deploy di Railway/Fly.io.

---

## ✨ Fitur

* **Xray-core Engine:** Native performance, support VLESS + Trojan.
* **Dashboard:** UI mac-style, monitor uptime & bandwidth real-time.
* **Quick Generator:** 1-click generate & copy URI VLESS/Trojan.
* **Auto-Port Binding:** Deteksi port dari cloud platform.

---

## 🏗 Arsitektur

```
Client VPN → :$PORT (Node.js) → /aerotunnel WS → Xray (internal :3001)
            → / → Dashboard HTML
            → /api/stats → Bandwidth API
```

Node.js jadi reverse proxy tipis + dashboard. Xray handle semua protocol logic.

---

## 🌍 Deployment (Railway)

1. Fork repositori ini ke GitHub.
2. **PENTING:** Ubah region Railway ke **Singapore (Asia)** sebelum deploy.
3. Buat proyek Railway → **New** → **GitHub Repo** → pilih repo ini.
4. Set deploy success → **Networking** → **Generate Domain**.
5. Buka domain → dashboard AeroTunnel muncul.

---

## 📱 Konfigurasi Klien VPN

### Quick Generator (Dashboard)
Buka dashboard, klik **Generate VLESS** / **Generate TROJAN**, copy.

### Manual

**VLESS (WS):**
| Field | Value |
|-------|-------|
| Address | domain Railway |
| Port | 443 |
| UUID | uuid-v4 bebas |
| Network | `ws` |
| Path | `/aerotunnel` |
| TLS | `tls` |
| SNI | domain Railway |

**Trojan (WS):**
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
* **Rotasi IP:** IP pool dinamis Railway/GCP.

---

*Premium tunneling backend — AeroTunnel*
