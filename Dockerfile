FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_OPTIONS="--max-old-space-size=64"

# Install Xray-core
RUN apk add --no-cache curl unzip && \
    curl -L https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o /tmp/xray.zip && \
    unzip -o /tmp/xray.zip -d /usr/local/bin/ xray && \
    rm /tmp/xray.zip && \
    apk del curl unzip

COPY xray-docker/config.json /etc/xray/config.json

WORKDIR /app
COPY package.json server.js /app/
COPY public /app/public
RUN npm install --production

EXPOSE 8080

CMD ["node", "server.js"]
