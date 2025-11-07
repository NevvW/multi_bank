#!/bin/sh
set -eu

if [ -z "${LETSENCRYPT_DOMAIN:-}" ] || [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
  echo "LETSENCRYPT_DOMAIN and LETSENCRYPT_EMAIL environment variables are required." >&2
  exit 1
fi

STAGING_FLAG=
if [ "${LETSENCRYPT_STAGING:-0}" = "1" ]; then
  STAGING_FLAG="--staging"
fi

mkdir -p /var/www/certbot
CERT_DIR="/etc/letsencrypt/live/$LETSENCRYPT_DOMAIN"

issue_certificate() {
  # Remove dummy certificates to avoid conflicts
  if [ -d "$CERT_DIR" ] && [ ! -L "$CERT_DIR/fullchain.pem" ]; then
    rm -rf "$CERT_DIR"
  fi

  certbot certonly \
    --webroot -w /var/www/certbot \
    --domain "$LETSENCRYPT_DOMAIN" \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    $STAGING_FLAG
}

if [ ! -d "$CERT_DIR" ] || [ ! -L "$CERT_DIR/fullchain.pem" ]; then
  echo "No valid certificate found for $LETSENCRYPT_DOMAIN. Requesting a new one..."
  until issue_certificate; do
    echo "Certificate request failed. Retrying in 30 seconds..."
    sleep 30
  done
fi

while :; do
  certbot renew --webroot -w /var/www/certbot --quiet $STAGING_FLAG
  sleep "${RENEW_INTERVAL:-12h}"
done
