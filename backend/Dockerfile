FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
RUN mkdir -p /app/uploads && chown node:node /app/uploads

EXPOSE 5000

USER node

CMD ["node", "server.js"]