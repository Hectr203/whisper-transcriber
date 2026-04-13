import React, { useState, useRef, useCallback } from 'react';
import UploadZone from './components/UploadZone';
import AudioRecorder from './components/AudioRecorder';
import ProgressBar from './components/ProgressBar';
import TranscriptionResult from './components/TranscriptionResult';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);  // { stage, message, progress, ... }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const eventSourceRef = useRef(null);
  const xhrRef = useRef(null);

  const reset = useCallback(() => {
    setFile(null);
    setStatus(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    if (eventSourceRef.current) eventSourceRef.current.close();
  }, []);

  const handleFileSelected = useCallback((selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setStatus(null);
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!file || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('audio', file);

    // Usamos fetch con ReadableStream para SSE sobre POST
    try {
      setStatus({ stage: 'analyzing', message: 'Conectando con el servidor...', progress: 2 });

      const response = await fetch(`${API_BASE}/transcription/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Error HTTP ${response.status}`);
      }

      // Leer el stream SSE
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Guardar línea incompleta

        let currentEvent = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEvent === 'status') {
                setStatus(data);
              } else if (currentEvent === 'complete') {
                setStatus({ stage: 'complete', message: 'Transcripción completada', progress: 100 });
                setResult(data);
                setIsProcessing(false);
              } else if (currentEvent === 'error') {
                throw new Error(data.message || 'Error en la transcripción');
              }
            } catch (parseErr) {
              if (parseErr.message !== 'JSON parse error') {
                throw parseErr;
              }
            }
            currentEvent = null;
          }
        }
      }

    } catch (err) {
      console.error('[App] Error:', err);
      setError(err.message || 'Error desconocido al procesar el archivo');
      setIsProcessing(false);
      setStatus(null);
    }
  }, [file, isProcessing]);

  const handleCancel = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    reset();
  }, [reset]);

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : null;
  const isLargeFile = file && file.size > 24 * 1024 * 1024;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 16px 64px',
    }}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎙️</div>
        <h1 style={{
          fontSize: 'clamp(24px, 4vw, 36px)',
          fontWeight: 700,
          marginBottom: '10px',
          background: 'linear-gradient(135deg, #fff, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Whisper Transcriber
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '480px' }}>
          Transcripción automática de audio con IA — soporta archivos de hasta 1 GB
        </p>
      </header>

      {/* Contenido principal */}
      <main style={{ width: '100%', maxWidth: '760px' }}>

        {/* Upload Zone */}
        {!result && (
          <>
            <UploadZone
              onFileSelected={handleFileSelected}
              disabled={isProcessing}
            />
            <AudioRecorder
              onRecordComplete={handleFileSelected}
              disabled={isProcessing}
            />
          </>
        )}

        {/* Info del archivo seleccionado */}
        {file && !result && !isProcessing && (
          <div style={{
            marginTop: '16px',
            padding: '14px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🎵</span>
              <div>
                <p style={{ fontWeight: 500, fontSize: '14px' }}>{file.name}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {fileSizeMB} MB
                  {isLargeFile && (
                    <span style={{ marginLeft: '8px', color: 'var(--warning)' }}>
                      — Se dividirá automáticamente en segmentos
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setError(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '18px',
                padding: '4px',
                borderRadius: '4px',
              }}
              title="Quitar archivo"
            >✕</button>
          </div>
        )}

        {/* Botón transcribir */}
        {file && !result && !isProcessing && (
          <button
            onClick={handleTranscribe}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '14px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '16px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            Transcribir con Whisper AI →
          </button>
        )}

        {/* Progreso */}
        {isProcessing && status && (
          <>
            <ProgressBar status={status} />
            <button
              onClick={handleCancel}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '10px',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'var(--error)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              Cancelar
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: '16px',
            padding: '16px 20px',
            background: 'rgba(248, 113, 113, 0.08)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={{ color: 'var(--error)', fontWeight: 600, marginBottom: '4px' }}>
                  Error en la transcripción
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '13px',
              }}
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <TranscriptionResult result={result} onReset={reset} />
        )}
      </main>

      {/* Footer */}
      <footer style={{ marginTop: '48px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
        <p>Powered by <strong style={{ color: 'var(--text)' }}>OpenAI Whisper</strong> — Los archivos se eliminan tras la transcripción</p>
      </footer>
    </div>
  );
}
