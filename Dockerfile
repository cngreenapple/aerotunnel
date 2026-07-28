FROM alpine:3.20

ENV PORT=8080

# Install Caddy + Xray-core
RUN apk add --no-cache curl unzip && \
    curl -L https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o /tmp/xray.zip && \
    unzip -o /tmp/xray.zip -d /usr/local/bin/ xray && \
    rm /tmp/xray.zip && \
    curl -L "https://github.com/caddyserver/caddy/releases/latest/download/caddy_linux_amd64.tar.gz" -o /tmp/caddy.tar.gz && \
    tar xzf /tmp/caddy.tar.gz -C /usr/local/bin/ caddy && \
    rm /tmp/caddy.tar.gz && \
    apk del curl unzip

COPY xray-docker/config.json /etc/xray/config.json
COPY Caddyfile /etc/caddy/Caddyfile
COPY start.sh /start.sh

WORKDIR /app
COPY public /app/public

RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]
