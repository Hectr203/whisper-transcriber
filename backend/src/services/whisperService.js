const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

function getApiKey() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY no está configurada en las variables de entorno');
  }
  return process.env.GROQ_API_KEY;
}

/**
 * Transcribe un único archivo de audio con Whisper
 * @param {string} audioPath - Ruta del archivo
 * @param {object} options - Opciones adicionales
 * @returns {Promise<string>} - Texto transcrito
 */
async function transcribeFile(audioPath, options = {}) {
  const apiKey = getApiKey();
  const fileSizeMB = fs.statSync(audioPath).size / (1024 * 1024);

  console.log(`[Whisper] Transcribiendo: ${path.basename(audioPath)} (${fileSizeMB.toFixed(1)}MB)`);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioPath));
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
      // Importante para enviar archivos grandes sin que Axios los bloquee localmente
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return typeof response.data === 'string' ? response.data : response.data.text || '';
  } catch (error) {
    let msg = error.message;
    if (error.response) {
      // Capturamos la respuesta real de Groq (ej. cuota insuficiente, bad request)
      msg = `Status ${error.response.status} - ${JSON.stringify(error.response.data.error || error.response.data)}`;
    }
    throw new Error(`Groq API Error: ${msg}`);
  }
}

/**
 * Transcribe múltiples chunks y concatena el resultado
 * @param {string[]} chunkPaths - Rutas de los chunks
 * @param {Function} onProgress - Callback de progreso
 * @param {object} options - Opciones de transcripción
 * @returns {Promise<string>} - Transcripción completa
 */
async function transcribeChunks(chunkPaths, onProgress = () => {}, options = {}) {
  const transcriptions = [];
  let previousText = ''; // Contexto para mejorar continuidad entre chunks

  for (let i = 0; i < chunkPaths.length; i++) {
    const chunkPath = chunkPaths[i];

    console.log(`[Whisper] Procesando chunk ${i + 1}/${chunkPaths.length}`);
    onProgress(i + 1, chunkPaths.length, 'transcribing');

    // Usamos el final del texto anterior como prompt para mejorar coherencia
    const prompt = previousText
      ? previousText.split(' ').slice(-50).join(' ')  // últimas 50 palabras
      : options.prompt;

    const text = await transcribeFile(chunkPath, { ...options, prompt });
    transcriptions.push(text.trim());
    previousText = text;

    console.log(`[Whisper] Chunk ${i + 1} transcrito (${text.length} caracteres)`);
  }

  // Unir con espacio, asegurando no duplicar puntuación
  return transcriptions
    .filter(t => t.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { transcribeFile, transcribeChunks };
