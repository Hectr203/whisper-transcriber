FROM node:22-alpine

# Instalar ffmpeg (necesario para dividir archivos de audio grandes)
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Crear directorios para archivos temporales
RUN mkdir -p uploads temp

EXPOSE 3001

CMD ["node", "src/server.js"]
