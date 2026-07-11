const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { upload } = require('../middleware/uploadMiddleware');
const { splitAudio, splitAudioIntoEqualParts, cleanupChunks, extractAudioIfVideo, analyzeMedia } = require('../services/audioSplitter');
const { transcribeChunks } = require('../services/whisperService');
const azureBlobService = require('../services/azureBlobService');

// Map para gestionar conexiones SSE activas
const activeJobs = new Map();

const safeFileName = (name = 'audio') => path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, '_');

/**
 * POST /api/transcription/upload
 * Recibe el archivo, lo procesa y devuelve la transcripción vía SSE
 */
router.post('/upload', (req, res, next) => {
  // Multer con manejo de errores explícito
  upload.single('audio')(req, res, async (err) => {
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

    const jobId = req.file.filename.replace('upload_', '').split('.')[0]; // Usamos el UUID
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

    let originalBlobPath = '';

    try {
      sendEvent('status', {
        stage: 'uploading',
        message: 'Guardando archivo en almacenamiento temporal...',
        progress: 2,
      });

      // 1. Guardar archivo original en Azure Blob Storage o fallback local
      originalBlobPath = `cargas/${jobId}/${req.file.originalname}`;
      await azureBlobService.subirArchivo(req.file.path, originalBlobPath, {
        mimetype: req.file.mimetype,
        jobId: jobId
      });

      // Procesar en background para no bloquear
      processTranscription({
        localFilePath: req.file.path,
        originalBlobPath,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        jobId,
        apiKey: req.headers['x-groq-api-key'], // <- Leer API Key del cliente
        sendEvent,
        cleanupLocal,
        getJob: () => activeJobs.get(jobId),
      }).catch(async (error) => {
        console.error('[Route] Error en transcripción:', error.message);
        sendEvent('error', {
          message: formatErrorMessage(error),
          code: error.code || 'TRANSCRIPTION_ERROR',
        });
        cleanupLocal(req.file.path);
        await azureBlobService.eliminarPorPrefijo(`cargas/${jobId}/`).catch(()=>{});
        await azureBlobService.eliminarPorPrefijo(`temporales/${jobId}/`).catch(()=>{});
        activeJobs.delete(jobId);
        if (!res.writableEnded) res.end();
      });

    } catch (storageError) {
      console.error('[Route] Error guardando archivo temporal:', storageError);
      sendEvent('error', {
        message: 'Error al guardar el archivo en almacenamiento temporal.',
        code: 'STORAGE_ERROR'
      });
      cleanupLocal(req.file.path);
      activeJobs.delete(jobId);
      if (!res.writableEnded) res.end();
    }

    // Detectar desconexión del cliente
    req.on('close', () => {
      const job = activeJobs.get(jobId);
      if (job) job.cancelled = true;
      console.log(`[Route] Cliente desconectado: ${jobId}`);
    });
  });
});

router.post('/split', (req, res, next) => {
  upload.single('audio')(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo', message: 'Envía un archivo de audio en el campo "audio"' });
    }

    const parts = Number.parseInt(req.body.parts, 10);
    if (!Number.isInteger(parts) || parts < 1 || parts > 100) {
      fs.rm(req.file.path, { force: true }, () => {});
      return res.status(400).json({ error: 'Partes inválidas', message: 'Indica un número de partes entre 1 y 100.' });
    }

    const sessionId = req.file.filename.replace('upload_', '').split('.')[0];
    let audioToSplit = req.file.path;
    let chunkInfo = [];

    try {
      const mediaInfo = await analyzeMedia(req.file.path);
      if (mediaInfo.hasVideo) {
        audioToSplit = await extractAudioIfVideo(req.file.path);
      }

      const splitResult = await splitAudioIntoEqualParts(audioToSplit, parts);
      chunkInfo = splitResult.chunks;
      const originalBase = safeFileName(req.file.originalname).replace(/\.[^.]+$/, '');

      const chunks = [];
      for (const chunk of chunkInfo) {
        const fileName = `${originalBase}_parte_${chunk.index}_de_${parts}.mp3`;
        const blobPath = `temporales/splitter/${sessionId}/part_${chunk.index}.mp3`;
        await azureBlobService.subirArchivo(chunk.local, blobPath, {
          mimetype: 'audio/mpeg',
          jobId: sessionId,
          metadata: { source: 'manual-splitter', originalName: req.file.originalname }
        });
        chunks.push({
          id: String(chunk.index),
          sessionId,
          name: `Parte ${chunk.index}`,
          fileName,
          duration: chunk.duration,
          start: chunk.start,
          downloadUrl: `/api/transcription/chunks/${sessionId}/${chunk.index}/download`,
        });
      }

      res.json({
        sessionId,
        fileName: req.file.originalname,
        totalDuration: splitResult.duration,
        parts,
        chunks,
      });
    } catch (error) {
      console.error('[Split] Error:', error.message);
      await azureBlobService.eliminarPorPrefijo(`temporales/splitter/${sessionId}/`).catch(() => {});
      res.status(500).json({ error: 'Error al dividir el archivo', message: error.message });
    } finally {
      fs.rm(req.file.path, { force: true }, () => {});
      if (audioToSplit !== req.file.path) fs.rm(audioToSplit, { force: true }, () => {});
      cleanupChunks(chunkInfo.map(c => c.local), null);
    }
  });
});

router.get('/chunks/:sessionId/:chunkId/download', async (req, res) => {
  const { sessionId, chunkId } = req.params;
  const blobPath = `temporales/splitter/${sessionId}/part_${chunkId}.mp3`;

  try {
    if (!(await azureBlobService.existeArchivo(blobPath))) {
      return res.status(404).json({ error: 'Fragmento no encontrado' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="fragmento_${chunkId}.mp3"`);
    const stream = await azureBlobService.obtenerFlujoArchivo(blobPath);
    stream.on('error', (error) => {
      console.error('[Download chunk] Error:', error.message);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Error descargando fragmento', message: error.message });
  }
});

router.post('/chunks/:sessionId/:chunkId/transcribe', async (req, res) => {
  const { sessionId, chunkId } = req.params;
  const blobPath = `temporales/splitter/${sessionId}/part_${chunkId}.mp3`;

  try {
    if (!(await azureBlobService.existeArchivo(blobPath))) {
      return res.status(404).json({ error: 'Fragmento no encontrado' });
    }
    const transcription = await transcribeChunks(
      [{ blob: blobPath }],
      () => {},
      { apiKey: req.headers['x-groq-api-key'] }
    );
    res.json({
      transcription,
      charCount: transcription.length,
      wordCount: transcription.split(/\s+/).filter(w => w.length > 0).length,
      fileName: `fragmento_${chunkId}.mp3`,
      fileType: 'audio',
    });
  } catch (error) {
    console.error('[Transcribe chunk] Error:', error.message);
    res.status(500).json({ error: 'Error transcribiendo fragmento', message: formatErrorMessage(error) });
  }
});

async function processTranscription({ localFilePath, originalBlobPath, originalName, fileSize, jobId, apiKey, sendEvent, cleanupLocal, getJob }) {
  let chunkPaths = [];
  let audioToProcessLocal = localFilePath;
  let isVideo = false;
  let originalDuration = 0;

  try {
    sendEvent('status', {
      stage: 'analyzing',
      message: 'Analizando archivo multimedia...',
      progress: 5,
    });

    // Analizamos el archivo localmente (ffmpeg necesita un archivo local)
    const mediaInfo = await analyzeMedia(localFilePath);
    isVideo = mediaInfo.hasVideo;
    originalDuration = mediaInfo.duration;

    if (isVideo) {
      sendEvent('status', {
        stage: 'extracting',
        message: 'Extrayendo audio del video...',
        progress: 8,
      });
      audioToProcessLocal = await extractAudioIfVideo(localFilePath);
      
      // Guardar el audio extraído en almacenamiento temporal
      const extractedBlobPath = `temporales/${jobId}/audio_extraido.mp3`;
      await azureBlobService.subirArchivo(audioToProcessLocal, extractedBlobPath, { jobId });
    }

    const actualFileSizeMB = fs.statSync(audioToProcessLocal).size / (1024 * 1024);
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

    // Dividir si es necesario localmente (ffmpeg)
    chunkPaths = await splitAudio(audioToProcessLocal, (current, total, stage) => {
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

    // Guardar chunks locales en almacenamiento temporal
    const chunkBlobPaths = [];
    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkLocalPath = chunkPaths[i];
      const chunkBlobPath = `temporales/${jobId}/chunk_${i}.mp3`;
      await azureBlobService.subirArchivo(chunkLocalPath, chunkBlobPath, { jobId });
      chunkBlobPaths.push({ local: chunkLocalPath, blob: chunkBlobPath });
    }

    const totalChunks = chunkPaths.length;
    sendEvent('status', {
      stage: 'transcribing',
      message: totalChunks > 1
        ? `Transcribiendo ${totalChunks} segmentos con Whisper...`
        : 'Transcribiendo con Whisper AI...',
      progress: 30,
      totalChunks,
    });

    // Transcribir (le pasamos las rutas de Blob, descargará cada una a memoria para enviarlo a Groq)
    // Pero espera, el WhisperService actual acepta rutas locales.
    // Lo más eficiente es que lea el Blob y lo envie como Stream.
    // Modificaremos whisperService para que soporte Blob Paths
    const transcription = await transcribeChunks(
      chunkBlobPaths,
      (current, total, statusType, customMessage) => {
        if (getJob()?.cancelled) return;
        const progressValue = Math.round(30 + (current / total) * 65);
        
        let message = total > 1
          ? `Transcribiendo segmento ${current} de ${total}...`
          : 'Transcribiendo audio...';

        if (statusType === 'waiting_rate_limit') {
          message = customMessage;
        }

        sendEvent('status', {
          stage: 'transcribing',
          message,
          progress: progressValue,
          current,
          total,
        });
      },
      { 
        apiKey,
        isCancelled: () => getJob()?.cancelled
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
    // 1. Limpiar todos los archivos locales usados en el proceso
    cleanupLocal(localFilePath);
    if (audioToProcessLocal !== localFilePath) cleanupLocal(audioToProcessLocal);
    cleanupChunks(chunkPaths, audioToProcessLocal !== localFilePath ? audioToProcessLocal : null);
    
    // 2. Eliminar archivos temporales remotos/locales
    console.log(`[Process] Limpiando almacenamiento temporal para el job ${jobId}...`);
    try {
      await azureBlobService.eliminarPorPrefijo(`cargas/${jobId}/`);
      await azureBlobService.eliminarPorPrefijo(`temporales/${jobId}/`);
    } catch (e) {
      console.warn(`[Process] Fallo parcial en limpieza de almacenamiento temporal:`, e.message);
    }

    // 3. Cerrar SSE
    const { res } = activeJobs.get(jobId) || {};
    if (res && !res.writableEnded) res.end();
    activeJobs.delete(jobId);
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

module.exports = { router, processTranscription, activeJobs };
