#!/bin/sh
set -eu

if [ -z "${DOMAIN:-}" ]; then
  echo "Environment variable DOMAIN must be provided." >&2
  exit 1
fi

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
FULLCHAIN="$CERT_DIR/fullchain.pem"
PRIVKEY="$CERT_DIR/privkey.pem"

if [ ! -f "$FULLCHAIN" ] || [ ! -f "$PRIVKEY" ]; then
  echo "Generating temporary self-signed certificate for $DOMAIN" >&2
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 \
    -days 1 \
    -keyout "$PRIVKEY" \
    -out "$FULLCHAIN" \
    -subj "/CN=$DOMAIN"
fi

envsubst '$DOMAIN' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
