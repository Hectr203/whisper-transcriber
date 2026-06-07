import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle, Play, Pause, Square, Download, Copy, Check, FileText, RotateCcw, Loader, Settings, Sparkles } from 'lucide-react';
import { generateHash, getTTSAudio, saveTTSAudio } from '../utils/historyStorage';

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
  
  const speedRef = useRef(1);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);
  const voicesRef = useRef([]);

  // AI TTS State
  const [elevenLabsKey, setElevenLabsKey] = useState(() => localStorage.getItem('elevenLabsKey') || '');
  const [useAITTS, setUseAITTS] = useState(() => localStorage.getItem('useAITTS') === 'true');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [voicesCount, setVoicesCount] = useState(0);
  const [voicesList, setVoicesList] = useState([]);
  const [lastTTSError, setLastTTSError] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const activeWordRef = useRef(null);

  useEffect(() => { localStorage.setItem('elevenLabsKey', elevenLabsKey); }, [elevenLabsKey]);
  useEffect(() => { localStorage.setItem('useAITTS', useAITTS); }, [useAITTS]);

  // Stop synthesis when component unmounts
  useEffect(() => {
    setText(initialText);
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [initialText]);

  // Preload available voices and handle voiceschanged across browsers
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices() || [];
        voicesRef.current = v;
        setVoicesCount(v.length);
        setVoicesList(v.map(x => `${x.name || ''} (${x.lang || ''})`));
      } catch (e) {
        voicesRef.current = [];
        setVoicesCount(0);
        setVoicesList([]);
      }
    };

    loadVoices();

    const handler = () => loadVoices();
    window.speechSynthesis.addEventListener && window.speechSynthesis.addEventListener('voiceschanged', handler);

    return () => {
      window.speechSynthesis.removeEventListener && window.speechSynthesis.removeEventListener('voiceschanged', handler);
    };
  }, []);

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

  const playFrom = async (offsetIndex) => {
    console.debug('playFrom called, offsetIndex=', offsetIndex);
    if (!text || !text.trim()) {
      return; // No hay texto para reproducir
    }

    // Stop current audio sources
    if (audioRef.current) {
       audioRef.current.pause();
       audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const sliceBuffer = text.substring(offsetIndex);
    if (!sliceBuffer.trim()) {
      setPlayState('idle');
      setActiveCharIndex(-1);
      return;
    }

    // AI TTS Logic
    if (useAITTS && elevenLabsKey) {
      setPlayState('playing');
      setAiLoading(true);
      setActiveCharIndex(offsetIndex); // We won't get word boundaries with free AI easily, just start highlighting from offset

      try {
        const hashKey = await generateHash(sliceBuffer);
        const cached = await getTTSAudio(hashKey);
        
        let audioBlob;
        
        if (cached) {
          audioBlob = cached.audioBlob;
        } else {
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJcg`, { // Voice: Fin
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': elevenLabsKey
            },
            body: JSON.stringify({
              text: sliceBuffer,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
          });

          if (!res.ok) {
            console.warn('ElevenLabs API Error, cayendo a TTS nativo');
            throw new Error('ElevenLabs failed');
          }

          audioBlob = await res.blob();
          await saveTTSAudio(hashKey, audioBlob); // Cachéamos el audio
        }

        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.playbackRate = speedRef.current;
        audioRef.current = audio;
        
        audio.onended = () => {
          setPlayState('idle');
          setActiveCharIndex(-1);
        };
        
        await audio.play();
        setAiLoading(false);
        return; // Success, don't execute native fallback
      } catch (err) {
        console.error(err);
        setAiLoading(false);
        // Continuar con fallback nativo
      }
    }

    // Fallback TTS Nativo
    if (!window.speechSynthesis) {
      return alert("Tu navegador no soporta TTS nativo.");
    }

    // Siempre cancelar y forzar 'resume' para destrabar colas buggeadas
    window.speechSynthesis.resume();

    utteranceRef.current = null;
    setActiveCharIndex(offsetIndex);
    setPlayState('playing'); // Cambiar estado inmediatamente para feedback visual

    // Helpers: dividir en trozos manejables para evitar errores de síntesis en algunos navegadores
    const chunkText = (str, maxLen = 220) => {
      const sentences = str.split(/([.!?]\s+)/);
      const chunks = [];
      let buffer = '';
      for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i];
        if ((buffer + s).length > maxLen && buffer.length > 0) {
          chunks.push(buffer);
          buffer = s;
        } else {
          buffer += s;
        }
      }
      if (buffer) chunks.push(buffer);
      // If still too long chunks, force split
      return chunks.flatMap(c => c.length > maxLen ? c.match(new RegExp('.{1,' + maxLen + '}', 'g')) : [c]);
    };

    const voices = (voicesRef.current && voicesRef.current.length > 0)
      ? voicesRef.current
      : (window.speechSynthesis.getVoices() || []);

    // Helper: generar con ElevenLabs y reproducir (reutiliza cache)
    const generateAIAndPlay = async (textToSpeak) => {
      if (!textToSpeak || !textToSpeak.trim()) return;
      setAiLoading(true);
      setPlayState('playing');
      try {
        const hashKey = await generateHash(textToSpeak);
        const cached = await getTTSAudio(hashKey);
        let audioBlob;
        if (cached) {
          audioBlob = cached.audioBlob;
        } else {
          if (!elevenLabsKey) throw new Error('No ElevenLabs API key');
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJcg`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': elevenLabsKey
            },
            body: JSON.stringify({ text: textToSpeak, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
          });
          if (!res.ok) throw new Error('ElevenLabs failed');
          audioBlob = await res.blob();
          await saveTTSAudio(hashKey, audioBlob);
        }

        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.playbackRate = speedRef.current;
        audioRef.current = audio;
        return new Promise((resolve, reject) => {
          audio.onended = () => { setPlayState('idle'); setActiveCharIndex(-1); resolve(); };
          audio.onerror = (e) => { reject(e); };
          audio.play().catch(reject);
        });
      } finally {
        setAiLoading(false);
      }
    };

    // Fallback al backend local si la síntesis nativa falla y no hay ElevenLabs
    const generateBackendAndPlay = async (textToSpeak) => {
      if (!textToSpeak || !textToSpeak.trim()) return;
      setPlayState('playing');
      try {
        const res = await fetch(`${API_BASE}/tts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSpeak, lang: 'es', speed: speedRef.current })
        });
        if (!res.ok) throw new Error('Backend TTS failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = speedRef.current;
        audioRef.current = audio;
        return new Promise((resolve, reject) => {
          audio.onended = () => { setPlayState('idle'); setActiveCharIndex(-1); resolve(); };
          audio.onerror = (e) => { reject(e); };
          audio.play().catch(reject);
        });
      } finally {
        // nothing
      }
    };

    // Si no hay voces detectadas en el navegador, evitar usar Web Speech API
    // y usar fallback directo (ElevenLabs o backend) para evitar bloqueo en Brave/Chromium.
    if (!voices || voices.length === 0) {
      console.warn('No hay voces detectadas en el navegador, usando fallback de audio.');
      setLastTTSError('no-voices-detected');
      // Preferir ElevenLabs si está activado y hay key
      const remainingAll = sliceBuffer;
      if (useAITTS && elevenLabsKey) {
        try {
          await generateAIAndPlay(remainingAll);
          return;
        } catch (aiErr) {
          console.error('ElevenLabs fallback failed:', aiErr);
          setLastTTSError(aiErr && aiErr.message ? aiErr.message : 'AI fallback failed');
        }
      }

      // Intentar backend local
      try {
        await generateBackendAndPlay(remainingAll);
        return;
      } catch (beErr) {
        console.error('Backend fallback failed:', beErr);
        setLastTTSError(beErr && beErr.message ? beErr.message : 'Backend fallback failed');
        setPlayState('idle');
        setActiveCharIndex(-1);
        return;
      }
    }

    const selectVoice = () => {
      if (!voices || voices.length === 0) return null;
      let esVoice = voices.find(v => v.lang && typeof v.lang === 'string' && v.lang.toLowerCase().startsWith('es'));
      if (!esVoice) esVoice = voices.find(v => v.name && /google|microsoft|chrome/i.test(v.name));
      return esVoice || voices[0] || null;
    };

    const chunks = chunkText(sliceBuffer, 220);
    let cumulativeOffset = 0;

    const speakChunk = (chunk, attempt = 0) => {
      return new Promise((resolve, reject) => {
        try {
          const u = new SpeechSynthesisUtterance(chunk);
          u.rate = speedRef.current;
          u.lang = 'es-ES';
          const voice = selectVoice();
          if (voice) u.voice = voice;

          u.onboundary = (e) => {
            if (e && typeof e.charIndex === 'number') {
              setActiveCharIndex(offsetIndex + cumulativeOffset + e.charIndex);
            }
          };

          u.onstart = () => {
            utteranceRef.current = u;
            setPlayState('playing');
          };

          u.onend = () => {
            if (utteranceRef.current !== u) { resolve(); return; }
            utteranceRef.current = null;
            cumulativeOffset += chunk.length;
            resolve();
          };

          u.onerror = (e) => {
            console.error('SpeechSynthesis chunk error:', e, {chunkLen: chunk.length, attempt});
            utteranceRef.current = null;
            // Retry once with no voice assigned (some engines choke on certain voices)
            if (attempt === 0) {
              try {
                const retryUtter = new SpeechSynthesisUtterance(chunk);
                retryUtter.rate = speedRef.current;
                retryUtter.lang = 'es-ES';
                retryUtter.onend = () => { cumulativeOffset += chunk.length; resolve(); };
                retryUtter.onerror = (err2) => { console.error('Retry failed:', err2); reject(err2); };
                window.speechSynthesis.speak(retryUtter);
                utteranceRef.current = retryUtter;
                return;
              } catch (e2) {
                console.error('Retry speak threw:', e2);
              }
            }
            reject(e);
          };

          window.speechSynthesis.speak(u);
        } catch (err) {
          console.error('speakChunk exception', err);
          reject(err);
        }
      });
    };

    

    // Ejecutar los chunks: hablar el primer chunk sincrónicamente (preserva gesto de usuario)
    if (!chunks || chunks.length === 0) {
      setPlayState('idle');
      setActiveCharIndex(-1);
      return;
    }

    const queue = chunks.slice();
    let stopped = false;

    const finishAll = () => {
      stopped = true;
      utteranceRef.current = null;
      setPlayState('idle');
      setActiveCharIndex(-1);
    };

    const speakNextSync = (attempt = 0) => {
      if (stopped) return;
      if (queue.length === 0) { finishAll(); return; }
      const chunk = queue.shift();
      try {
        const u = new SpeechSynthesisUtterance(chunk);
        u.rate = speedRef.current;
        u.lang = 'es-ES';
        const voice = selectVoice();
        if (voice) u.voice = voice;

        u.onboundary = (e) => {
          if (e && typeof e.charIndex === 'number') {
            setActiveCharIndex(offsetIndex + cumulativeOffset + e.charIndex);
          }
        };

        u.onstart = () => {
          utteranceRef.current = u;
          setPlayState('playing');
        };

        u.onend = async () => {
          if (utteranceRef.current !== u) return;
          utteranceRef.current = null;
          cumulativeOffset += chunk.length;
          // Si quedan chunks, hablar el siguiente (esto ocurre desde evento onend, por lo que está permitido)
          if (queue.length > 0) {
            speakNextSync(0);
            return;
          }
          finishAll();
        };

        u.onerror = async (e) => {
          console.error('SpeechSynthesis chunk error (sync):', e, { chunkLen: chunk.length, attempt });
          utteranceRef.current = null;
          setLastTTSError(e && e.error ? e.error : (e && e.message) || 'synthesis-failed');
          // Intentar reintento simple con la misma chunk sin voice
          if (attempt === 0) {
            try {
              const retry = new SpeechSynthesisUtterance(chunk);
              retry.rate = speedRef.current;
              retry.lang = 'es-ES';
              retry.onend = () => { cumulativeOffset += chunk.length; if (queue.length > 0) speakNextSync(0); else finishAll(); };
              retry.onerror = (err2) => { console.error('Retry failed (sync):', err2); };
              window.speechSynthesis.speak(retry);
              utteranceRef.current = retry;
              return;
            } catch (e2) {
              console.error('Retry speak threw (sync):', e2);
            }
          }

          // Si falla, intentar fallback en este orden: ElevenLabs -> Backend TTS -> terminar
          const remaining = sliceBuffer.substring(cumulativeOffset);
          if (elevenLabsKey) {
            try {
              await generateAIAndPlay(remaining);
              return;
            } catch (aiErr) {
              console.error('AI fallback also failed (sync):', aiErr);
              setLastTTSError(aiErr && aiErr.message ? aiErr.message : 'AI fallback failed');
            }
          }

          // Intentar backend local
          try {
            await generateBackendAndPlay(remaining);
            return;
          } catch (beErr) {
            console.error('Backend fallback also failed (sync):', beErr);
            setLastTTSError(beErr && beErr.message ? beErr.message : 'Backend fallback failed');
          }

          finishAll();
        };

        // Llamada sincrónica en el mismo stack del click para preservar permiso de usuario
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.error('speakNextSync exception', err);
        finishAll();
      }
    };

    // Iniciar la cadena (primera llamada ocurre sincrónicamente)
    speakNextSync(0);
  };

  const handleTogglePlay = () => {
    console.debug('handleTogglePlay clicked, playState=', playState);
    if (playState === 'playing') {
      if (audioRef.current && !audioRef.current.paused) {
         audioRef.current.pause();
         setPlayState('paused');
         return;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.pause();
        setPlayState('paused');
        return;
      }
    }

    if (playState === 'paused') {
      if (audioRef.current && audioRef.current.paused) {
         audioRef.current.play();
         setPlayState('playing');
         return;
      }
      if (window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPlayState('playing');
        return;
      }
    }

    playFrom(activeCharIndex >= 0 ? activeCharIndex : 0);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setPlayState('idle');
    setActiveCharIndex(-1);
  };

  // Cuando cambie la velocidad interactiva, si está play lo actualizamos on the fly seamless
  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    speedRef.current = newSpeed;
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
    if (playState === 'playing' && activeCharIndex >= 0 && (!audioRef.current || audioRef.current.paused)) {
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
            <CheckCircle size={18} />
            <span style={{ fontWeight: 600, color: 'var(--success)' }}>Transcripción lista</span>
          </div>
        </div>
      )}

      {/* Editor / Karaoke View */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {/* Nota de compatibilidad */}
        <div style={{
          padding: '10px 16px', marginBottom: '10px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
          border: '1px solid rgba(148,163,184,0.2)', fontSize: '13px'
        }}>
          Compatible con <strong>Microsoft Edge</strong> y <strong>Brave</strong>. Chrome aún no es totalmente compatible.
        </div>

        {/* TTS Advance Controls */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface2)', 
          padding: '12px 16px', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap'
        }}>
          {/* Resume/Pause/Play */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={aiLoading}
            style={{
              ...btnBase,
              background: playState === 'playing' ? 'var(--warning)' : 'var(--success)',
              color: '#000', borderColor: 'transparent', fontWeight: 600,
              opacity: aiLoading ? 0.6 : 1,
            }}
          >
            {aiLoading ? <><Loader size={14} className="spin" /> Generando IA...</> : 
             (playState === 'playing' ? <><Pause size={14} /> Pausar lectura</> : (playState==='paused' ? <><Play size={14} /> Reanudar</> : <><Play size={14} /> Iniciar</>))}
          </button>

          {playState !== 'idle' && (
             <button 
                type="button"
                onClick={handleStop}
                style={{ ...btnBase, background: 'var(--error)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}
             >
               <Square size={14} /> Detener
             </button>
          )}
          
          {/* Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', marginLeft: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Vel:</span>
            <input 
              id="tts-speed"
              name="ttsSpeed"
              type="range" min="0.5" max="3.0" step="0.1" value={speed} 
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              style={{ accentColor: 'var(--accent)', minWidth: '80px' }}
            />
            <span style={{ fontSize: '14px', width: '35px' }}>{speed}x</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Botón para Mostrar Config AI */}
          <button 
            type="button"
            onClick={() => setShowAIConfig(!showAIConfig)}
            style={{
              ...btnBase, background: useAITTS && elevenLabsKey ? 'var(--accent-light)' : 'transparent', color: 'var(--accent)',
              borderColor: useAITTS && elevenLabsKey ? 'var(--accent)' : 'var(--border)'
            }}
          >
            <Sparkles size={14} /> Voz IA
          </button>

          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            style={{ ...btnBase, background: showDiagnostics ? 'var(--surface2)' : 'transparent', color: 'var(--text)' }}
          >
            <Settings size={14} /> Diagnóstico
          </button>

          <button
            type="button"
            onClick={async () => {
              if (!text.trim()) return;
              if (!elevenLabsKey) return alert('Agrega tu API Key de ElevenLabs en Configuración IA');
              setAiLoading(true);
              try { await (async () => {
                const hashKey = await generateHash(text);
                const cached = await getTTSAudio(hashKey);
                if (cached) {
                  const url = URL.createObjectURL(cached.audioBlob);
                  const a = new Audio(url); a.playbackRate = speedRef.current; audioRef.current = a; await a.play();
                } else {
                  await generateAIAndPlay(text);
                }
              })();
              } catch (e) { console.error('Force AI failed', e); alert('Falló generación IA'); }
              finally { setAiLoading(false); }
            }}
            style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted)' }}
          >
            <Play size={14} /> Forzar IA
          </button>

          <button 
            type="button"
            onClick={handleDownloadAudio}
            disabled={isDownloading || !text.trim()}
            style={{
              ...btnBase, background: 'var(--accent)', color: '#fff', borderColor: 'transparent',
              opacity: (isDownloading || !text.trim()) ? 0.6 : 1,
            }}
          >
            {isDownloading ? <><Loader size={14} /> Modulando MP3...</> : <><Download size={14} /> Bajar Audio</>}
          </button>
        </div>

        {/* Panel de Configuración IA */}
        {showAIConfig && (
          <div style={{
            background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
            padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.2s'
          }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)' }}>
              <Settings size={16} /> Configuración de Voz IA (ElevenLabs)
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Usa el API gratuito de ElevenLabs para una voz realista superior. Si falla o se acaban los créditos, 
              automáticamente volveremos a la voz del navegador.
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input 
                type="password" 
                placeholder="Ingresa tu API Key de ElevenLabs" 
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', minWidth: '300px', flex: 1
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={useAITTS} 
                  onChange={(e) => setUseAITTS(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                Activar Voz IA
              </label>
            </div>
          </div>
        )}

        {/* Panel de Diagnóstico */}
        {showDiagnostics && (
          <div style={{
            background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: '8px',
            padding: '12px', marginTop: '12px', fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Diagnóstico TTS</strong>
              <small style={{ opacity: 0.8 }}>{voicesCount} voces detectadas</small>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div><strong>Último error:</strong> <span style={{ color: 'salmon' }}>{lastTTSError || '—'}</span></div>
              <details style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer' }}>Lista de voces</summary>
                <ul style={{ margin: '8px 0 0 16px' }}>
                  {voicesList.length ? voicesList.map((v, i) => <li key={i}>{v}</li>) : <li>No hay voces</li>}
                </ul>
              </details>
            </div>
          </div>
        )}

        {playState !== 'idle' ? (
          <div style={{
            width: '100%', minHeight: '60vh', maxHeight: '80vh', overflowY: 'auto',
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
              width: '100%', minHeight: '60vh', maxHeight: '80vh', background: 'var(--bg)',
              color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '16px', fontSize: '15px', lineHeight: 1.8, resize: 'vertical', outline: 'none',
            }}
          />
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              ...btnBase, background: copied ? 'rgba(74, 222, 128, 0.1)' : 'var(--accent-light)',
              borderColor: copied ? 'var(--success)' : 'var(--accent)', color: copied ? 'var(--success)' : 'var(--accent)'
            }}
          >
            {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar transcripción</>}
          </button>
          
          <button
            type="button"
            onClick={handleDownloadTxt}
            style={{ ...btnBase, background: 'transparent', color: 'var(--text)' }}
          >
            <FileText size={14} /> Descargar .txt
          </button>
        </div>

        {showReset && onReset && (
          <button type="button" onClick={onReset} style={{...btnBase, background: 'transparent', color: 'var(--text-muted)', borderColor: 'transparent'}}>
            <RotateCcw size={14} /> Nueva transcripción
          </button>
        )}
      </div>
    </div>
  );
}
