FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PORT=8080

# Install Xray-core
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/* && curl -L https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o /tmp/xray.zip && unzip -o /tmp/xray.zip -d /usr/local/bin/ xray && rm /tmp/xray.zip

COPY xray-docker/config.json /etc/xray/config.json

WORKDIR /app
COPY package.json server.js /app/
COPY public /app/public
RUN npm install --production

EXPOSE 8080

CMD ["node", "server.js"]
