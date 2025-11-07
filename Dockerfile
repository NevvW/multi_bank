# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.25-alpine

RUN apk add --no-cache gettext openssl

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx template
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/entrypoint.sh /docker-entrypoint.sh

# Prepare directory for certbot challenges
RUN mkdir -p /var/www/certbot \
    && chmod +x /docker-entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
