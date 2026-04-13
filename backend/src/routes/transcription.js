const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { upload } = require('../middleware/uploadMiddleware');
const { splitAudio, cleanupChunks } = require('../services/audioSplitter');
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

    const cleanup = (filePath, chunkPaths = []) => {
      cleanupChunks(chunkPaths, filePath);
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

  try {
    sendEvent('status', {
      stage: 'analyzing',
      message: 'Analizando archivo de audio...',
      progress: 5,
    });

    const fileSizeMB = fileSize / (1024 * 1024);
    console.log(`[Process] Iniciando: ${originalName} (${fileSizeMB.toFixed(1)}MB)`);

    // Verificar cancelación
    if (getJob()?.cancelled) throw new Error('Trabajo cancelado por el cliente');

    sendEvent('status', {
      stage: 'splitting',
      message: fileSizeMB > 24
        ? `Archivo grande (${fileSizeMB.toFixed(0)}MB), dividiendo en segmentos...`
        : 'Preparando transcripción...',
      progress: 10,
    });

    // Dividir si es necesario
    chunkPaths = await splitAudio(filePath, (current, total, stage) => {
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
      fileSizeMB: parseFloat(fileSizeMB.toFixed(2)),
    });

    console.log(`[Process] Completado: ${transcription.length} caracteres`);

  } finally {
    cleanup(filePath, chunkPaths);
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
