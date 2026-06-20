const path = require('path');

const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska'
];

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.mp4', '.webm', '.aac', '.mov', '.avi', '.mkv'];

function validarArchivo(archivo) {
  if (!archivo) {
    throw new Error('No se ha proporcionado ningún archivo.');
  }

  const ext = path.extname(archivo.originalname || archivo.name || '').toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.includes(archivo.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);

  if (!mimeOk && !extOk) {
    const error = new Error(`Formato no soportado: ${archivo.mimetype || 'Desconocido'}. Usa MP3, WAV, M4A, OGG, FLAC o WebM`);
    error.code = 'LIMIT_UNEXPECTED_FILE';
    throw error;
  }

  // Si tamaño es validable aquí (ej: multer memory storage)
  if (archivo.size !== undefined && archivo.size === 0) {
    throw new Error('El archivo está vacío (0 bytes).');
  }

  return true;
}

module.exports = {
  validarArchivo,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
};
