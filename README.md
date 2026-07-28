# 🚀 AeroTunnel

VPN tunnel gateway — **Xray-core** + **Caddy** reverse proxy. Deploy on Railway or self-host via Docker.

## Architecture

```
Client → Railway:8080 → Caddy → Xray (VLESS/VMess/Trojan XHTTP) → Internet
```

- **Caddy** serves dashboard (static), reverse proxy XHTTP ke Xray
- **Xray-core** handles protocol encryption/decryption

## Paths

| Path | Protocol |
|------|----------|
| `/vless-aero` | VLESS XHTTP |
| `/vmess-aero` | VMess XHTTP |
| `/trojan-aero` | Trojan XHTTP |

## UUID

`f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c`

## Login

| Field | Value |
|-------|-------|
| Username | `aero` |
| Password | `aero` |

## Deployment

### Railway

1. Fork repo to GitHub
2. Create Railway project → Deploy from GitHub
3. Set region to **Singapore**
4. Open generated domain → login → dashboard

### Docker (self-hosted)

```bash
docker pull ghcr.io/cngreenapple/aerotunnel:latest
docker run -d -p 8080:8080 --name aerotunnel ghcr.io/cngreenapple/aerotunnel:latest
```

Akses `http://localhost:8080`, login `aero:aero`.

### GitHub Actions (CI/CD)

Tiap push ke `main` otomatis build & push ke ghcr.io via [workflow](.github/workflows/docker-build.yml).

## Dashboard

- Dark/light theme toggle
- Config generator: URI + QR code + full Clash YAML (with DNS, proxy-groups, rules)
- Expand/collapse YAML preview, Copy & Download buttons

## Files

| File | Role |
|------|------|
| `xray-docker/config.json` | Xray config (inbounds, fallbacks, DNS) |
| `Caddyfile` | Caddy config: reverse proxy, healthcheck, static files |
| `start.sh` | Entrypoint: start Xray background + Caddy foreground |
| `public/index.html` | Web dashboard with built-in login |
| `Dockerfile` | Build: install Caddy + Xray on Alpine |

## Client Config

Semua config pake **H2 (HTTP/2)** — klien harus support H2/XHTTP.

### VLESS (XHTTP)

| Field | Value |
|-------|-------|
| Address | your-domain.railway.app |
| Port | 443 |
| UUID | `f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c` |
| Encryption | `none` |
| Network | `h2` |
| Path | `/vless-aero` |
| TLS | `tls` |
| SNI | your-domain.railway.app |
| Fingerprint | `firefox` |

### VMess (H2)

| Field | Value |
|-------|-------|
| Address | your-domain.railway.app |
| Port | 443 |
| UUID | `f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c` |
| AlterID | `0` |
| Security | `auto` |
| Network | `h2` |
| Path | `/vmess-aero` |
| TLS | `tls` |
| SNI | your-domain.railway.app |
| Fingerprint | `firefox` |

### Trojan (H2)

| Field | Value |
|-------|-------|
| Address | your-domain.railway.app |
| Port | 443 |
| Password | `f3b7c97d-4a53-4b54-a1d5-84d9df4fd91c` |
| Network | `h2` |
| Path | `/trojan-aero` |
| TLS | `tls` |
| SNI | your-domain.railway.app |
| Fingerprint | `firefox` |

---

*AeroTunnel — Premium Tunneling Backend*
