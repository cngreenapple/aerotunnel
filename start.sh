#!/bin/sh
set -e

# Start Xray di background
xray -c /etc/xray/config.json &

# Start Caddy di foreground
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
