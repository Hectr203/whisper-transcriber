const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { upload } = require('../middleware/uploadMiddleware');
const { splitAudio, cleanupChunks, extractAudioIfVideo, analyzeMedia } = require('../services/audioSplitter');
const { transcribeChunks } = require('../services/whisperService');

// Map para gestionar conexiones SSE activas
const activeJobs = new Map();

/**
 * POST /api/transcription/upload
 * Recibe el archivo, lo procesa y devuelve la transcripción vía SSE
 */
router.post('/upload', (req, res, next) => {
  // Multer con manejo de errores explícito
  upload.single('audio')(req, res, (err) => {
    if (err) return next(err);

    if (!req.file) {
      return res.status(400).json({
        error: 'No se recibió archivo',
        message: 'Envía un archivo de audio en el campo "audio"',
      });
    }

    // Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffer en nginx
    res.flushHeaders();

    const jobId = req.file.filename;
    activeJobs.set(jobId, { res, cancelled: false });

    const sendEvent = (event, data) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    const cleanup = (filePath, chunkPaths = [], extractedAudioPath = null) => {
      cleanupChunks(chunkPaths, extractedAudioPath || filePath);
      // Eliminar el archivo de audio extraído temporal si existe
      try {
        if (extractedAudioPath && fs.existsSync(extractedAudioPath)) fs.unlinkSync(extractedAudioPath);
      } catch (_) {}
      // Eliminar el archivo original subido
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
      // Eliminar el archivo original subido
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
      activeJobs.delete(jobId);
    };

    // Procesar en background para no bloquear
    processTranscription({
      filePath: req.file.path,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      jobId,
      sendEvent,
      cleanup,
      getJob: () => activeJobs.get(jobId),
    }).catch((error) => {
      console.error('[Route] Error en transcripción:', error.message);
      sendEvent('error', {
        message: formatErrorMessage(error),
        code: error.code || 'TRANSCRIPTION_ERROR',
      });
      cleanup(req.file.path);
      if (!res.writableEnded) res.end();
    });

    // Detectar desconexión del cliente
    req.on('close', () => {
      const job = activeJobs.get(jobId);
      if (job) job.cancelled = true;
      console.log(`[Route] Cliente desconectado: ${jobId}`);
    });
  });
});

async function processTranscription({ filePath, originalName, fileSize, jobId, sendEvent, cleanup, getJob }) {
  let chunkPaths = [];
  let audioToProcess = filePath;
  let isVideo = false;
  let originalDuration = 0;

  try {
    sendEvent('status', {
      stage: 'analyzing',
      message: 'Analizando archivo multimedia...',
      progress: 5,
    });

    const mediaInfo = await analyzeMedia(filePath);
    isVideo = mediaInfo.hasVideo;
    originalDuration = mediaInfo.duration;

    if (isVideo) {
      sendEvent('status', {
        stage: 'extracting',
        message: 'Extrayendo audio del video...',
        progress: 8,
      });
      audioToProcess = await extractAudioIfVideo(filePath);
    }

    const actualFileSizeMB = fs.statSync(audioToProcess).size / (1024 * 1024);
    console.log(`[Process] Iniciando: ${originalName} (Original: ${(fileSize / (1024*1024)).toFixed(1)}MB, A procesar: ${actualFileSizeMB.toFixed(1)}MB)`);

    // Verificar cancelación
    if (getJob()?.cancelled) throw new Error('Trabajo cancelado por el cliente');

    sendEvent('status', {
      stage: 'splitting',
      message: actualFileSizeMB > 24
        ? `Audio grande (${actualFileSizeMB.toFixed(0)}MB), dividiendo en segmentos...`
        : 'Preparando transcripción...',
      progress: 10,
    });

    // Dividir si es necesario
    chunkPaths = await splitAudio(audioToProcess, (current, total, stage) => {
      if (getJob()?.cancelled) return;
      sendEvent('status', {
        stage: 'splitting',
        message: `Procesando segmento ${current} de ${total}...`,
        progress: Math.round(10 + (current / total) * 20),
        current,
        total,
      });
    });

    if (getJob()?.cancelled) throw new Error('Trabajo cancelado por el cliente');

    const totalChunks = chunkPaths.length;
    sendEvent('status', {
      stage: 'transcribing',
      message: totalChunks > 1
        ? `Transcribiendo ${totalChunks} segmentos con Whisper...`
        : 'Transcribiendo con Whisper AI...',
      progress: 30,
      totalChunks,
    });

    // Transcribir
    const transcription = await transcribeChunks(
      chunkPaths,
      (current, total) => {
        if (getJob()?.cancelled) return;
        const progressValue = Math.round(30 + (current / total) * 65);
        sendEvent('status', {
          stage: 'transcribing',
          message: total > 1
            ? `Transcribiendo segmento ${current} de ${total}...`
            : 'Transcribiendo audio...',
          progress: progressValue,
          current,
          total,
        });
      }
    );

    if (getJob()?.cancelled) throw new Error('Trabajo cancelado por el cliente');

    if (!transcription || transcription.length === 0) {
      throw new Error('La transcripción está vacía. El audio puede no contener voz reconocible.');
    }

    sendEvent('complete', {
      transcription,
      charCount: transcription.length,
      wordCount: transcription.split(/\s+/).filter(w => w.length > 0).length,
      fileName: originalName,
      fileSizeMB: parseFloat((fileSize / (1024*1024)).toFixed(2)),
      fileType: isVideo ? 'video' : 'audio',
      duration: originalDuration,
    });

    console.log(`[Process] Completado: ${transcription.length} caracteres`);

  } finally {
    cleanup(filePath, chunkPaths, audioToProcess !== filePath ? audioToProcess : null);
    const { res } = activeJobs.get(jobId) || {};
    if (res && !res.writableEnded) res.end();
  }
}

function formatErrorMessage(error) {
  const msg = error.message || '';

  if (msg.includes('API key')) return 'Error de autenticación con OpenAI. Verifica tu API key.';
  if (msg.includes('quota') || msg.includes('rate limit')) return 'Límite de la API alcanzado. Espera un momento e intenta de nuevo.';
  if (msg.includes('ffmpeg') || msg.includes('ffprobe')) return 'Error al procesar el audio. Asegúrate de que ffmpeg esté instalado.';
  if (msg.includes('cancelado')) return 'La transcripción fue cancelada.';
  if (msg.includes('vacía')) return msg;

  return `Error en la transcripción: ${msg}`;
}

/**
 * DELETE /api/transcription/cancel/:jobId
 * Cancela un trabajo activo
 */
router.delete('/cancel/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (job) {
    job.cancelled = true;
    res.json({ message: 'Trabajo cancelado' });
  } else {
    res.status(404).json({ error: 'Trabajo no encontrado' });
  }
});

module.exports = router;
