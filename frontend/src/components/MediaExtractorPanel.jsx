import React, { useState } from 'react';
import { FileAudio, Film, AlertTriangle, Download, Loader2 } from 'lucide-react';
import UploadZone from './UploadZone';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function MediaExtractorPanel() {
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [formatType, setFormatType] = useState('audio'); // 'audio' | 'video_only'
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    
    const isVideo = selectedFile.type.startsWith('video') || ['.mp4', '.webm', '.mov', '.avi', '.mkv'].some(ext => selectedFile.name.toLowerCase().endsWith(ext));
    const mediaEl = document.createElement(isVideo ? 'video' : 'audio');
    const objectUrl = URL.createObjectURL(selectedFile);
    
    mediaEl.onloadedmetadata = () => {
      const minutes = Math.floor(mediaEl.duration / 60);
      const seconds = Math.floor(mediaEl.duration % 60);
      setFileInfo({
        type: isVideo ? 'video' : 'audio',
        durationText: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        durationSec: mediaEl.duration
      });
      URL.revokeObjectURL(objectUrl);
    };
    mediaEl.onerror = () => {
      setFileInfo({ type: isVideo ? 'video' : 'audio', durationText: '--:--', durationSec: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    mediaEl.src = objectUrl;
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('formatType', formatType);

    try {
      const response = await fetch(`${API_BASE}/transcription/extract`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Error al extraer archivo');
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error desconocido al extraer medio');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result && result.downloadUrl) {
      const apiOrigin = API_BASE.endsWith('/api') ? API_BASE.slice(0, -4) : '';
      window.location.href = `${apiOrigin}${result.downloadUrl}`;
    }
  };

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : null;

  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto flex flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-white mb-3">
          Extractor de Medios Locales
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          Sube tu propio archivo de video y extrae únicamente la pista de audio o la pista visual (video sin sonido).
        </p>
      </div>

      <div className="mb-8 flex flex-col items-center">
        <div className="inline-flex p-1.5 bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm gap-2">
          <button
            type="button"
            onClick={() => setFormatType('audio')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              formatType === 'audio'
                ? 'bg-white dark:bg-primary-600 text-primary-700 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileAudio size={18} className={formatType === 'audio' ? 'text-primary-600 dark:text-white' : ''} />
            Extraer Solo Audio
          </button>
          <button
            type="button"
            onClick={() => setFormatType('video_only')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              formatType === 'video_only'
                ? 'bg-white dark:bg-primary-600 text-primary-700 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Film size={18} className={formatType === 'video_only' ? 'text-primary-600 dark:text-white' : ''} />
            Extraer Solo Video
          </button>
        </div>

        {formatType === 'video_only' && file && fileInfo && fileInfo.type !== 'video' && (
          <div className="mt-4 max-w-xl p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-3 text-amber-800 dark:text-amber-200 text-xs animate-fade-in">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            <span>El archivo seleccionado parece no ser un video. Sube un archivo MP4, WebM, MOV, AVI o MKV.</span>
          </div>
        )}
      </div>

      {!file && !result && (
        <div className="w-full max-w-2xl">
          <UploadZone
            onFileSelected={handleFileSelected}
            disabled={isProcessing}
            acceptedFormatType="video"
          />
        </div>
      )}

      {error && (
        <div className="mb-6 w-full max-w-2xl p-5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 dark:text-red-400 font-bold mb-1 text-lg">Error</p>
              <p className="text-red-600/90 dark:text-red-400/80 text-base">{error}</p>
            </div>
          </div>
        </div>
      )}

      {file && !result && (
        <div className="mt-4 w-full max-w-2xl p-6 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl">
              {fileInfo?.type === 'video' ? <Film size={32} /> : <FileAudio size={32} />}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-slate-900 dark:text-white text-lg truncate mb-1">
                {file.name}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {fileInfo ? `Duración: ${fileInfo.durationText} • ` : ''}{fileSizeMB} MB
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => { setFile(null); setFileInfo(null); setError(null); }}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleExtract}
              disabled={isProcessing}
              className="flex-1 flex justify-center items-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-md disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : 'Extraer ahora'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 w-full max-w-2xl p-8 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-2xl shadow-xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-800/30 text-green-600 dark:text-green-400 mb-4">
            <Download size={32} />
          </div>
          <h3 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">¡Extracción completada!</h3>
          <p className="text-green-700 dark:text-green-400 mb-6">{result.fileName}</p>
          
          <div className="flex gap-4">
            <button
              onClick={() => { setFile(null); setResult(null); setFileInfo(null); }}
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors"
            >
              Extraer otro
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex justify-center items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors shadow-md"
            >
              <Download size={20} /> Descargar Archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
