import React, { useRef, useState, useCallback } from 'react';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/ogg', 'audio/flac', 'audio/webm', 'video/mp4', 'video/webm'];
const ALLOWED_EXTS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.mp4', '.webm', '.aac'];
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
    <div style={{ width: '100%' }}>
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: dragOver ? 'var(--accent-light)' : 'var(--surface)',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.5 : 1,
          userSelect: 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTS.join(',')}
          onChange={handleInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />

        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎙️</div>

        <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
          {dragOver ? 'Suelta el archivo aquí' : 'Arrastra tu archivo de audio'}
        </p>

        <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '14px' }}>
          o haz clic para seleccionar
        </p>

        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '16px',
        }}>
          {['MP3', 'WAV', 'M4A', 'OGG', 'FLAC', 'WebM'].map(fmt => (
            <span key={fmt} style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}>{fmt}</span>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Máximo 1 GB — Transcripción automática con Whisper AI
        </p>
      </div>

      {localError && (
        <div style={{
          marginTop: '12px',
          padding: '12px 16px',
          background: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--error)',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span> {localError}
        </div>
      )}
    </div>
  );
}
