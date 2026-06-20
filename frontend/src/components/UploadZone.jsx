import React, { useRef, useState, useCallback } from 'react';
import { CloudUpload, AlertTriangle } from 'lucide-react';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/ogg', 'audio/flac', 'audio/webm', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const ALLOWED_EXTS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.mp4', '.webm', '.aac', '.mov', '.avi', '.mkv'];
const MAX_SIZE_GB = 1;

export default function UploadZone({ onFileSelected, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState('');

  const validateFile = useCallback((file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
    if (!typeOk) {
      return `Formato no soportado. Usa: ${ALLOWED_EXTS.join(', ')}`;
    }
    const sizeGB = file.size / (1024 ** 3);
    if (sizeGB > MAX_SIZE_GB) {
      return `El archivo supera el límite de ${MAX_SIZE_GB} GB (tamaño: ${sizeGB.toFixed(2)} GB)`;
    }
    return null;
  }, []);

  const handleFile = useCallback((file) => {
    setLocalError('');
    const error = validateFile(file);
    if (error) {
      setLocalError(error);
      return;
    }
    onFileSelected(file);
  }, [validateFile, onFileSelected]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [disabled, handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); if (!disabled) setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleInputChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  const handleClick = () => { if (!disabled) inputRef.current?.click(); };

  return (
    <div className="w-full h-full flex flex-col min-h-[340px]">
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${
          dragOver 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' 
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
      >
        <input
          id="upload-file-input"
          name="uploadFile"
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTS.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex justify-center mb-6">
          <div className="p-5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
            <CloudUpload size={40} strokeWidth={2} />
          </div>
        </div>

        <h3 className="text-xl font-bold mb-3 text-secondary-900 dark:text-white">
          Subir Archivo
        </h3>

        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-xs leading-relaxed">
          Arrastra y suelta tu audio aquí o haz clic para explorar tus archivos locales.
        </p>

        <div className="flex gap-2 justify-center flex-wrap">
          {['MP3', 'WAV', 'M4A', 'FLAC'].map(fmt => (
            <span key={fmt} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-1.5 text-xs font-semibold rounded-full tracking-wide">
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {localError && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium animate-fade-in shadow-sm">
          <AlertTriangle size={18} /> {localError}
        </div>
      )}
    </div>
  );
}
