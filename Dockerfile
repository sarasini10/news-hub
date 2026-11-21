# Immagine base Node.js 22 (supporta nativamente node:sqlite)
FROM node:22-alpine

# Imposta directory di lavoro
WORKDIR /app

# Copia package.json
COPY package.json ./

# Copia i file del server e del frontend
COPY server/ ./server/
COPY public/ ./public/
COPY data/ ./data/

# Crea directory dati se non presente
RUN mkdir -p /app/data/backups

# Variabili d'ambiente predefinite
ENV PORT=3000
ENV NODE_ENV=production

# Esponi porta
EXPOSE 3000

# Volume persistente per conservare il database SQLite
VOLUME ["/app/data"]

# Comando di avvio dell'app
CMD ["node", "--experimental-sqlite", "server/app.js"]
