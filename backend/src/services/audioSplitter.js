const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const WHISPER_MAX_MB = 24; // Dejamos margen del límite de 25MB de la API
const CHUNK_DURATION_SECONDS = 600; // 10 minutos por chunk (seguro para la mayoría de audios)

const tempDir = path.resolve(process.env.TEMP_DIR || './src/temp');

/**
 * Obtiene la duración de un archivo de audio en segundos
 */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`No se pudo analizar el archivo de audio: ${err.message}`));
      const duration = metadata.format?.duration;
      if (!duration) return reject(new Error('No se pudo determinar la duración del archivo'));
      resolve(parseFloat(duration));
    });
  });
}

/**
 * Obtiene el tamaño de un archivo en MB
 */
function getFileSizeMB(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size / (1024 * 1024);
}

/**
 * Divide un archivo de audio en segmentos
 * @param {string} inputPath - Ruta del archivo original
 * @param {Function} onProgress - Callback de progreso (chunkIndex, totalChunks)
 * @returns {Promise<string[]>} - Array de rutas de chunks
 */
async function splitAudio(inputPath, onProgress = () => {}) {
  const fileSizeMB = getFileSizeMB(inputPath);

  // Si el archivo es pequeño, no necesitamos dividir
  if (fileSizeMB <= WHISPER_MAX_MB) {
    console.log(`[Splitter] Archivo pequeño (${fileSizeMB.toFixed(1)}MB), no requiere división`);
    return [inputPath];
  }

  console.log(`[Splitter] Archivo grande (${fileSizeMB.toFixed(1)}MB), dividiendo en chunks...`);

  const duration = await getAudioDuration(inputPath);
  const totalChunks = Math.ceil(duration / CHUNK_DURATION_SECONDS);

  console.log(`[Splitter] Duración: ${(duration / 60).toFixed(1)} min, Chunks: ${totalChunks}`);

  const chunkPaths = [];
  const sessionId = uuidv4();

  for (let i = 0; i < totalChunks; i++) {
    const startTime = i * CHUNK_DURATION_SECONDS;
    const chunkPath = path.join(tempDir, `chunk_${sessionId}_${i}.mp3`);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(CHUNK_DURATION_SECONDS)
        .audioCodec('libmp3lame')
        .audioBitrate('64k') // Calidad suficiente para voz, reduce tamaño
        .format('mp3')
        .output(chunkPath)
        .on('end', () => {
          console.log(`[Splitter] Chunk ${i + 1}/${totalChunks} creado: ${chunkPath}`);
          chunkPaths.push(chunkPath);
          onProgress(i + 1, totalChunks, 'splitting');
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`Error al dividir audio (chunk ${i + 1}): ${err.message}`));
        })
        .run();
    });
  }

  return chunkPaths;
}

/**
 * Elimina archivos temporales de chunks
 */
function cleanupChunks(chunkPaths, originalPath) {
  chunkPaths.forEach(p => {
    // No eliminar el archivo original si no fue chunkeado
    if (p !== originalPath) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (err) {
        console.warn(`[Splitter] No se pudo eliminar ${p}:`, err.message);
      }
    }
  });
}

module.exports = { splitAudio, cleanupChunks, getAudioDuration };
