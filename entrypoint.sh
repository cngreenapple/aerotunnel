#!/bin/bash

MAIN_PORT="${PORT:-8080}"

echo "[*] Memulai AeroTunnel di Port $MAIN_PORT..."
cd /app
exec node server.js