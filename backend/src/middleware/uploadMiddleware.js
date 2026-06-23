const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { validarArchivo, ALLOWED_EXTENSIONS } = require('./validadorArchivos');

// Carpeta local de subida inicial. Se puede cambiar a os.tmpdir() con UPLOADS_DIR.
const tempDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(tempDir, { recursive: true });
const MAX_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_MB || process.env.AZURE_STORAGE_MAX_FILE_SIZE_MB || '1024') * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Sanitizar nombre de archivo (solo caracteres seguros)
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const ext = path.extname(sanitizedName).toLowerCase();
    const uniqueName = `upload_${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  try {
    validarArchivo(file);
    cb(null, true);
  } catch (error) {
    cb(new multer.MulterError(error.code || 'LIMIT_UNEXPECTED_FILE', error.message));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_BYTES,
    files: 1,
  },
});

module.exports = { upload, ALLOWED_EXTENSIONS };
