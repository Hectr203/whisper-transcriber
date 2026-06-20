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
  const isPausedRef = useRef(false);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);

  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [useAITTS, setUseAITTS] = useState(() => localStorage.getItem('useAITTS') === 'true');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIConfig, setShowAIConfig] = useState(false);

  const activeWordRef = useRef(null);

  // Voces nativas del navegador
  const [nativeVoices, setNativeVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      if (window.speechSynthesis) {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setNativeVoices(availableVoices);
        }
      }
    };

    loadVoices();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    // Escuchar cambios locales si se actualiza la configuración general
    const key = localStorage.getItem('elevenLabsApiKey') || '';
    setElevenLabsKey(key);
  }, []);

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
    if (!text || !text.trim()) {
      return; // No hay texto para reproducir
    }

    // Stop current audio sources
    if (audioRef.current) {
       audioRef.current.pause();
       audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isPausedRef.current = false;

    const sliceBuffer = text.substring(offsetIndex);
    if (!sliceBuffer.trim()) {
      setPlayState('idle');
      setActiveCharIndex(-1);
      return;
    }

    // AI TTS / Cloud TTS Logic
    if (useAITTS) {
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
          // Leer la clave más actualizada del localStorage
          const localKey = localStorage.getItem('elevenLabsApiKey');
          const headers = { 'Content-Type': 'application/json' };
          
          if (localKey) {
             headers['X-Elevenlabs-Api-Key'] = localKey;
             const res = await fetch(`${API_BASE}/tts/elevenlabs`, {
               method: 'POST',
               headers,
               body: JSON.stringify({ text: sliceBuffer })
             });

             if (!res.ok) {
               console.warn('ElevenLabs Backend Error, cayendo a TTS nativo');
               throw new Error('ElevenLabs API failed');
             }
             audioBlob = await res.blob();
          } else {
             // Fallback a Cloud TTS gratuito (soluciona el balbuceo en Chrome a altas velocidades)
             const res = await fetch(`${API_BASE}/tts/generate`, {
               method: 'POST',
               headers,
               body: JSON.stringify({ text: sliceBuffer, lang: 'es', speed: 1 })
             });

             if (!res.ok) throw new Error('Cloud TTS API failed');
             audioBlob = await res.blob();
          }

          await saveTTSAudio(hashKey, audioBlob); // Cachéamos el audio
        }

        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.preservesPitch = true; // Asegurar que no suene como ardilla a velocidades altas
        audio.playbackRate = speedRef.current;
        audioRef.current = audio;
        
        audio.ontimeupdate = () => {
          if (audio.duration) {
             const progress = audio.currentTime / audio.duration;
             const estimatedCharIndex = Math.floor(sliceBuffer.length * progress);
             setActiveCharIndex(offsetIndex + estimatedCharIndex);
          }
        };

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
    if (!window.speechSynthesis || (window.speechSynthesis.getVoices().length === 0 && nativeVoices.length === 0)) {
      alert("Tu navegador (ej. Brave) parece estar bloqueando las voces nativas. Por favor, marca la casilla 'Usar Voz Nube' para reproducir el audio, o verifica los escudos de privacidad.");
      setPlayState('idle');
      setActiveCharIndex(-1);
      return;
    }

    // Siempre cancelar y forzar 'resume' para destrabar colas buggeadas
    window.speechSynthesis.resume();

    utteranceRef.current = null;
    setActiveCharIndex(offsetIndex);
    setPlayState('playing'); // Cambiar estado inmediatamente para feedback visual

    const utterance = new SpeechSynthesisUtterance(sliceBuffer);
    
    // Detección de Microsoft Edge
    const isEdge = window.navigator.userAgent.indexOf("Edg/") > -1;

    // Adaptación global de velocidad para TTS nativo (Chrome, Brave, etc.)
    // Los motores nativos tienden a balbucear y distorsionarse a rates muy altos.
    // Suavizamos MUCHO la curva: si en la UI pide 2.0, al motor nativo le enviamos 1.25.
    // IMPORTANTE: En Edge no aplicamos esta reducción porque sus voces nativas (Microsoft Online Natural) 
    // soportan perfectamente la velocidad x2.
    let adaptedRate = speedRef.current;
    if (!isEdge && speedRef.current > 1) {
      adaptedRate = 1 + (speedRef.current - 1) * 0.25;
    }
    
    utterance.rate = adaptedRate;
    utterance.lang = 'es-ES';

    // Usar las voces cargadas asíncronamente (soluciona problema en Chrome/Brave)
    if (nativeVoices && nativeVoices.length > 0) {
      // Priorizar voces locales de español (ej. Google español, Microsoft Sabina, etc.)
      const esVoice = nativeVoices.find(v => v.lang && typeof v.lang === 'string' && v.lang.startsWith('es') && v.localService);
      if (esVoice) {
        utterance.voice = esVoice;
      } else {
        // Fallback a cualquier voz en español si no hay locales
        const anyEsVoice = nativeVoices.find(v => v.lang && typeof v.lang === 'string' && v.lang.startsWith('es'));
        if (anyEsVoice) utterance.voice = anyEsVoice;
      }
    }

    // Al cortar el string, el index devuelto arranca en 0 nuevamente. Usamos el offsetIndex para proyectarlo visualmente.
    utterance.onboundary = (e) => {
      if (e && typeof e.charIndex === 'number') {
        setActiveCharIndex(offsetIndex + e.charIndex);
      }
    };

    // En Chrome, algunas voces remotas (Google español) NO disparan onboundary.
    // Añadimos un fallback simulado si el audio está sonando.
    let simulationInterval = null;

    utterance.onstart = () => {
      setPlayState('playing');
      
      // Simulación de lectura para Chrome si no hay eventos onboundary.
      // En Edge los eventos funcionan perfecto, así que no simulamos para evitar interferencias.
      if (!isEdge) {
        const charsPerSec = 15 * adaptedRate;
        let elapsedMs = 0;
        let lastTick = Date.now();
        
        simulationInterval = setInterval(() => {
          const now = Date.now();
          const delta = now - lastTick;
          lastTick = now;
          
          if (utteranceRef.current !== utterance) return;
          if (isPausedRef.current || window.speechSynthesis.paused) return; // Uso de ref para mayor fiabilidad
          
          elapsedMs += delta;
          const estimatedChar = Math.floor((elapsedMs / 1000) * charsPerSec);
          
          // Solo actualizamos si no hemos sobrepasado el final y si onboundary no lo ha hecho
          if (estimatedChar < sliceBuffer.length) {
             // Usaremos esto como aproximación. Si onboundary llega a dispararse, lo sobreescribirá.
             setActiveCharIndex((prev) => {
               // Si el prev index está muy adelante, asumimos que onboundary sí funciona y no lo pisamos
               if (prev > offsetIndex + estimatedChar + 10) return prev;
               return offsetIndex + estimatedChar;
             });
          }
        }, 100);
      }
    };

    utterance.onend = (e) => {
      if (simulationInterval) clearInterval(simulationInterval);
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setPlayState('idle');
      setActiveCharIndex(-1);
    };

    utterance.onerror = (e) => {
      if (simulationInterval) clearInterval(simulationInterval);
      console.error("Error en SpeechSynthesis:", e);
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setPlayState('idle');
      setActiveCharIndex(-1);
    };

    utteranceRef.current = utterance;
    
    // Llamar a speak SIN setTimeout, ya que el setTimeout pierde el contexto de "Gesto del Usuario",
    // y muchos navegadores bloquean la reproducción de audio sintético si no sucede síncronamente al clic.
    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePlay = () => {
    if (playState === 'playing') {
      if (audioRef.current && !audioRef.current.paused) {
         audioRef.current.pause();
         setPlayState('paused');
         isPausedRef.current = true;
         return;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.pause();
        setPlayState('paused');
        isPausedRef.current = true;
        return;
      }
    }

    if (playState === 'paused') {
      if (audioRef.current && audioRef.current.paused) {
         audioRef.current.play();
         setPlayState('playing');
         isPausedRef.current = false;
         return;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
        
        // Workaround para el bug de Chrome donde resume() a veces falla si el motor se quedó pegado:
        // Si después de resumir sigue sin hablar, forzamos un reset desde la posición actual
        setTimeout(() => {
           if (playState === 'paused') return;
           if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
              playFrom(activeCharIndex >= 0 ? activeCharIndex : 0);
           }
        }, 300);

        setPlayState('playing');
        isPausedRef.current = false;
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
    isPausedRef.current = false;
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
            <CheckCircle size={18} />
            <span style={{ fontWeight: 600, color: 'var(--success)' }}>Transcripción lista</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                ...btnBase,
                background: copied ? 'rgba(74, 222, 128, 0.1)' : 'var(--accent-light)',
                borderColor: copied ? 'var(--success)' : 'var(--accent)',
                color: copied ? 'var(--success)' : 'var(--accent)',
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

            {showReset && onReset && (
              <button
                type="button"
                onClick={onReset}
                style={{
                  ...btnBase,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  borderColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <RotateCcw size={14} /> Nueva transcripción
              </button>
            )}
          </div>
        </div>
      )}

      {/* Editor / Karaoke View */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
              type="range" min="0.5" max={useAITTS ? "3.0" : "2.0"} step="0.1" value={speed} 
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
              ...btnBase, background: useAITTS ? 'var(--accent-light)' : 'transparent', color: 'var(--accent)',
              borderColor: useAITTS ? 'var(--accent)' : 'var(--border)'
            }}
            title="Activar voz de alta calidad (Nube) para evitar balbuceos a altas velocidades"
          >
            <Sparkles size={14} /> Voz Nube
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
              <Settings size={16} /> Configuración de Voz en la Nube
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Activa esto para procesar el audio en la nube. <strong>¡Altamente recomendado para velocidades de x2 y x3!</strong> El audio procesado en la nube soporta altas velocidades sin "balbucear" ni cortarse.
              <br/><br/>
              <em>Si tienes configurada tu propia API Key de ElevenLabs, se usará automáticamente. De lo contrario, usaremos el motor de Google Cloud gratuito.</em>
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={useAITTS} 
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setUseAITTS(isChecked);
                    // Si desactivamos Voz Nube y la velocidad era mayor a 2, la limitamos a 2
                    if (!isChecked && speed > 2.0) {
                      handleSpeedChange(2.0);
                    }
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                Usar Voz Nube (Evita balbuceos en x2/x3)
              </label>
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
               
               // La palabra está activa si el índice actual (ya sea real o simulado) cae dentro de la palabra
               const isActive = activeCharIndex >= el.token.charIndex && activeCharIndex < (el.token.charIndex + el.token.length);
               
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

      {!initialMetadata && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                ...btnBase,
                background: copied ? 'rgba(74, 222, 128, 0.1)' : 'var(--accent-light)',
                borderColor: copied ? 'var(--success)' : 'var(--accent)',
                color: copied ? 'var(--success)' : 'var(--accent)',
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
            <button
              type="button"
              onClick={onReset}
              style={{
                ...btnBase,
                background: 'transparent',
                color: 'var(--text-muted)',
                borderColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <RotateCcw size={14} /> Nueva transcripción
            </button>
          )}
        </div>
      )}

    </div>
  );
}
