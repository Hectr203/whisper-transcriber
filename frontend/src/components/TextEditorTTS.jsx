import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle, Play, Pause, Square, Download, Copy, Check, FileText, RotateCcw, Loader, Settings, Sparkles, User, Settings2, Trash2 } from 'lucide-react';
import { generateHash, getTTSAudio, saveTTSAudio } from '../utils/historyStorage';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const WordToken = React.memo(({ token, isActive, onClick }) => {
  return (
    <span
      onClick={() => onClick(token.charIndex)}
      className={`cursor-pointer px-1 py-0.5 rounded transition-all duration-100 ${
        isActive 
          ? 'bg-primary-500 text-white shadow-md scale-105 inline-block opacity-100' 
          : 'hover:bg-primary-50 dark:hover:bg-primary-900/30 opacity-80 hover:opacity-100'
      }`}
      title="Clic para reproducir desde aquí"
    >
      {token.word}
    </span>
  );
});

export default function TextEditorTTS({ 
  initialText = '', 
  isProcessing = false, 
  status = null, 
  onReset = null, 
  showReset = true,
  initialMetadata = null,
  aiProvider = 'nvidia',
  setAiProvider = () => {},
  onRequestApiKeys = () => {}
}) {
  const [text, setText] = useState(initialText);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playState, setPlayState] = useState('idle'); 
  const [speed, setSpeed] = useState(2);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  
  const speedRef = useRef(2);
  const isPausedRef = useRef(false);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);
  const markdownRef = useRef(null);

  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [useAITTS, setUseAITTS] = useState(() => localStorage.getItem('useAITTS') === 'true');
  const [cloudProvider, setCloudProvider] = useState(() => localStorage.getItem('cloudProvider') || 'elevenlabs');
  const [aiLoading, setAiLoading] = useState(false);
  const [showIncompatibleModal, setShowIncompatibleModal] = useState(false);

  const [nativeVoices, setNativeVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');

  useEffect(() => {
    const loadVoices = () => {
      if (window.speechSynthesis) {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setNativeVoices(availableVoices);
          if (!selectedVoiceURI) {
            const browserLang = window.navigator.language || 'es-ES';
            const baseLang = browserLang.split('-')[0];
            
            // 1. Try exact match with browser lang and local service
            let defaultVoice = availableVoices.find(v => v.lang === browserLang && v.localService);
            
            // 2. Try match with base lang (e.g., 'es') and local service
            if (!defaultVoice) {
              defaultVoice = availableVoices.find(v => v.lang.startsWith(baseLang) && v.localService);
            }
            
            // 3. Fallback to any 'es' voice
            if (!defaultVoice) {
              defaultVoice = availableVoices.find(v => v.lang.startsWith('es'));
            }
            
            // 4. Fallback to any local or just the first one
            if (!defaultVoice) {
              defaultVoice = availableVoices.find(v => v.localService) || availableVoices[0];
            }
            
            if (defaultVoice) setSelectedVoiceURI(defaultVoice.voiceURI);
          }
        }
      }
    };
    loadVoices();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceURI]);

  useEffect(() => {
    const key = localStorage.getItem('elevenLabsApiKey') || '';
    setElevenLabsKey(key);
  }, []);

  useEffect(() => { 
    localStorage.setItem('useAITTS', useAITTS); 
    localStorage.setItem('cloudProvider', cloudProvider);
  }, [useAITTS, cloudProvider]);

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

  useEffect(() => { speedRef.current = speed; }, [speed]);

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

  // Encuentra el índice de la palabra activa actual
  const activeTokenIndex = useMemo(() => {
    if (activeCharIndex < 0) return -1;
    let idx = tokens.findIndex(t => activeCharIndex >= t.charIndex && activeCharIndex < (t.charIndex + t.length));
    if (idx === -1) {
       idx = tokens.findIndex(t => t.charIndex > activeCharIndex);
       if (idx > 0) return idx - 1;
       if (idx === -1 && tokens.length > 0) return tokens.length - 1;
    }
    return idx;
  }, [activeCharIndex, tokens]);

  // Efecto para resaltar la palabra en modo Markdown usando CSS Custom Highlight API
  useEffect(() => {
    if (!window.CSS || !CSS.highlights) return; // Fallback si no está soportado (Chrome 105+, Safari 17.2+, Firefox 126+)
    
    if (!isMarkdownMode || activeTokenIndex === -1 || !markdownRef.current) {
      CSS.highlights.delete('tts-highlight');
      return;
    }

    const container = markdownRef.current;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let currentWordIndex = 0;
    let node;
    const regex = /([\wáéíóúüñÁÉÍÓÚÜÑ]+)/g;
    let found = false;
    
    while ((node = walker.nextNode())) {
      let match;
      while ((match = regex.exec(node.nodeValue)) !== null) {
        if (currentWordIndex === activeTokenIndex) {
          const range = new Range();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const highlight = new Highlight(range);
          CSS.highlights.set('tts-highlight', highlight);
          found = true;
          break;
        }
        currentWordIndex++;
      }
      if (found) break;
    }
    
    if (!found) {
      CSS.highlights.delete('tts-highlight');
    }
    
    // Si la lectura va avanzando, intentamos hacer scroll hacia la palabra resaltada
    if (found && container) {
      // Como CSS.highlights no nos da el elemento fácilmente, podemos aproximar el scroll usando el contenedor
      // Esto es complejo sin mutar el DOM, pero al menos el usuario verá el highlight en la ventana.
    }
    
  }, [activeTokenIndex, isMarkdownMode]);

  const jumpToOffset = (offset) => {
    playFrom(offset);
  };

  const playFrom = async (offsetIndex) => {
    if (!text || !text.trim()) return;

    if (audioRef.current) {
       audioRef.current.pause();
       audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isPausedRef.current = false;

    const rawSlice = text.substring(offsetIndex);
    if (!rawSlice.trim()) {
      setPlayState('idle');
      setActiveCharIndex(-1);
      return;
    }

    let sliceBuffer = rawSlice;
    if (isMarkdownMode) {
      // Si estamos en modo markdown, limpiamos el texto para que la lectura sea natural
      sliceBuffer = sliceBuffer
        .replace(/[#*`_~]/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .trim();
      if (!sliceBuffer) sliceBuffer = rawSlice; // fallback
    }

    if (useAITTS) {
      setPlayState('playing');
      setAiLoading(true);
      setActiveCharIndex(offsetIndex); 

      try {
        const hashKey = await generateHash(sliceBuffer);
        const cached = await getTTSAudio(hashKey);
        
        let audioBlob;
        
        if (cached) {
          audioBlob = cached.audioBlob;
        } else {
          const localKey = localStorage.getItem('elevenLabsApiKey');
          
          const fetchGoogle = async () => {
             const res = await fetch(`${API_BASE}/tts/generate`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ text: sliceBuffer, lang: 'es', speed: 1 })
             });
             if (!res.ok) throw new Error('Google Cloud TTS API failed');
             return await res.blob();
          };

          const fetchElevenLabs = async () => {
             const res = await fetch(`${API_BASE}/tts/elevenlabs`, {
               method: 'POST',
               headers: { 
                 'Content-Type': 'application/json',
                 'X-Elevenlabs-Api-Key': localKey || ''
               },
               body: JSON.stringify({ text: sliceBuffer })
             });
             if (!res.ok) throw new Error('ElevenLabs API failed');
             return await res.blob();
          };

          if (cloudProvider === 'elevenlabs') {
             try {
               audioBlob = await fetchElevenLabs();
             } catch (err) {
               console.warn('ElevenLabs falló o no está configurado, usando Google Translate como respaldo');
               audioBlob = await fetchGoogle();
             }
          } else {
             audioBlob = await fetchGoogle();
          }
          await saveTTSAudio(hashKey, audioBlob);
        }

        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.preservesPitch = true; 
        audio.playbackRate = speedRef.current;
        audioRef.current = audio;
        
        audio.ontimeupdate = () => {
          if (audio.duration) {
             const progress = audio.currentTime / audio.duration;
             const estimatedCharIndex = Math.floor(rawSlice.length * progress);
             setActiveCharIndex(offsetIndex + estimatedCharIndex);
          }
        };

        audio.onended = () => {
          setPlayState('idle');
          setActiveCharIndex(-1);
        };
        
        await audio.play();
        setAiLoading(false);
        return; 
      } catch (err) {
        console.error(err);
        setAiLoading(false);
        alert('Hubo un error con los servicios de nube. Por favor, asegúrese de configurar su propia API Key de ElevenLabs en las configuraciones para evitar este problema.');
      }
    }

    if (!window.speechSynthesis || (window.speechSynthesis.getVoices().length === 0 && nativeVoices.length === 0)) {
      setShowIncompatibleModal(true);
      setPlayState('idle');
      setActiveCharIndex(-1);
      return;
    }

    window.speechSynthesis.resume();

    utteranceRef.current = null;
    setActiveCharIndex(offsetIndex);
    setPlayState('playing'); 

    const utterance = new SpeechSynthesisUtterance(sliceBuffer);
    const isEdge = window.navigator.userAgent.indexOf("Edg/") > -1;

    let adaptedRate = speedRef.current;
    if (!isEdge && speedRef.current > 1) {
      adaptedRate = 1 + (speedRef.current - 1) * 0.25;
    }
    
    utterance.rate = adaptedRate;
    utterance.lang = 'es-ES';

    if (nativeVoices && nativeVoices.length > 0) {
      if (selectedVoiceURI) {
        const selected = nativeVoices.find(v => v.voiceURI === selectedVoiceURI);
        if (selected) utterance.voice = selected;
      } else {
        const esVoice = nativeVoices.find(v => v.lang && typeof v.lang === 'string' && v.lang.startsWith('es') && v.localService);
        if (esVoice) utterance.voice = esVoice;
        else {
          const anyEsVoice = nativeVoices.find(v => v.lang && typeof v.lang === 'string' && v.lang.startsWith('es'));
          if (anyEsVoice) utterance.voice = anyEsVoice;
        }
      }
    }

    utterance.onboundary = (e) => {
      if (e && typeof e.charIndex === 'number') {
        setActiveCharIndex(offsetIndex + e.charIndex);
      }
    };

    let simulationInterval = null;

    utterance.onstart = () => {
      setPlayState('playing');
      if (!isEdge) {
        const charsPerSec = 15 * adaptedRate;
        let elapsedMs = 0;
        let lastTick = Date.now();
        
        simulationInterval = setInterval(() => {
          const now = Date.now();
          const delta = now - lastTick;
          lastTick = now;
          
          if (utteranceRef.current !== utterance) return;
          if (isPausedRef.current || window.speechSynthesis.paused) return; 
          
          elapsedMs += delta;
          const estimatedChar = Math.floor((elapsedMs / 1000) * charsPerSec);
          
          if (estimatedChar < rawSlice.length) {
             setActiveCharIndex((prev) => {
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
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error("Error en SpeechSynthesis:", e);
      }
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setPlayState('idle');
      setActiveCharIndex(-1);
    };

    utteranceRef.current = utterance;
    window.speechSynthesisUtterance = utterance; // Prevenir Garbage Collection bug en Chrome
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

  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    speedRef.current = newSpeed;
    if (audioRef.current) audioRef.current.playbackRate = newSpeed;
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

  const handleDownloadText = (format) => {
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcripcion.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImprove = async (mode) => {
    if (!text.trim()) {
      alert("El texto está vacío.");
      return;
    }
    
    try {
      setIsImproving(true);
      
      const headers = { 'Content-Type': 'application/json' };
      const groqKey = localStorage.getItem('groqApiKey');
      const nvidiaKey = localStorage.getItem('nvidiaApiKey');
      if (groqKey) headers['x-groq-api-key'] = groqKey;
      if (nvidiaKey) headers['x-nvidia-api-key'] = nvidiaKey;

      const res = await fetch(`${API_BASE}/improve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, operation: mode, provider: aiProvider })
      });
      
      if (res.ok) {
        const data = await res.json();
        setText(data.result);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.message && errData.message.includes('MISSING_API_KEY')) {
          onRequestApiKeys();
          alert("Por favor configura tu API Key de NVIDIA para usar el asistente.");
        } else {
          alert("Error al mejorar el texto: " + (errData.message || errData.error || "Desconocido"));
        }
      }
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error de red al intentar mejorar el texto.");
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in h-full min-h-0">
      
      {/* 2-Column Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch h-full min-h-0">
        
        {/* Left Column: Editor */}
        <div className="flex-1 flex flex-col bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          {/* Header & Toolbar */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex justify-between items-center">
              <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <FileText size={16} /> Contenido del manuscrito
              </h4>
              <span className="text-xs font-bold text-slate-400 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md shadow-sm">
                {text.length} / 5,000
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center justify-between">
               <div className="flex gap-2">
                 <button onClick={() => handleDownloadText('txt')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-colors shadow-sm" title="Descargar como TXT">
                   <Download size={14} /> TXT
                 </button>
                 <button onClick={() => handleDownloadText('md')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-colors shadow-sm" title="Descargar como Markdown">
                   <Download size={14} /> MD
                 </button>
               </div>

               <div className="flex gap-2">
                 <button onClick={() => setText('')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 dark:text-slate-400 rounded-lg transition-colors">
                   <Trash2 size={14} /> Limpiar
                 </button>
                 <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg transition-colors ${copied ? 'text-green-600 border-green-200 bg-green-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                   {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
                 </button>
                 {showReset && onReset && (
                    <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors" title="Nueva transcripción">
                      <RotateCcw size={14} /> Nueva
                    </button>
                 )}
                 <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                 <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-400 select-none">
                   <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isMarkdownMode ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                     <input 
                       type="checkbox" 
                       checked={isMarkdownMode} 
                       onChange={(e) => setIsMarkdownMode(e.target.checked)}
                       className="sr-only"
                     />
                     <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isMarkdownMode ? 'translate-x-4' : 'translate-x-1'}`} />
                   </div>
                   Vista Markdown
                 </label>
               </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 relative">
            {isMarkdownMode ? (
              <div 
                ref={markdownRef}
                className="absolute inset-0 p-4 w-full h-full overflow-y-auto text-slate-800 dark:text-slate-200 prose prose-sm sm:prose-base prose-slate dark:prose-invert max-w-none bg-transparent"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </div>
            ) : playState !== 'idle' ? (
              <div className="absolute inset-0 p-4 overflow-y-auto text-slate-800 dark:text-slate-200 text-lg leading-loose font-sans bg-transparent whitespace-pre-wrap">
                {parsedElements.map((el) => {
                   if (el.type === 'text') return <span key={el.key} className="opacity-70">{el.val}</span>;
                   const isActive = activeCharIndex >= el.token.charIndex && activeCharIndex < (el.token.charIndex + el.token.length);
                   return <WordToken key={el.key} token={el.token} isActive={isActive} onClick={jumpToOffset} />;
                })}
              </div>
            ) : (
              <textarea
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Escribe o pega el texto que deseas convertir en voz aquí..."
                className="absolute inset-0 p-4 w-full h-full bg-transparent text-slate-800 dark:text-slate-200 text-base leading-loose resize-none overflow-y-auto focus:outline-none placeholder-slate-400"
              />
            )}
          </div>
          
        </div>

        {/* Right Column: Settings */}
        <div className="w-full lg:w-80 overflow-y-auto pr-2 pb-2 h-full min-h-0">
          <div className="flex flex-col gap-6 pt-2">
            
            {/* Action Banner (Sidebar Top) */}
            <div className="w-full bg-primary-600 dark:bg-primary-700 text-white rounded-2xl p-6 shadow-xl flex flex-col gap-6 relative overflow-hidden flex-shrink-0">
            <div className="flex items-center gap-4 z-10">
              <button
                onClick={handleTogglePlay}
                disabled={aiLoading}
                className={`w-14 h-14 bg-white text-primary-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg flex-shrink-0 ${aiLoading ? 'opacity-70 cursor-wait' : ''}`}
              >
                 {aiLoading ? <Loader size={24} className="animate-spin" /> : 
                 (playState === 'playing' ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />)}
              </button>
              <div>
                <h4 className="font-bold text-base mb-0.5">{playState === 'playing' ? 'Pausa' : 'Reproducir'}</h4>
                <p className="text-primary-100 text-xs m-0 leading-tight">
                  {playState === 'playing' ? 'Pausar reproducción' : 'Generar vista previa'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full z-10">
              <button 
                onClick={handleStop}
                disabled={playState === 'idle' && !aiLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-red-50 text-slate-800 hover:text-red-600 rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-800"
              >
                <Square size={16} fill="currentColor" />
                DETENER
              </button>
              
              <button 
                onClick={handleDownloadAudio}
                disabled={isDownloading || !text.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-transparent border border-white/30 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isDownloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />} 
                DESCARGAR MP3
              </button>
            </div>
            
            {/* Decorative background circle */}
            <div className="absolute right-[-10%] top-[-10%] w-48 h-48 bg-white opacity-5 rounded-full blur-2xl pointer-events-none"></div>
          </div>

          {/* Card: Acciones de IA */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h4 className="flex items-center gap-2 font-bold text-secondary-900 dark:text-white mb-4">
              <Sparkles size={18} className="text-primary-600 dark:text-primary-400" /> Asistente IA
            </h4>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Modelo</label>
              <select 
                value={aiProvider} 
                onChange={(e) => setAiProvider(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer"
              >
                <option value="groq">Groq (Llama 3, Rápido)</option>
                <option value="nvidia">NVIDIA (GLM-5.2)</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleImprove('mejorar_texto')}
                disabled={isImproving || !text.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                {isImproving ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} className="text-primary-500" />} 
                Mejorar Texto
              </button>
              
              <button 
                onClick={() => handleImprove('mejorar_prompt')}
                disabled={isImproving || !text.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                {isImproving ? <Loader size={16} className="animate-spin" /> : <FileText size={16} className="text-primary-500" />} 
                Mejorar Prompt
              </button>
            </div>
          </div>

          {/* Card: Configuración de Voz */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h4 className="flex items-center gap-2 font-bold text-secondary-900 dark:text-white mb-6">
              <User size={18} className="text-primary-600 dark:text-primary-400" /> Configuración de Voz
            </h4>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Voces Nativas (Local)</label>
              <select 
                value={selectedVoiceURI}
                onChange={e => setSelectedVoiceURI(e.target.value)}
                disabled={useAITTS}
                className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/50 appearance-none cursor-pointer disabled:opacity-50"
              >
                {nativeVoices.length > 0 ? (
                  nativeVoices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                  ))
                ) : (
                  <option>Cargando voces locales...</option>
                )}
              </select>
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <h5 className="flex items-center gap-2 font-bold text-sm text-primary-600 dark:text-primary-400">
                  <Sparkles size={16} /> Procesamiento en Nube
                </h5>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useAITTS ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <input 
                      type="checkbox" 
                      checked={useAITTS} 
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setUseAITTS(isChecked);
                        if (!isChecked && speed > 2.0) {
                          handleSpeedChange(2.0);
                        }
                      }}
                      className="sr-only"
                    />
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useAITTS ? 'translate-x-4' : 'translate-x-1'}`} />
                  </div>
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Usa APIs externas para evitar distorsiones en altas velocidades de reproducción (x2, x3).
              </p>
              
              {useAITTS && (
                <div className="flex flex-col gap-2 mt-3 animate-fade-in bg-slate-100/50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="cloudProvider" value="elevenlabs" checked={cloudProvider === 'elevenlabs'} onChange={(e) => setCloudProvider(e.target.value)} className="accent-primary-600" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">ElevenLabs (Requiere API Key)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="cloudProvider" value="google" checked={cloudProvider === 'google'} onChange={(e) => setCloudProvider(e.target.value)} className="accent-primary-600" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Google Translate (Gratuito)</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Card: Parámetros Técnicos */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h4 className="flex items-center gap-2 font-bold text-secondary-900 dark:text-white mb-6">
              <Settings2 size={18} className="text-primary-600 dark:text-primary-400" /> Parámetros Técnicos
            </h4>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Velocidad</label>
                <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">{speed.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.5" max={useAITTS ? "3.0" : "2.0"} step="0.1" value={speed} 
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full accent-primary-600 mb-2 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>Lento</span>
                <span>Rápido</span>
              </div>
            </div>


          </div>
          </div>
        </div>
      </div>

      {/* Incompatible Browser Modal */}
      {showIncompatibleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-slide-up">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertTriangle size={28} />
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Navegador no compatible</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
              Este navegador no es compatible o está bloqueando las voces nativas (muy común en navegadores como Brave o en modo incógnito estricto).<br/><br/>
              Favor de activar el <strong>Procesamiento en Nube</strong> y utilizar <strong>ElevenLabs</strong> (con tu propia API Key) o la versión gratuita de <strong>Google Translate</strong>.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowIncompatibleModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors"
              >
                Cerrar
              </button>
              <button 
                onClick={() => {
                  setShowIncompatibleModal(false);
                  setUseAITTS(true);
                }}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-primary-600/20"
              >
                Activar Nube
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
