const express = require('express');
const router = express.Router();
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const youtubeService = require('../services/youtubeService');
const azureBlobService = require('../services/azureBlobService');
const { processTranscription, activeJobs } = require('./transcription');

/**
 * POST /api/youtube/analyze
 * Analiza una URL de YouTube (video o playlist)
 */
router.post('/analyze', async (req, res) => {
  try {
    const { url, forceType } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Debes proporcionar una URL válida de YouTube.' });
    }

    const info = await youtubeService.analyzeUrl(url, forceType);
    res.json(info);
  } catch (error) {
    console.error('[Route YouTube Analyze] Error:', error.message);
    res.status(500).json({ error: error.message || 'Error al analizar la URL de YouTube.' });
  }
});

/**
 * GET /api/youtube/download
 * Inicia la descarga en streaming de un video o audio
 */
router.get('/download', async (req, res) => {
  try {
    const { url, format, itag } = req.query; // format = 'video' o 'audio'
    if (!url) {
      return res.status(400).send('URL requerida.');
    }

    await youtubeService.streamDownload(url, format, itag, res);
  } catch (error) {
    console.error('[Route YouTube Download] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).send(error.message || 'Error al descargar de YouTube.');
    }
  }
});

/**
 * POST /api/youtube/transcribe
 * Descarga el audio temporalmente y reutiliza la lógica de transcripción
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Debes proporcionar una URL de YouTube.' });
    }

    // Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const jobId = uuidv4();
    activeJobs.set(jobId, { res, cancelled: false });

    const sendEvent = (event, data) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    const cleanupLocal = (filePath) => {
      try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    };

    sendEvent('status', {
      stage: 'downloading',
      message: 'Descargando audio desde YouTube...',
      progress: 2,
    });

    // 1. Descargar audio de YT
    const localFilePath = await youtubeService.downloadAudioToLocal(url, jobId);
    const fileSize = fs.statSync(localFilePath).size;
    const originalName = `youtube_audio_${jobId}.mp3`;

    // 2. Guardar audio descargado en almacenamiento temporal
    const originalBlobPath = `cargas/${jobId}/${originalName}`;
    await azureBlobService.subirArchivo(localFilePath, originalBlobPath, {
      mimetype: 'audio/mpeg',
      jobId: jobId
    });

    // 3. Ejecutar el flujo de transcripción original
    processTranscription({
      localFilePath,
      originalBlobPath,
      originalName,
      fileSize,
      jobId,
      apiKey: req.headers['x-groq-api-key'],
      sendEvent,
      cleanupLocal,
      getJob: () => activeJobs.get(jobId),
    }).catch(async (error) => {
      console.error('[Route YouTube Transcribe] Error:', error.message);
      sendEvent('error', {
        message: error.message || 'Error en la transcripción de YouTube',
        code: error.code || 'TRANSCRIPTION_ERROR',
      });
      cleanupLocal(localFilePath);
      await azureBlobService.eliminarPorPrefijo(`cargas/${jobId}/`).catch(()=>{});
      await azureBlobService.eliminarPorPrefijo(`temporales/${jobId}/`).catch(()=>{});
      activeJobs.delete(jobId);
      if (!res.writableEnded) res.end();
    });

    // Detectar desconexión
    req.on('close', () => {
      const job = activeJobs.get(jobId);
      if (job) job.cancelled = true;
    });

  } catch (error) {
    console.error('[Route YouTube Transcribe] Error general:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Error interno del servidor.' });
    }
  }
});

module.exports = router;
