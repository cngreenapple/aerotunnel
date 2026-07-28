#!/bin/sh
set -e
xray -c /etc/xray/config.json &
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile