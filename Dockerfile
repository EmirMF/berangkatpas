FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY openapi.yaml ./openapi.yaml
COPY scripts ./scripts
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/berangkatpas.db
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
