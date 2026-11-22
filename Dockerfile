FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server/ ./server/
COPY public/ ./public/
RUN mkdir -p /app/data/backups
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "--experimental-sqlite", "server/app.js"]
