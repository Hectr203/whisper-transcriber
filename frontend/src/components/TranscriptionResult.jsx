import React, { useState } from 'react';

export default function TranscriptionResult({ result, onReset }) {
  const [copied, setCopied] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.transcription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para navegadores sin Clipboard API
      const ta = document.createElement('textarea');
      ta.value = result.transcription;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result.transcription], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = result.fileName?.replace(/\.[^.]+$/, '') || 'transcripcion';
    a.download = `${baseName}_transcripcion.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btnBase = {
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    transition: 'all 0.2s',
    cursor: 'pointer',
  };

  return (
    <div style={{
      marginTop: '24px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {/* Header con estadísticas */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>✅</span>
          <span style={{ fontWeight: 600, color: 'var(--success)' }}>Transcripción lista</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <span>📄 {result.wordCount?.toLocaleString()} palabras</span>
          <span>🔤 {result.charCount?.toLocaleString()} caracteres</span>
          {result.fileName && <span>🎵 {result.fileName}</span>}
        </div>
      </div>

      {/* Texto transcrito */}
      <div style={{
        padding: '20px',
        maxHeight: '400px',
        overflowY: 'auto',
      }}>
        <p style={{
          color: 'var(--text)',
          lineHeight: 1.8,
          fontSize: '15px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {result.transcription}
        </p>
      </div>

      {/* Acciones */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Copiar */}
          <button
            onClick={handleCopy}
            style={{
              ...btnBase,
              background: copied ? 'rgba(74, 222, 128, 0.1)' : 'var(--accent-light)',
              borderColor: copied ? 'var(--success)' : 'var(--accent)',
              color: copied ? 'var(--success)' : 'var(--accent)',
            }}
          >
            {copied ? '✓ Copiado' : '📋 Copiar texto'}
          </button>

          {/* Descargar TXT */}
          <button
            onClick={handleDownload}
            style={{
              ...btnBase,
              background: 'var(--surface2)',
              color: 'var(--text)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            ⬇️ Descargar .txt
          </button>
        </div>

        {/* Nueva transcripción */}
        <button
          onClick={onReset}
          style={{
            ...btnBase,
            background: 'transparent',
            color: 'var(--text-muted)',
            borderColor: 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'transparent'; }}
        >
          🔄 Nueva transcripción
        </button>
      </div>
    </div>
  );
}
