require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const transcriptionRoutes = require('./routes/transcription');
const ttsRoutes = require('./routes/tts');

const app = express();
const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
  console.log(`\n🎙️  Whisper Transcriber Backend`);
  console.log(`✅  Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁  Directorio temporal: ${tempDir}`);
  console.log(`🔑  API Key configurada: ${process.env.OPENAI_API_KEY ? 'Sí' : 'NO - configura .env'}\n`);
});

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
