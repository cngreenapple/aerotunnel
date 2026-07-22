#!/bin/bash

# Mengambil environment variables atau menggunakan nilai default
USER_NAME="${SSH_USER:-j1btnl}"
USER_PASS="${SSH_PASSWORD:-j1btnl}"
MAIN_PORT="${PORT:-8080}"
SSH_SSL_PORT="${PORT_SSH:-2222}"

echo "[*] Mengatur Timezone ke Asia/Jakarta (WIB)..."
ln -fs /usr/share/zoneinfo/Asia/Jakarta /etc/localtime
dpkg-reconfigure --frontend noninteractive tzdata &>/dev/null

echo "[*] Mengonfigurasi Server Message (Banner Pra-Login)..."
cat << 'EOF' > /etc/issue.net
<p align="center">
<font color="#FF00A0">❖═════════════════════════════════❖</font><br>
<font color="#00FFFF"><b>✦ WELCOME TO JIBSZZ SERVER ✦</b></font><br>
<font color="#FF00A0">❖═════════════════════════════════❖</font><br>
<font color="#FFFF00"><b>⚙️ SERVER TERMS OF SERVICE ⚙️</b></font><br>
<br>
<font color="#FF3333"><b>⚠️ STRICTLY PROHIBITED ⚠️</b></font><br>
<font color="#FFFFFF">❌ NO SPAM / HACKING / CARDING</font><br>
<font color="#FFFFFF">❌ NO DDOS & TORRENTING</font><br>
<br>
<font color="#00FF00"><b>ℹ️ SERVER NOTICES ℹ️</b></font><br>
<font color="#00FFFF">⚡ High Speed Connection ⚡</font><br>
<br>
<font color="#FF00A0">❖═════════════════════════════════❖</font><br>
<font color="#FFFF00"><b>§ ENJOY YOUR SSH ACCOUNT §</b></font><br>
<font color="#FF00A0">❖═════════════════════════════════❖</font>
</p>
EOF

echo "Banner /etc/issue.net" >> /etc/ssh/sshd_config
sed -i 's/PrintMotd no/PrintMotd yes/g' /etc/ssh/sshd_config
rm -f /etc/update-motd.d/*
cp /etc/issue.net /etc/motd

echo "[*] Mengonfigurasi Respon Server (Pasca-Login)..."
cat << 'EOF' > /etc/profile.d/99-respon-server.sh
#!/bin/bash
clear
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;32m       [✓] BERHASIL TERHUBUNG KE SERVER!         \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;37m Username     : \e[1;33m$USER\e[0m"
echo -e "\e[1;37m Waktu Server : \e[1;33m$(date)\e[0m"
echo -e "\e[1;37m OS           : \e[1;33mUbuntu 22.04 LTS\e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;31m   TETAP PATUHI RULES SERVER AGAR TIDAK BANNED   \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
EOF
chmod +x /etc/profile.d/99-respon-server.sh

echo "[*] Membuat Menu Manajemen SSH (addssh, delssh, listssh)..."

# 1. Command: addssh (Dengan Expired Date)
cat << 'EOF' > /usr/local/bin/addssh
#!/bin/bash
if [ $# -lt 3 ]; then
    echo -e "\e[1;31m[!] Penggunaan: addssh <username> <password> <hari>\e[0m"
    echo -e "\e[1;33m    Contoh    : addssh joko 12345 30\e[0m"
    exit 1
fi
if id "$1" &>/dev/null; then
    echo -e "\e[1;33m[!] User $1 sudah ada!\e[0m"
    exit 1
fi
# Menghitung tanggal expired
EXPDATE=$(date -d "+$3 days" +"%Y-%m-%d")
# Membuat user dengan parameter expired (-e)
useradd -e "$EXPDATE" -m -s /bin/bash "$1"
echo "$1:$2" | chpasswd
echo -e "\e[1;36m--------------------------------------\e[0m"
echo -e "\e[1;32m       [✓] USER SSH DIBUAT!           \e[0m"
echo -e "\e[1;36m--------------------------------------\e[0m"
echo -e " Username   : \e[1;33m$1\e[0m"
echo -e " Password   : \e[1;33m$2\e[0m"
echo -e " Masa Aktif : \e[1;33m$3 Hari\e[0m"
echo -e " Expired On : \e[1;31m$EXPDATE\e[0m"
echo -e "\e[1;36m--------------------------------------\e[0m"
EOF
chmod +x /usr/local/bin/addssh

# 2. Command: delssh (Tetap sama)
cat << 'EOF' > /usr/local/bin/delssh
#!/bin/bash
if [ $# -lt 1 ]; then
    echo -e "\e[1;31m[!] Penggunaan: delssh <username>\e[0m"
    exit 1
fi
if ! id "$1" &>/dev/null; then
    echo -e "\e[1;33m[!] User $1 tidak ditemukan!\e[0m"
    exit 1
fi
userdel -f -r "$1"
echo -e "\e[1;32m[✓] User $1 berhasil dihapus beserta datanya!\e[0m"
EOF
chmod +x /usr/local/bin/delssh

# 3. Command: listssh (Sekarang menampilkan expired date)
cat << 'EOF' > /usr/local/bin/listssh
#!/bin/bash
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;32m            DAFTAR USER SSH & EXPIRED            \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
printf "\e[1;33m %-15s | %-20s \e[0m\n" "USERNAME" "EXPIRED DATE"
echo -e "\e[1;36m-------------------------------------------------\e[0m"
for user in $(awk -F: '$3 >= 1000 && $1 != "nobody" {print $1}' /etc/passwd); do
    # Mengambil data expired dari chage
    exp_info=$(chage -l "$user" | grep "Account expires")
    exp_date=$(echo "$exp_info" | awk -F': ' '{print $2}')
    printf " 👤 %-12s | \e[1;31m%-20s\e[0m \n" "$user" "$exp_date"
done
echo -e "\e[1;36m=================================================\e[0m"
EOF
chmod +x /usr/local/bin/listssh

echo "[*] Mengonfigurasi Default User SSH..."
if ! id "$USER_NAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USER_NAME"
    usermod -aG sudo "$USER_NAME"
fi
echo "$USER_NAME:$USER_PASS" | chpasswd

echo "[*] Memulai OpenSSH Server di Port 22..."
/usr/sbin/sshd

echo "[*] Membuat konfigurasi Stunnel di Port $SSH_SSL_PORT..."
cat <<EOF > /etc/stunnel/stunnel.conf
pid = /var/run/stunnel.pid
debug = 4

[ssh-ssl]
accept = 0.0.0.0:$SSH_SSL_PORT
connect = 127.0.0.1:22
cert = /etc/stunnel/stunnel.pem
EOF

echo "[*] Memulai Stunnel..."
stunnel /etc/stunnel/stunnel.conf

echo "[*] Memulai AeroTunnel di Port $MAIN_PORT..."
cd /app
exec node server.js