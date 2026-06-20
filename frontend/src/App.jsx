import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Volume2, Music, Film, AlertTriangle, X, Download, Moon, Sun, Settings, Globe, Zap, Cloud, Menu, History as HistoryIcon } from 'lucide-react';
import UploadZone from './components/UploadZone';
import AudioRecorder from './components/AudioRecorder';
import ProgressBar from './components/ProgressBar';
import TextEditorTTS from './components/TextEditorTTS';
import HistoryPanel from './components/HistoryPanel';
import ApiKeysConfig from './components/ApiKeysConfig';
import ThemeSelector from './components/ThemeSelector';
import { saveHistoryItem, getHistoryItems } from './utils/historyStorage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('stt'); // 'stt' | 'tts'
  
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('colorTheme') || 'theme-ocean');
  const [history, setHistory] = useState([]);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.remove('theme-ocean', 'theme-tropical', 'theme-sunset', 'theme-classic');
    document.documentElement.classList.add(colorTheme);
    localStorage.setItem('colorTheme', colorTheme);
  }, [colorTheme]);

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
    setCurrentHistoryId(null); 
    setFileInfo(null); 

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
    setActiveTab('stt');
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

      const headers = {};
      const groqKey = localStorage.getItem('groqApiKey');
      if (groqKey) {
        headers['X-Groq-Api-Key'] = groqKey;
      }

      const response = await fetch(`${API_BASE}/transcription/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Error HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); 

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
    <div className="min-h-screen w-full bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Navbar (Referencia AudioFlow) */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-surface-dark backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 cursor-pointer" onClick={() => setActiveTab('stt')}>
              <Mic className="h-6 w-6 text-primary-600 dark:text-primary-500 mr-2" />
              <span className="font-bold text-xl tracking-tight text-secondary-900 dark:text-white">AudioFlow</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <button
                onClick={() => setActiveTab('stt')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                  activeTab === 'stt'
                    ? 'border-primary-600 text-primary-600 dark:border-primary-500 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Voz a Texto
              </button>
              <button
                onClick={() => setActiveTab('tts')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                  activeTab === 'tts'
                    ? 'border-primary-600 text-primary-600 dark:border-primary-500 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Texto a Voz
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                  activeTab === 'history'
                    ? 'border-primary-600 text-primary-600 dark:border-primary-500 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Historial
              </button>
            </nav>

            {/* Right Icons */}
            <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
              <ThemeSelector currentTheme={colorTheme} onSelectTheme={setColorTheme} />
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                title="Cambiar tema"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setShowApiKeys(true)}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                title="Ajustes (API Keys)"
              >
                <Settings size={20} />
              </button>
              {/* GitHub Link */}
              <a 
                href="https://github.com/Hectr203" 
                target="_blank" 
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden cursor-pointer border border-slate-300 dark:border-slate-600 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                title="Mi Perfil de GitHub"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700 dark:text-slate-300">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 shadow-lg absolute w-full z-30">
          <div className="pt-2 pb-3 space-y-1">
            <button
              onClick={() => { setActiveTab('stt'); setMobileMenuOpen(false); }}
              className={`block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                activeTab === 'stt' ? 'bg-primary-50 border-primary-600 text-primary-700 dark:bg-primary-900/20 dark:border-primary-500 dark:text-primary-400' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Voz a Texto
            </button>
            <button
              onClick={() => { setActiveTab('tts'); setMobileMenuOpen(false); }}
              className={`block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                activeTab === 'tts' ? 'bg-primary-50 border-primary-600 text-primary-700 dark:bg-primary-900/20 dark:border-primary-500 dark:text-primary-400' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Texto a Voz
            </button>
            <button
              onClick={() => { setActiveTab('history'); setMobileMenuOpen(false); }}
              className={`block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                activeTab === 'history' ? 'bg-primary-50 border-primary-600 text-primary-700 dark:bg-primary-900/20 dark:border-primary-500 dark:text-primary-400' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Historial
            </button>
            <div className="flex justify-between items-center px-4 py-3 border-t border-slate-200 dark:border-slate-700">
               <ThemeSelector currentTheme={colorTheme} onSelectTheme={setColorTheme} />
               <div className="flex gap-4">
                 <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-slate-500">
                   {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                 </button>
                 <button onClick={() => setShowApiKeys(true)} className="text-slate-500">
                   <Settings size={20} />
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showApiKeys && (
        <ApiKeysConfig onClose={() => setShowApiKeys(false)} />
      )}

      {/* Contenido principal */}
      <main className="flex-1 w-full max-w-[2000px] mx-auto px-3 sm:px-4 py-8 md:py-12">
        
        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <HistoryPanel 
            history={history} 
            onLoadItem={handleLoadHistoryItem} 
          />
        )}

        {/* STT TAB */}
        <div className={`animate-fade-in ${activeTab === 'stt' ? 'block' : 'hidden'}`}>
          
          {/* Hero Section */}
          {!result && !file && (
            <div className="mb-12">
              <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-white mb-4">
                Transforma audio en precisión textual
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                Transcribe tus archivos o graba en tiempo real con nuestra tecnología de claridad sonora de última generación.
              </p>
            </div>
          )}

          {!result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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

          {/* Feature Cards (Only show if no file is selected/processing to keep UI clean, matching the design vibe) */}
          {!result && !file && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <Globe className="text-tertiary-600 mb-4" size={28} />
                <h3 className="font-bold text-lg text-secondary-900 dark:text-white mb-2">Multilingüe</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Reconocimiento automático en más de 50 idiomas con corrección gramatical inteligente.
                </p>
              </div>
              <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <Zap className="text-primary-500 mb-4" size={28} />
                <h3 className="font-bold text-lg text-secondary-900 dark:text-white mb-2">Velocidad Pro</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Obtén tus transcripciones en menos de la mitad de la duración del audio original.
                </p>
              </div>
              <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <HistoryIcon className="text-slate-600 dark:text-slate-400 mb-4" size={28} />
                <h3 className="font-bold text-lg text-secondary-900 dark:text-white mb-2">Auto-Guardado</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Tu progreso se sincroniza en la nube para que nunca pierdas una palabra importante.
                </p>
              </div>
            </div>
          )}

          {/* Info del archivo seleccionado */}
          {file && !result && !isProcessing && (
            <div className="mt-4 p-5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-4 flex-wrap shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl">
                  {fileInfo?.type === 'video' ? <Film size={24} /> : <Music size={24} />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-base m-0">
                    {file.name}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                    {fileInfo ? `Duración: ${fileInfo.durationText} • ` : ''}{fileSizeMB} MB
                    {isLargeFile && (
                      <span className="ml-2 text-orange-500 font-medium">
                        — Se dividirá automáticamente
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadAudio}
                  className="p-2.5 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                  title="Descargar audio"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={() => { setFile(null); setFileInfo(null); setError(null); setCurrentHistoryId(null); }}
                  className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Quitar archivo"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Botón transcribir */}
          {file && !result && !isProcessing && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleTranscribe}
                className="px-10 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-lg font-bold tracking-wide transition-all shadow-md transform hover:-translate-y-0.5"
              >
                Transcribir con Whisper AI
              </button>
            </div>
          )}

          {/* Progreso */}
          {isProcessing && status && (
            <div className="mt-8 max-w-3xl mx-auto">
              <ProgressBar status={status} />
              <button
                onClick={handleCancel}
                className="mt-6 w-full py-3 bg-transparent text-slate-500 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:text-red-500 hover:border-red-300 transition-all"
              >
                Cancelar Operación
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 p-5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl max-w-3xl mx-auto">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 dark:text-red-400 font-bold mb-1">
                    Error en la transcripción
                  </p>
                  <p className="text-red-600/80 dark:text-red-400/80 text-sm">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="mt-4 px-5 py-2 bg-white dark:bg-surface-dark border border-red-200 dark:border-red-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className="mt-6">
              <TextEditorTTS 
                initialText={result.transcription} 
                initialMetadata={result}
                onReset={reset}
                showReset={true}
              />
            </div>
          )}
        </div>

        {/* TTS TAB */}
        <div className={`animate-fade-in ${activeTab === 'tts' ? 'block' : 'hidden'}`}>
          <TextEditorTTS 
            initialText="" 
            showReset={false}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-surface-dark py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            <strong className="text-secondary-900 dark:text-white mr-1">AudioFlow</strong> 
            © 2024. Todos los derechos reservados.
          </p>
          <div className="flex space-x-6 text-sm text-slate-500 dark:text-slate-400">
            <a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Términos</a>
            <a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Soporte</a>
            <a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
