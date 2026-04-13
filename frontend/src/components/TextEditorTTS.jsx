import React, { useState, useEffect, useMemo, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Sub-componente memoizado para máximo rendimiento al cambiar el activeIndex
const WordToken = React.memo(({ token, isActive, onClick }) => {
  return (
    <span
      onClick={() => onClick(token.charIndex)}
      style={{
        cursor: 'pointer',
        padding: '2px 4px',
        borderRadius: '4px',
        backgroundColor: isActive ? 'var(--accent, #6c63ff)' : 'transparent',
        color: isActive ? '#fff' : 'inherit',
        boxShadow: isActive ? '0 2px 6px rgba(108, 99, 255, 0.4)' : 'none',
        opacity: isActive ? 1 : 0.7,
        transition: 'all 0.1s ease-in',
      }}
      title="Clic para reproducir desde aquí"
    >
      {token.word}
    </span>
  );
});

export default function TextEditorTTS({ initialText = '', onReset, showReset = false, initialMetadata = null }) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const [playState, setPlayState] = useState('idle'); // 'idle' | 'playing' | 'paused'
  const [speed, setSpeed] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Guardamos un ref para leer la velocidad actualizada dentro de eventos asincronos si fuera necesario
  const speedRef = useRef(1);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const isCancelIntent = useRef(false);

  const activeWordRef = useRef(null);

  // Stop synthesis when component unmounts
  useEffect(() => {
    setText(initialText);
    return () => {
      isCancelIntent.current = true;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [initialText]);

  // Actualizar ref speed
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Manejo de tokens y posiciones
  const tokens = useMemo(() => {
    let result = [];
    let regex = /([\wáéíóúüñÁÉÍÓÚÜÑ]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      result.push({
        word: match[0],
        charIndex: match.index,
        length: match[0].length
      });
    }
    return result;
  }, [text]);

  const parsedElements = useMemo(() => {
    let result = [];
    let lastIndex = 0;
    
    tokens.forEach(t => {
       if (t.charIndex > lastIndex) {
          result.push({ type: 'text', val: text.substring(lastIndex, t.charIndex), key: `t_${lastIndex}` });
       }
       result.push({ type: 'word', token: t, key: `w_${t.charIndex}` });
       lastIndex = t.charIndex + t.length;
    });
    if (lastIndex < text.length) {
       result.push({ type: 'text', val: text.substring(lastIndex), key: `t_${lastIndex}` });
    }
    return result;
  }, [text, tokens]);


  const jumpToOffset = (offset) => {
    playFrom(offset);
  };

  const playFrom = (offsetIndex) => {
    if (!window.speechSynthesis) return alert("Tu navegador no soporta TTS nativo.");
    if (!text.trim()) return;

    window.speechSynthesis.cancel();
    setActiveCharIndex(offsetIndex);
    
    const sliceBuffer = text.substring(offsetIndex);
    if (!sliceBuffer.trim()) {
      setPlayState('idle');
      setActiveCharIndex(-1);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sliceBuffer);
    utterance.rate = speedRef.current;
    utterance.lang = 'es-ES';
    
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;

    // Al cortar el string, el index devuelto arranca en 0 nuevamente. Usamos el offsetIndex para proyectarlo visualmente.
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
         setActiveCharIndex(offsetIndex + e.charIndex);
      }
    };

    utterance.onend = () => {
      if (isCancelIntent.current) {
         isCancelIntent.current = false;
      } else {
         setPlayState('idle');
         setActiveCharIndex(-1);
      }
    };
    
    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
         setPlayState('idle');
         setActiveCharIndex(-1);
      }
    };

    window.speechSynthesis.speak(utterance);
    setPlayState('playing');
  };

  const handleTogglePlay = () => {
    if (playState === 'playing') {
       isCancelIntent.current = true;
       window.speechSynthesis.cancel();
       setPlayState('paused'); // Se queda en paused con el charIndex original
    } else if (playState === 'paused' && activeCharIndex >= 0) {
       playFrom(activeCharIndex);
    } else {
       playFrom(0);
    }
  };

  const handleStop = () => {
    isCancelIntent.current = true;
    window.speechSynthesis.cancel();
    setPlayState('idle');
    setActiveCharIndex(-1);
  };

  // Cuando cambie la velocidad interactiva, si está play lo actualizamos on the fly seamless
  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    speedRef.current = newSpeed;
    if (playState === 'playing' && activeCharIndex >= 0) {
      playFrom(activeCharIndex);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2500); 
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${initialMetadata?.fileName?.replace(/\.[^.]+$/, '') || 'documento'}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDownloadAudio = async () => {
    if (!text.trim()) return;
    try {
      setIsDownloading(true);
      const res = await fetch(`${API_BASE}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: 'es', speed })
      });

      if (!res.ok) throw new Error('Error al generar audio');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_${speed}x.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Hubo un error al generar el archivo de audio MP3.');
    } finally {
      setIsDownloading(false);
    }
  };

  const btnBase = {
    padding: '10px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center',
    gap: '7px', transition: 'all 0.2s', cursor: 'pointer',
  };

  return (
    <div style={{
      marginTop: '24px', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      {initialMetadata && (
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span style={{ fontWeight: 600, color: 'var(--success)' }}>Transcripción lista</span>
          </div>
        </div>
      )}

      {/* Editor / Karaoke View */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {playState !== 'idle' ? (
          <div style={{
            width: '100%', minHeight: '200px', maxHeight: '400px', overflowY: 'auto',
            background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)', padding: '16px', fontSize: '18px', lineHeight: 2,
            whiteSpace: 'pre-wrap', fontFamily: 'Inter, system-ui, sans-serif'
          }}>
            {parsedElements.map((el) => {
               if (el.type === 'text') return <span key={el.key} style={{opacity: 0.6}}>{el.val}</span>;
               const isActive = el.token.charIndex === activeCharIndex;
               return (
                 <WordToken 
                    key={el.key} 
                    token={el.token} 
                    isActive={isActive} 
                    onClick={jumpToOffset}
                 />
               );
            })}
          </div>
        ) : (
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu texto..."
            style={{
              width: '100%', minHeight: '200px', maxHeight: '400px', background: 'var(--bg)',
              color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '16px', fontSize: '15px', lineHeight: 1.8, resize: 'vertical', outline: 'none',
            }}
          />
        )}

        {/* TTS Advance Controls */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface2)', 
          padding: '12px 16px', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap'
        }}>
          {/* Resume/Pause/Play */}
          <button 
            onClick={handleTogglePlay}
            style={{
              ...btnBase,
              background: playState === 'playing' ? 'var(--warning)' : 'var(--success)',
              color: '#000', borderColor: 'transparent', fontWeight: 600,
            }}
          >
            {playState === 'playing' ? '⏸️ Pausar lectura' : (playState==='paused' ? '▶️ Reanudar' : '▶️ Iniciar')}
          </button>

          {playState !== 'idle' && (
             <button 
                onClick={handleStop}
                style={{ ...btnBase, background: 'var(--error)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}
             >
               ⏹️ Detener
             </button>
          )}
          
          {/* Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', marginLeft: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Vel:</span>
            <input 
              type="range" min="0.5" max="3.0" step="0.1" value={speed} 
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              style={{ accentColor: 'var(--accent)', minWidth: '80px' }}
            />
            <span style={{ fontSize: '14px', width: '35px' }}>{speed}x</span>
          </div>

          <div style={{ flex: 1 }} />

          <button 
            onClick={handleDownloadAudio}
            disabled={isDownloading || !text.trim()}
            style={{
              ...btnBase, background: 'var(--accent)', color: '#fff', borderColor: 'transparent',
              opacity: (isDownloading || !text.trim()) ? 0.6 : 1,
            }}
          >
            {isDownloading ? '⏳ Modulando MP3...' : '⬇️ Bajar Audio'}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleCopy}
            style={{
              ...btnBase, background: copied ? 'rgba(74, 222, 128, 0.1)' : 'var(--accent-light)',
              borderColor: copied ? 'var(--success)' : 'var(--accent)', color: copied ? 'var(--success)' : 'var(--accent)'
            }}
          >
            {copied ? '✓ Copiado' : '📋 Copiar transcripción'}
          </button>
          
          <button
            onClick={handleDownloadTxt}
            style={{ ...btnBase, background: 'transparent', color: 'var(--text)' }}
          >
            📄 Descargar .txt
          </button>
        </div>

        {showReset && onReset && (
          <button onClick={onReset} style={{...btnBase, background: 'transparent', color: 'var(--text-muted)', borderColor: 'transparent'}}>
            🔄 Nueva transcripción
          </button>
        )}
      </div>
    </div>
  );
}
