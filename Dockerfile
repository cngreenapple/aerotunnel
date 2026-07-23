FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PORT=8080

# Install Xray-core
RUN apt-get update && apt-get install -y curl unzip ca-certificates && rm -rf /var/lib/apt/lists/*
ARG XRAY_VERSION=1.8.24
RUN curl -L https://github.com/XTLS/Xray-core/releases/download/v${XRAY_VERSION}/Xray-linux-64.zip -o /tmp/xray.zip \
    && unzip /tmp/xray.zip -d /usr/local/bin/ \
    && rm /tmp/xray.zip \
    && chmod +x /usr/local/bin/xray

COPY xray-docker/config.json /etc/xray/config.json

WORKDIR /app
COPY package.json server.js /app/
RUN npm install --production

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
