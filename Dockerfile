# Immagine base Node.js 22
FROM node:22-alpine
WORKDIR /app
# Installa unzip per scompattare l'archivio del progetto
RUN apk add --no-cache unzip
# Copia i file presenti nel repository
COPY . .
# Estrae lo zip ignorando l'avviso di Windows (|| true)
RUN if [ -f "NEWS_HUB_PER_GITHUB.zip" ]; then unzip -o NEWS_HUB_PER_GITHUB.zip || true; fi
# Prepara la cartella dati SQLite e backup
RUN mkdir -p /app/data/backups
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "--experimental-sqlite", "server/app.js"]
