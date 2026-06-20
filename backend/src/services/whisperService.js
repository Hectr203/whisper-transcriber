const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const azureBlobService = require('./azureBlobService');

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

  const formData = new FormData();
  
  // Obtenemos el Buffer desde Azure Blob Storage
  const fileBuffer = await azureBlobService.obtenerBufferArchivo(chunk.blob);
  
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
    let msg = error.message;
    if (error.response) {
      msg = `Status ${error.response.status} - ${JSON.stringify(error.response.data.error || error.response.data)}`;
    }
    throw new Error(`Groq API Error: ${msg}`);
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

    const text = await transcribeFile(chunkInfo, { ...options, prompt });
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
