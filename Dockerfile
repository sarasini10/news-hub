# Immagine base Node.js 22
FROM node:22-alpine
WORKDIR /app
# Installa unzip per scompattare il progetto
RUN apk add --no-cache unzip
# Copia i file presenti nel repository
COPY . .
# Estrae automaticamente le cartelle server/ e public/ dallo zip gia presente su GitHub
RUN if [ -f "NEWS_HUB_PER_GITHUB.zip" ]; then unzip -o NEWS_HUB_PER_GITHUB.zip; fi
# Prepara la cartella dati SQLite
RUN mkdir -p /app/data/backups
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "--experimental-sqlite", "server/app.js"]
