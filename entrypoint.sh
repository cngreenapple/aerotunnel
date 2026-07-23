#!/bin/bash

MAIN_PORT="${PORT:-8080}"

UUID="${UUID:-$(cat /proc/sys/kernel/random/uuid)}"
PASSWORD="${PASSWORD:-$(openssl rand -hex 16)}"

sed -i "s/replace-with-uuid/$UUID/g; s/replace-your-password/$PASSWORD/g" /etc/xray/config.json

echo "[*] UUID: $UUID"
echo "[*] Password: $PASSWORD"
echo "[*] Memulai Xray-core..."
xray -c /etc/xray/config.json &
sleep 1

echo "[*] Memulai AeroTunnel di Port $MAIN_PORT..."
cd /app
exec node server.js