FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app
COPY package.json server.js /app/
RUN npm install --production

EXPOSE 8080

CMD ["node", "server.js"]
