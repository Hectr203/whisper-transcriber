require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const transcriptionRoutes = require('./routes/transcription');
const ttsRoutes = require('./routes/tts');
const azureBlobService = require('./services/azureBlobService');

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar Azure Blob Storage
azureBlobService.inicializar().catch(err => {
  console.error('[Startup] No se pudo inicializar Azure Blob Storage. ¿Están las credenciales en .env?', err.message);
});

// Validar entorno
if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  ADVERTENCIA: GROQ_API_KEY no está configurada en .env. El sistema requerirá que el cliente envíe su propia API Key.');
}
if (!process.env.ELEVENLABS_API_KEY) {
  console.warn('⚠️  ADVERTENCIA: ELEVENLABS_API_KEY no está configurada en .env. El TTS con ElevenLabs requerirá que el cliente envíe su propia API Key.');
}
if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  console.warn('⚠️  ADVERTENCIA: AZURE_STORAGE_CONNECTION_STRING no está configurada en .env. El almacenamiento de archivos fallará.');
}

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Groq-Api-Key', 'X-Elevenlabs-Api-Key'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/tts', ttsRoutes);

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
  try {
    if (azureBlobService.containerClient) {
      azureConnected = await azureBlobService.containerClient.exists();
    }
  } catch (e) {}

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
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
  console.log(`🔑  API Key configurada: ${process.env.GROQ_API_KEY ? 'Sí' : 'NO - configura .env'}\n`);
});
