#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "This script must be run as root. Try again with sudo." >&2
  exit 1
fi

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <your-domain> <email-for-letsencrypt>" >&2
  exit 1
fi

log() {
  echo "[setup-nginx-ssl] $1"
}

log "Updating APT repositories and packages…"
apt update -y >/dev/null
apt upgrade -y >/dev/null

log "Installing Nginx, Certbot and required dependencies…"
apt install -y nginx certbot python3-certbot-nginx ufw >/dev/null

log "Configuring UFW firewall rules…"
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
if ufw status | grep -q "inactive"; then
  ufw --force enable >/dev/null
  log "UFW enabled."
else
  log "UFW already enabled."
fi

NGINX_CONF="/etc/nginx/sites-available/osrm-proxy.conf"
NGINX_LINK="/etc/nginx/sites-enabled/osrm-proxy.conf"

log "Creating Nginx reverse proxy configuration…"

cat <<NGINXCONF > "$NGINX_CONF"
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    # SSL settings will be managed by Certbot

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "keep-alive";
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header X-Forwarded-Host \$host;
    }
}
NGINXCONF

if [[ -f /etc/nginx/sites-enabled/default ]]; then
  log "Disabling default Nginx site…"
  rm -f /etc/nginx/sites-enabled/default
fi

ln -sf "$NGINX_CONF" "$NGINX_LINK"

log "Testing Nginx configuration…"
nginx -t

log "Reloading Nginx…"
systemctl enable nginx >/dev/null
systemctl restart nginx

log "Requesting Let's Encrypt certificate for ${DOMAIN}…"
certbot --nginx --non-interactive --agree-tos --email "$EMAIL" --redirect -d "$DOMAIN"

log "Enabling automatic certificate renewal…"
systemctl enable certbot.timer >/dev/null
systemctl start certbot.timer >/dev/null

log "Restarting Nginx to load new certificate…"
systemctl restart nginx

cat <<MESSAGE
✅ Instalación completada. Tu OSRM ya está disponible en:
https://${DOMAIN}/route/v1/driving
MESSAGE
