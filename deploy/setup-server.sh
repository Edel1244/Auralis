#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AURALIS one-time server setup (Ubuntu 22.04 / 24.04, run from the repo root):
#
#   sudo bash deploy/setup-server.sh
#
# Installs Docker + Compose (Ubuntu packages), adds swap on small servers,
# configures the firewall, writes a .env with freshly generated secrets,
# starts AURALIS behind Caddy (automatic HTTPS) and schedules daily backups.
# Safe to re-run: an existing .env is kept.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo:  sudo bash deploy/setup-server.sh" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)

echo "==> Installing Docker, Compose, firewall and tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y docker.io docker-compose-v2 ufw openssl cron curl git
systemctl enable --now docker
systemctl enable --now cron

# Building the image needs ~2 GB of memory; add swap on small servers.
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$MEM_MB" -lt 3500 ] && ! swapon --show | grep -q .; then
  echo "==> Adding 2 GB swap (server has ${MEM_MB} MB RAM)"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Configuring firewall (SSH, HTTP, HTTPS only)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }
set_env() {
  # set_env KEY VALUE: replace the line if present, otherwise append.
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

if [ ! -f .env ]; then
  echo "==> Creating .env"
  read -rp "Domain for AURALIS (e.g. auralis.example.com): " DOMAIN
  read -rp "Your email (admin account + certificate notices): " EMAIL
  DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"
  cp .env.example .env
  set_env APP_URL "https://${DOMAIN}"
  set_env AURALIS_DOMAIN "$DOMAIN"
  set_env ACME_EMAIL "$EMAIL"
  set_env BOOTSTRAP_ADMIN_EMAIL "$EMAIL"
  set_env POSTGRES_PASSWORD "$(secret)"
  set_env AUTH_SECRET "$(secret)$(secret)"
  set_env REQUIRE_VERIFIED_EMAIL_FOR_UPLOAD "true"
  chmod 600 .env
else
  echo "==> Keeping existing .env"
fi

# shellcheck disable=SC1091
DOMAIN=$(grep '^AURALIS_DOMAIN=' .env | cut -d= -f2-)
if [ -z "$DOMAIN" ]; then
  echo "AURALIS_DOMAIN is empty in .env" >&2
  exit 1
fi

PUBLIC_IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
RESOLVED=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
if [ -n "$RESOLVED" ] && [ "$RESOLVED" != "$PUBLIC_IP" ]; then
  echo "WARNING: $DOMAIN resolves to $RESOLVED but this server is $PUBLIC_IP."
  echo "         HTTPS certificates will fail until the DNS A record points here."
elif [ -z "$RESOLVED" ]; then
  echo "WARNING: $DOMAIN does not resolve yet. Add a DNS A record -> $PUBLIC_IP"
fi

echo "==> Building and starting AURALIS (first build takes a few minutes)"
"${COMPOSE[@]}" up -d --build

echo "==> Scheduling daily backups (03:30, kept 14 days)"
CRON_LINE="30 3 * * * cd $REPO_DIR && KEEP_DAYS=14 ./scripts/backup.sh >> /var/log/auralis-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'scripts/backup.sh' ; echo "$CRON_LINE" ) | crontab -
chmod +x scripts/backup.sh deploy/update.sh

ADMIN=$(grep '^BOOTSTRAP_ADMIN_EMAIL=' .env | cut -d= -f2-)
cat <<EOF

✅ AURALIS is starting at https://${DOMAIN}

Next steps:
  1. Open https://${DOMAIN} and sign up with ${ADMIN:-your email}.
  2. Verify that email. Without SMTP configured, get the link with:
       ${COMPOSE[*]} logs app | grep verify-email
     After verifying, that account becomes the administrator.
  3. Configure SMTP_URL in .env so users receive emails, then run: sudo bash deploy/update.sh
  4. Copy the ./backups folder off this server regularly.

Status:   ${COMPOSE[*]} ps
Logs:     ${COMPOSE[*]} logs -f app
Update:   sudo bash deploy/update.sh
EOF
