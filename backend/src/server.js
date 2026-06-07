require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const transcriptionRoutes = require('./routes/transcription');
const ttsRoutes = require('./routes/tts');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

const net = require('net');

async function findFreePort(startPort, attempts = 10) {
  let port = startPort;
  for (let i = 0; i < attempts; i++) {
    /* eslint-disable no-await-in-loop */
    const isFree = await new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => { resolve(false); })
        .once('listening', () => {
          tester.close(() => resolve(true));
        }).listen(port);
    });
    if (isFree) return port;
    port += 1;
  }
  throw new Error(`No free port found starting at ${startPort}`);
}

// Asegurar que los directorios temporales existan
const tempDir = path.resolve(process.env.TEMP_DIR || './src/temp');
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || './src/uploads');
[tempDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/tts', ttsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Archivo demasiado grande',
      message: `El archivo supera el límite de ${process.env.MAX_FILE_SIZE_MB || 1024} MB`,
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Campo de archivo inesperado',
      message: 'Usa el campo "audio" para subir el archivo',
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    message: 'Ocurrió un error inesperado. Intenta de nuevo.',
  });
});

// Encontrar puerto libre y arrancar servidor
(async () => {
  try {
    const usePort = await findFreePort(PORT, 20);
    const server = app.listen(usePort, () => {
      console.log(`\n🎙️  Whisper Transcriber Backend`);
      console.log(`✅  Servidor corriendo en http://localhost:${usePort}`);
      console.log(`📁  Directorio temporal: ${tempDir}`);
      console.log(`🔑  API Key configurada: ${process.env.GROQ_API_KEY ? 'Sí' : 'NO - configura .env'}\n`);
      if (usePort !== PORT) console.warn(`Puerto ${PORT} estaba en uso - usando ${usePort} en su lugar.`);
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('No se pudo encontrar un puerto libre:', err.message || err);
    process.exit(1);
  }
})();

// Limpiar archivos temporales al cerrar
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

function cleanup() {
  console.log('\n🧹 Limpiando archivos temporales...');
  [tempDir, uploadsDir].forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      try { fs.unlinkSync(path.join(dir, file)); } catch (_) {}
    });
  });
  process.exit(0);
}
