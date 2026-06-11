import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Volume2, Music, Film, AlertTriangle, X, Download, Moon, Sun, History as HistoryIcon } from 'lucide-react';
import UploadZone from './components/UploadZone';
import AudioRecorder from './components/AudioRecorder';
import ProgressBar from './components/ProgressBar';
import TextEditorTTS from './components/TextEditorTTS';
import HistoryPanel from './components/HistoryPanel';
import { saveHistoryItem, getHistoryItems } from './utils/historyStorage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('stt'); // 'stt' | 'tts'
  
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [status, setStatus] = useState(null);  // { stage, message, progress, ... }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);

  const eventSourceRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const items = await getHistoryItems();
      setHistory(items);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const reset = useCallback(() => {
    setFile(null);
    setFileInfo(null);
    setStatus(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    setCurrentHistoryId(null);
    if (eventSourceRef.current) eventSourceRef.current.close();
  }, []);

  const handleFileSelected = useCallback((selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setStatus(null);
    setCurrentHistoryId(null); // New file, new history tracking
    setFileInfo(null); // Reset file info while loading

    // Extract media info
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
  }, []);

  const handleDownloadAudio = useCallback(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = file.name || 'audio.webm';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [file]);

  const handleLoadHistoryItem = useCallback((item) => {
    setFile(item.audioBlob);
    setCurrentHistoryId(item.id);
    if (item.transcription) {
      setResult(item.metadata);
    } else {
      setResult(null);
    }
    setError(item.status === 'error' ? item.errorMessage : null);
    setStatus(null);
    setShowHistory(false);
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!file || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('audio', file);

    let historyId = currentHistoryId;
    if (!historyId) {
      historyId = Date.now().toString();
      setCurrentHistoryId(historyId);
    }

    const baseHistoryItem = {
      id: historyId,
      timestamp: Date.now(),
      fileName: file.name,
      audioBlob: file,
      transcription: null,
      status: 'analyzing'
    };

    try {
      await saveHistoryItem(baseHistoryItem);
      await loadHistory();

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
                
                // Update History
                baseHistoryItem.status = 'complete';
                baseHistoryItem.transcription = data.transcription;
                baseHistoryItem.metadata = data;
                saveHistoryItem(baseHistoryItem).then(loadHistory);

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
      
      // Update History Error
      baseHistoryItem.status = 'error';
      baseHistoryItem.errorMessage = err.message || 'Error desconocido';
      saveHistoryItem(baseHistoryItem).then(loadHistory);
    }
  }, [file, isProcessing, currentHistoryId]);

  const handleCancel = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    reset();
  }, [reset]);

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : null;
  const isLargeFile = file && file.size > 24 * 1024 * 1024;

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      position: 'relative',
    }}>
      {/* Header Utilities (Theme & History) */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '20px',
        display: 'flex',
        gap: '12px',
        zIndex: 50,
      }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '8px 12px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
        >
          <HistoryIcon size={18} /> Historial
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title="Cambiar tema"
          onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {showHistory && (
        <HistoryPanel 
          history={history} 
          onLoadItem={handleLoadHistoryItem} 
          onClose={() => setShowHistory(false)} 
        />
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px', background: 'var(--surface2)', padding: '6px', borderRadius: '12px', marginTop: '60px', alignSelf: 'center'
      }}>
        <button
          onClick={() => setActiveTab('stt')}
          style={{
            padding: '15px 32px', borderRadius: '8px', border: 'none',
            background: activeTab === 'stt' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'stt' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: activeTab === 'stt' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
          }}
        >
          <Mic size={18} /> Voz a Texto
        </button>
        <button
          onClick={() => setActiveTab('tts')}
          style={{
            padding: '15px 32px', borderRadius: '8px', border: 'none',
            background: activeTab === 'tts' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'tts' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: activeTab === 'tts' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
          }}
        >
          <Volume2 size={18} /> Texto a Voz
        </button>
      </div>

      {/* Contenido principal */}
      <main style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* STT TAB */}
        <div style={{ display: activeTab === 'stt' ? 'block' : 'none', flex: 1 }}>
          {!result && (
            <div className="stt-panels">
              <UploadZone
                onFileSelected={handleFileSelected}
                disabled={isProcessing}
              />
              <AudioRecorder
                onRecordComplete={handleFileSelected}
                disabled={isProcessing}
              />
            </div>
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
                {fileInfo?.type === 'video' ? <Film size={20} /> : <Music size={20} />}
                <div>
                  <p style={{ fontWeight: 500, fontSize: '14px', margin: 0 }}>
                    {fileInfo?.type === 'video' ? 'Video:' : 'Audio:'} {file.name}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0, marginTop: '2px' }}>
                    {fileInfo ? `Duración: ${fileInfo.durationText} | ` : ''}{fileSizeMB} MB
                    {isLargeFile && (
                      <span style={{ marginLeft: '8px', color: 'var(--warning)' }}>
                        — Se dividirá automáticamente
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleDownloadAudio}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: '18px',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="Descargar audio"
                ><Download size={18} /></button>
                <button
                  onClick={() => { setFile(null); setFileInfo(null); setError(null); setCurrentHistoryId(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '18px',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="Quitar archivo"
                ><X size={18} /></button>
              </div>
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
                cursor: 'pointer'
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
                  cursor: 'pointer'
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
                <AlertTriangle size={18} />
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
                  cursor: 'pointer'
                }}
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {/* Resultado */}
          {result && (
            <TextEditorTTS 
              initialText={result.transcription} 
              initialMetadata={result}
              onReset={reset}
              showReset={true}
            />
          )}
        </div>

        {/* TTS TAB */}
        <div style={{ display: activeTab === 'tts' ? 'block' : 'none', flex: 1, animation: 'fadeIn 0.3s' }}>
          <p style={{ 
            color: 'var(--text-muted)', 
            marginBottom: '20px', 
            textAlign: 'center', 
            fontSize: '15px' 
          }}>
            Escribe o pega tu texto aquí para convertirlo a audio al instante. 
            Puedes escuchar e interactuar con el texto libremente, y descargar el archivo MP3 cuando estés listo.
          </p>
          <TextEditorTTS 
            initialText="" 
            showReset={false}
          />
        </div>
      </main>

      {/* Footer */}
      <footer style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
        <p>Powered by <strong style={{ color: 'var(--text)' }}>OpenAI Whisper</strong> & <strong style={{ color: 'var(--text)' }}>Web Speech API</strong></p>
      </footer>
    </div>
  );
}
