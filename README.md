# 🚀 AEROTUNNEL

Tunnel backend WebSocket buat **VMess**, **VLESS**, **Trojan**, **Shadowsocks** — pure Node.js. Dashboard Web UI + Quick Generator. Deploy di Railway.

---

## ✨ Fitur

* **Pure Node.js:** Tanpa Xray/v2ray atau dependensi OS.
* **Protocol Sniffer:** Auto-detect VMess (AEAD), VLESS, Trojan, Shadowsocks.
* **Proxy Routing:** Pilih proxy via path — `/ID`, `/SG`, `/ALL`, `/IP:PORT`.
* **Dashboard:** UI mac-style, monitor uptime.
* **Quick Generator:** 1-click generate & copy URI.

---

## 🏗 Arsitektur

```
Client VPN → :$PORT (Node.js) → sniff protocol → TCP ke proxy tujuan
            → / → Dashboard HTML
            → /docs → Dokumentasi path
```

---

## 🌍 Deployment (Railway)

1. Fork repositori ini ke GitHub.
2. **PENTING:** Ubah region Railway ke **Singapore (Asia)** sebelum deploy.
3. Buat proyek Railway → **New** → **GitHub Repo** → pilih repo ini.
4. Set deploy success → **Networking** → **Generate Domain**.
5. Buka domain → dashboard AeroTunnel muncul.

---

## 📱 Konfigurasi Klien VPN

### WebSocket Path
Path menentukan proxy tujuan:

| Path | Contoh | Keterangan |
|------|--------|------------|
| `/aerotunnel/ID` | `/ID` | Random proxy Indonesia |
| `/aerotunnel/SG` | `/SG` | Random proxy Singapore |
| `/aerotunnel/ALL` | `/ALL` | Random proxy global |
| `/aerotunnel/IP:PORT` | `/103.6.207.108:8080` | Proxy langsung IP:port |

### Quick Generator (Dashboard)
Buka dashboard, klik **Generate VLESS** / **Generate TROJAN** / **Generate VMESS**, copy.

### Manual

**VMess (WS):**
| Field | Value |
|-------|-------|
| Address | domain Railway |
| Port | 443 |
| UUID | `3b01a777-55e7-49f6-8637-d94ee69607c6` |
| Security | `auto` |
| Network | `ws` |
| Path | `/aerotunnel/ID` |
| TLS | `tls` |
| SNI | domain Railway |

**VLESS (WS):**
| Field | Value |
|-------|-------|
| Address | domain Railway |
| Port | 443 |
| UUID | `3b01a777-55e7-49f6-8637-d94ee69607c6` |
| Encryption | `none` |
| Network | `ws` |
| Path | `/aerotunnel/ID` |
| TLS | `tls` |
| SNI | domain Railway |

**Trojan (WS):**
| Field | Value |
|-------|-------|
| Address | domain Railway |
| Port | 443 |
| Password | bebas |
| Network | `ws` |
| Path | `/aerotunnel/ID` |
| TLS | `tls` |
| SNI | domain Railway |

**Shadowsocks (WS):**
| Field | Value |
|-------|-------|
| Address | domain Railway |
| Port | 443 |
| Password | bebas |
| Method | `chacha20-ietf-poly1305` |
| Network | `ws` |
| Path | `/aerotunnel/ID` |
| TLS | `tls` |

---

## ⚠️ Catatan

* **VMess UUID fixed:** `3b01a777-55e7-49f6-8637-d94ee69607c6` — ganti di `server.js` baris `vmessUUID` kalau mau custom.
* **Proxy list:** Dari `FoolVPN-ID/Nautica` — ganti `PROXY_LIST_URL` di `server.js` kalau mau source lain.
* **Data Volatil:** Bandwidth tracker in-memory — reset pas container restart.
* **Rotasi IP:** IP pool dinamis Railway/GCP.

---

*Premium tunneling backend — AeroTunnel*
