const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const azureBlobService = require('./azureBlobService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getApiKey(optionsApiKey) {
  if (optionsApiKey) return optionsApiKey;
  if (!process.env.GROQ_API_KEY) {
    throw new Error('No se ha proporcionado una API Key y el servidor no tiene una predeterminada configurada.');
  }
  return process.env.GROQ_API_KEY;
}

/**
 * Transcribe un archivo (o chunk) streameando desde Azure Blob Storage
 * @param {object} chunk - { blob: 'ruta/en/azure' }
 * @param {object} options - Opciones adicionales
 * @returns {Promise<string>} - Texto transcrito
 */
async function transcribeFile(chunk, options = {}) {
  const apiKey = getApiKey(options.apiKey);

  console.log(`[Whisper] Transcribiendo desde Blob: ${chunk.blob}`);

  // Obtenemos el Buffer desde Azure Blob Storage una sola vez antes del bucle de reintentos
  const fileBuffer = await azureBlobService.obtenerBufferArchivo(chunk.blob);
  
  const maxRetries = 5;
  let attempt = 0;

  while (true) {
    attempt++;
    const formData = new FormData();
    
    // Enviamos el Buffer para que form-data pueda calcular el Content-Length exacto
    formData.append('file', fileBuffer, { 
      filename: path.basename(chunk.blob),
      contentType: 'audio/mpeg' 
    });
    
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'text');
    formData.append('temperature', '0');

    if (options.language) {
      formData.append('language', options.language);
    }
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }

    try {
      const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      return typeof response.data === 'string' ? response.data : response.data.text || '';
    } catch (error) {
      const isRateLimit = error.response && error.response.status === 429;
      if (isRateLimit && attempt < maxRetries) {
        let retryAfter = 60; // Valor de fallback (60 segundos)
        
        // Intentar leer el header retry-after
        const headers = error.response.headers || {};
        const headerRetryAfter = headers['retry-after'] || headers['Retry-After'];
        if (headerRetryAfter) {
          const parsed = parseFloat(headerRetryAfter);
          if (!isNaN(parsed) && parsed > 0) {
            retryAfter = parsed;
          }
        } else {
          // Exponencial con jitter si no viene el header
          retryAfter = Math.pow(2, attempt - 1) * 5 + Math.random() * 3;
        }

        console.warn(`[Whisper] Límite de velocidad alcanzado (429) en el intento ${attempt}. Reintentando en ${retryAfter.toFixed(1)} segundos...`);
        
        if (options.onRetry) {
          await options.onRetry(retryAfter * 1000, attempt);
        } else {
          await sleep(retryAfter * 1000);
        }
        continue;
      }

      let msg = error.message;
      if (error.response) {
        msg = `Status ${error.response.status} - ${JSON.stringify(error.response.data.error || error.response.data)}`;
      }
      throw new Error(`Groq API Error: ${msg}`);
    }
  }
}

/**
 * Transcribe múltiples chunks desde Azure Blob y concatena el resultado
 * @param {object[]} chunkPaths - Objetos con info del chunk { blob: 'ruta' }
 * @param {Function} onProgress - Callback de progreso
 * @param {object} options - Opciones de transcripción
 * @returns {Promise<string>} - Transcripción completa
 */
async function transcribeChunks(chunkPaths, onProgress = () => {}, options = {}) {
  const transcriptions = [];
  let previousText = '';

  for (let i = 0; i < chunkPaths.length; i++) {
    const chunkInfo = chunkPaths[i];

    console.log(`[Whisper] Procesando chunk ${i + 1}/${chunkPaths.length}`);
    onProgress(i + 1, chunkPaths.length, 'transcribing');

    const prompt = previousText
      ? previousText.split(' ').slice(-50).join(' ')
      : options.prompt;

    const chunkOptions = {
      ...options,
      prompt,
      onRetry: async (delayMs, attempt) => {
        const delaySeconds = Math.ceil(delayMs / 1000);
        for (let secondsLeft = delaySeconds; secondsLeft > 0; secondsLeft--) {
          if (options.isCancelled && options.isCancelled()) {
            throw new Error('Trabajo cancelado por el cliente');
          }
          onProgress(
            i + 1,
            chunkPaths.length,
            'waiting_rate_limit',
            `Límite de velocidad (429) alcanzado. Reintentando segmento ${i + 1} en ${secondsLeft}s (Intento ${attempt})...`
          );
          await sleep(1000);
        }
      }
    };

    const text = await transcribeFile(chunkInfo, chunkOptions);
    transcriptions.push(text.trim());
    previousText = text;

    console.log(`[Whisper] Chunk ${i + 1} transcrito (${text.length} caracteres)`);
  }

  return transcriptions
    .filter(t => t.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { transcribeFile, transcribeChunks };
