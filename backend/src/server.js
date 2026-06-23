require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
// CORS manual sin dependencia externa
const path = require('path');
const fs = require('fs');
const os = require('os');
const { router: transcriptionRoutes } = require('./routes/transcription');
const ttsRoutes = require('./routes/tts');
const youtubeRoutes = require('./routes/youtube');
const azureBlobService = require('./services/azureBlobService');

const app = express();
app.use(morgan('dev')); // Logger para la consola
const PORT = process.env.PORT || 3001;

// Inicializar Azure Blob Storage
azureBlobService.inicializar().catch(err => {
  console.error('[Startup] No se pudo inicializar el almacenamiento temporal:', err.message);
});

// Validar entorno
if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  ADVERTENCIA: GROQ_API_KEY no está configurada en .env. El sistema requerirá que el cliente envíe su propia API Key.');
}
if (!process.env.ELEVENLABS_API_KEY) {
  console.warn('⚠️  ADVERTENCIA: ELEVENLABS_API_KEY no está configurada en .env. El TTS con ElevenLabs requerirá que el cliente envíe su propia API Key.');
}
if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  console.warn('⚠️  ADVERTENCIA: AZURE_STORAGE_CONNECTION_STRING no está configurada en .env. Se usará almacenamiento local temporal.');
}

// Configuración de CORS manual (para evitar problemas de preflight en Azure App Service)
const allowedOriginsString = process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = new Set(allowedOriginsString.split(',').map(s => s.trim()));

app.use((req, res, next) => {
  const origin = (req.headers.origin || "").trim().replace(/\/+$/, "");

  // Si no hay origen o no está en la lista (o es localhost/dev), permitimos por defecto en este ejemplo
  // para mayor seguridad en produccion se debe restringir estrictamente.
  if (origin && (allowedOrigins.has(origin) || origin.startsWith('http://localhost'))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Groq-Api-Key, X-Elevenlabs-Api-Key");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 horas
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/youtube', youtubeRoutes);

// Endpoint manual de limpieza para cron jobs (opcional)
app.post('/api/storage/cleanup', async (req, res) => {
  try {
    const eliminadosCargas = await azureBlobService.eliminarArchivosExpirados('cargas/');
    const eliminadosTemporales = await azureBlobService.eliminarArchivosExpirados('temporales/');
    res.json({ success: true, eliminados: eliminadosCargas + eliminadosTemporales });
  } catch (err) {
    res.status(500).json({ error: 'Error en limpieza de archivos', details: err.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  let azureConnected = false;
  const storage = azureBlobService.getStatus();
  try {
    if (azureBlobService.containerClient) {
      azureConnected = await azureBlobService.containerClient.exists();
    }
  } catch (e) {}

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    storage,
    azureBlobStorage: azureConnected ? 'connected' : 'disconnected'
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
  console.log(`📁  Directorio temporal del OS: ${os.tmpdir()}`);
  console.log(`💾  Almacenamiento temporal: ${azureBlobService.getStatus().mode}`);
  console.log(`🔑  API Key configurada: ${process.env.GROQ_API_KEY ? 'Sí' : 'NO - configura .env'}\n`);
});
