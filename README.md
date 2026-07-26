# 🚀 AeroTunnel

VPN tunnel gateway — **Xray-core** + **Node.js** proxy. Deploy on Railway.

## Architecture

```
Client → Railway:8080 → Node.js WSS → Xray (VLESS/VMess/Trojan WS) → Internet
```

- **Node.js** serves dashboard, proxies WebSocket to Xray
- **Xray-core** handles protocol encryption/decryption

## Paths

| Path | Protocol |
|------|----------|
| `/vless-aero` | VLESS WebSocket |
| `/vmess-aero` | VMess WebSocket |
| `/trojan-aero` | Trojan WebSocket |

## UUID

`f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c`

## Login

| Field | Value |
|-------|-------|
| Username | `aero` |
| Password | `aero` |

## Deployment

1. Fork repo to GitHub
2. Create Railway project → Deploy from GitHub
3. Set region to **Singapore**
4. Open generated domain → login → dashboard

## Dashboard

- Real-time stats: uptime, CPU, RAM, traffic
- Dark/light theme toggle
- Config generator: URI + QR code + full Clash YAML (with DNS, proxy-groups, rules)
- Expand/collapse YAML preview, Copy & Download buttons
- Responsive: compact mobile, full desktop

## Files

| File | Role |
|------|------|
| `server.js` | HTTP+WebSocket server, `/stats`, `/health`, WS proxy to Xray |
| `xray-docker/config.json` | Xray config (inbounds, fallbacks, DNS) |
| `public/dashboard.html` | Web dashboard with built-in login |
| `Dockerfile` | Build: install Xray, copy app, run |

## Client Config

### VLESS (WS)

| Field | Value |
|-------|-------|
| Address | your-domain.railway.app |
| Port | 443 |
| UUID | `f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c` |
| Encryption | `none` |
| Network | `ws` |
| Path | `/vless-aero` |
| TLS | `tls` |
| SNI | your-domain.railway.app |
| Fingerprint | `firefox` |

### VMess (WS)

| Field | Value |
|-------|-------|
| Address | your-domain.railway.app |
| Port | 443 |
| UUID | `f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c` |
| AlterID | `0` |
| Security | `auto` |
| Network | `ws` |
| Path | `/vmess-aero` |
| TLS | `tls` |
| SNI | your-domain.railway.app |
| Fingerprint | `firefox` |

### Trojan (WS)

| Field | Value |
|-------|-------|
| Address | your-domain.railway.app |
| Port | 443 |
| Password | `f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c` |
| Network | `ws` |
| Path | `/trojan-aero` |
| TLS | `tls` |
| SNI | your-domain.railway.app |
| Fingerprint | `firefox` |

---

*Premium tunneling backend — AeroTunnel*
