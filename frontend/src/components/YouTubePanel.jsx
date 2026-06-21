import React, { useState, useRef, useCallback } from 'react';
import { Search, Loader2, AlertTriangle, Film, Music, Download, List, CheckSquare, Square, PlayCircle, Mic, User, ChevronDown, Check, Video, Headphones } from 'lucide-react';
import { analyzeYouTubeUrl, triggerDownload } from '../utils/youtubeService';
import ProgressBar from './ProgressBar';
import TextEditorTTS from './TextEditorTTS';
import { saveHistoryItem, getHistoryItems } from '../utils/historyStorage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const CustomSelect = ({ value, onChange, options, label, icon: Icon }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="space-y-2 relative" ref={selectRef}>
      {label && (
        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          {Icon && <Icon size={16} className="text-primary-500" />} {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border ${isOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'} rounded-xl text-base font-medium text-slate-800 dark:text-slate-200 transition-all shadow-sm`}
        >
          <span className="truncate pr-4">{selectedOption?.label}</span>
          <ChevronDown size={18} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary-500' : 'text-slate-400'}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar origin-top animate-fade-in p-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm transition-all rounded-lg flex items-center justify-between mb-1 last:mb-0 ${
                  value === opt.value 
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-bold' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                }`}
              >
                <span className="truncate pr-4">{opt.label}</span>
                {value === opt.value && <Check size={16} className="flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function YouTubePanel({ onRefreshHistory }) {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [resultData, setResultData] = useState(null); // info del video o playlist

  // Estados para playlist
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [globalFormat, setGlobalFormat] = useState('video'); // 'video' o 'audio'

  // Estados para video individual y calidades
  const [videoFormat, setVideoFormat] = useState('video');
  const [selectedQuality, setSelectedQuality] = useState('default');

  // Estados para transcripción
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState(null);
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const eventSourceRef = useRef(null);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Por favor, ingresa una URL de YouTube.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResultData(null);
    setTranscriptionResult(null);
    setTranscriptionStatus(null);
    setSelectedItems(new Set());
    setIsPlayingPreview(false);

    try {
      const data = await analyzeYouTubeUrl(url);
      setResultData(data);
      if (data.type === 'playlist') {
        // Seleccionar todos por defecto
        setSelectedItems(new Set(data.items.map(i => i.id)));
      }
    } catch (err) {
      setError(err.message || 'Error al analizar el enlace.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadFullPlaylist = async () => {
    setIsAnalyzing(true);
    setError(null);
    setResultData(null);
    setTranscriptionResult(null);
    setTranscriptionStatus(null);
    setSelectedItems(new Set());
    setIsPlayingPreview(false);

    try {
      const data = await analyzeYouTubeUrl(url, 'playlist');
      setResultData(data);
      if (data.type === 'playlist') {
        setSelectedItems(new Set(data.items.map(i => i.id)));
      }
    } catch (err) {
      setError(err.message || 'Error al analizar la playlist.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleSelect = (id) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const handleSelectAll = () => {
    if (resultData && resultData.type === 'playlist') {
      setSelectedItems(new Set(resultData.items.map(i => i.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  const downloadSingleVideo = () => {
    if (!resultData) return;
    triggerDownload(url, videoFormat, selectedQuality);
  };

  const downloadPlaylist = () => {
    if (!resultData || selectedItems.size === 0) return;
    // Como se requiere que cada video se descargue independiente, iteramos y descargamos
    // Es posible que el navegador bloquee múltiples descargas.
    const itemsToDownload = resultData.items.filter(item => selectedItems.has(item.id));
    itemsToDownload.forEach((item, index) => {
      setTimeout(() => {
        triggerDownload(item.url, globalFormat);
      }, index * 1000); // Espaciamos 1 segundo
    });
  };

  const downloadPlaylistItem = (itemUrl) => {
    triggerDownload(itemUrl, globalFormat);
  };

  const handleTranscribe = useCallback(async () => {
    if (!resultData || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setTranscriptionResult(null);

    const historyId = Date.now().toString();
    setCurrentHistoryId(historyId);

    const baseHistoryItem = {
      id: historyId,
      timestamp: Date.now(),
      fileName: `youtube_${resultData.title}.mp3`,
      audioBlob: null, // No tenemos blob inicial, es remoto
      transcription: null,
      status: 'analyzing'
    };

    try {
      await saveHistoryItem(baseHistoryItem);
      if (onRefreshHistory) onRefreshHistory();

      setTranscriptionStatus({ stage: 'connecting', message: 'Conectando con el servidor...', progress: 2 });

      const headers = { 'Content-Type': 'application/json' };
      const groqKey = localStorage.getItem('groqApiKey');
      if (groqKey) {
        headers['X-Groq-Api-Key'] = groqKey;
      }

      const response = await fetch(`${API_BASE}/youtube/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error HTTP ${response.status}`);
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
                setTranscriptionStatus(data);
              } else if (currentEvent === 'complete') {
                setTranscriptionStatus({ stage: 'complete', message: 'Transcripción completada', progress: 100 });
                setTranscriptionResult(data);
                setIsProcessing(false);
                
                baseHistoryItem.status = 'complete';
                baseHistoryItem.transcription = data.transcription;
                baseHistoryItem.metadata = data;
                saveHistoryItem(baseHistoryItem).then(() => {
                  if (onRefreshHistory) onRefreshHistory();
                });

              } else if (currentEvent === 'error') {
                throw new Error(data.message || 'Error en la transcripción');
              }
            } catch (parseErr) {
              if (parseErr.message !== 'JSON parse error') throw parseErr;
            }
            currentEvent = null;
          }
        }
      }

    } catch (err) {
      console.error('[YouTubePanel] Error:', err);
      setError(err.message || 'Error desconocido al transcribir');
      setIsProcessing(false);
      setTranscriptionStatus(null);
      
      baseHistoryItem.status = 'error';
      baseHistoryItem.errorMessage = err.message || 'Error desconocido';
      saveHistoryItem(baseHistoryItem).then(() => {
        if (onRefreshHistory) onRefreshHistory();
      });
    }
  }, [resultData, url, isProcessing, onRefreshHistory]);

  const resetTranscription = () => {
    setTranscriptionResult(null);
    setTranscriptionStatus(null);
    setIsProcessing(false);
  };

  const handleCancelTranscription = () => {
     // A futuro: implementar la ruta DELETE /api/transcription/cancel/:jobId usando currentHistoryId
     resetTranscription();
  };

  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto">
      {/* Header */}
      {!transcriptionResult && !resultData && !isProcessing && (
        <div className="mb-12 flex flex-col items-center text-center px-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-red-600 text-white mb-6 shadow-xl shadow-red-500/20">
             <Film size={36} strokeWidth={2} />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
            Analiza y Descarga de YouTube
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Ingresa un enlace de un video o playlist para extraer su contenido de forma rápida. Opcionalmente, puedes enviar el audio directamente a Whisper para transcribirlo con IA.
          </p>
        </div>
      )}

      {/* Buscador centralizado */}
      {!transcriptionResult && !isProcessing && (
        <div className={`${!resultData ? 'max-w-3xl mx-auto' : 'mb-8'}`}>
          <form onSubmit={handleAnalyze} className="relative flex items-center shadow-lg hover:shadow-xl transition-shadow rounded-2xl bg-white dark:bg-surface-dark border-4 border-slate-50/50 dark:border-slate-800/50 group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="text-slate-400 group-focus-within:text-primary-500 transition-colors" size={24} />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
              className="block w-full pl-14 pr-36 py-5 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none text-lg rounded-2xl"
              placeholder="https://youtube.com/watch?v=..."
            />
            <div className="absolute inset-y-2 right-2">
              <button
                type="submit"
                disabled={isAnalyzing || !url.trim()}
                className="h-full px-8 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-base font-bold tracking-wide transition-all shadow-md flex items-center gap-2"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : 'Analizar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Errores */}
      {error && !isProcessing && (
        <div className="mb-8 max-w-3xl mx-auto p-5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl animate-slide-up">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 dark:text-red-400 font-bold mb-1 text-lg">No se pudo procesar</p>
              <p className="text-red-600/90 dark:text-red-400/80 text-base">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Resultados de Video Individual */}
      {resultData && resultData.type === 'video' && !isProcessing && !transcriptionResult && (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl animate-fade-in max-w-4xl mx-auto">
          <div className="md:flex">
            {/* Thumbnail o Reproductor */}
            <div className="md:w-5/12 bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative group rounded-t-3xl md:rounded-tr-none md:rounded-l-3xl">
              {isPlayingPreview && resultData.videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${resultData.videoId}?autoplay=1`}
                  title={resultData.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full min-h-[250px] md:min-h-full aspect-video md:aspect-auto"
                ></iframe>
              ) : resultData.thumbnail ? (
                <>
                  <img src={resultData.thumbnail} alt={resultData.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div 
                    className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer"
                    onClick={() => setIsPlayingPreview(true)}
                  >
                    <div className="w-16 h-16 bg-red-600/90 text-white rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                      <PlayCircle size={32} fill="currentColor" className="ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/70 backdrop-blur-md text-white text-xs font-bold rounded-lg tracking-wider pointer-events-none">
                    {resultData.durationText}
                  </div>
                </>
              ) : (
                <PlayCircle size={64} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>
            
            {/* Info y Controles */}
            <div className="p-8 md:w-7/12 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2 line-clamp-2">{resultData.title}</h3>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium mb-6">
                  <User size={16} /> <span>{resultData.author}</span>
                </div>
                
                {resultData.isPlaylistContent && (
                  <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 text-sm rounded-2xl border border-blue-100 dark:border-blue-900/20 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <List className="flex-shrink-0 mt-0.5" size={18} />
                      <p className="font-medium">Este video pertenece a una playlist. Se ha enfocado el análisis únicamente en este video.</p>
                    </div>
                    <button 
                      onClick={handleLoadFullPlaylist}
                      className="whitespace-nowrap px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800/30 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 font-bold rounded-lg transition-colors text-xs flex-shrink-0"
                    >
                      Ver Playlist Completa
                    </button>
                  </div>
                )}

                {/* Selectores modernos customizados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  <CustomSelect
                    label="Formato de descarga"
                    icon={videoFormat === 'video' ? Video : Headphones}
                    value={videoFormat}
                    onChange={setVideoFormat}
                    options={[
                      { value: 'video', label: 'Video (MP4)' },
                      { value: 'audio', label: 'Solo Audio (MP3)' }
                    ]}
                  />
                  
                  <CustomSelect
                    label="Calidad"
                    value={selectedQuality}
                    onChange={setSelectedQuality}
                    options={[
                      { value: 'default', label: `La mejor posible (~${videoFormat === 'video' ? resultData.estimatedVideoMB : resultData.estimatedAudioMB} MB)` },
                      ...(resultData.formats[videoFormat]?.map(f => ({
                        value: f.itag,
                        label: videoFormat === 'video' ? `Video: ${f.qualityLabel}` : `Audio: ${f.audioBitrate}kbps`
                      })) || [])
                    ]}
                  />
                </div>
              </div>

              {/* Botones de acción prominentes */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={downloadSingleVideo}
                  className="flex-1 flex justify-center items-center gap-2 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl font-bold transition-transform active:scale-95 shadow-md"
                >
                  <Download size={20} /> Obtener {videoFormat === 'video' ? 'Video' : 'Audio'}
                </button>
                <button
                  onClick={handleTranscribe}
                  className="flex-1 flex justify-center items-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-transform active:scale-95 shadow-md shadow-primary-600/20"
                >
                  <Mic size={20} /> Transcribir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultados de Playlist */}
      {resultData && resultData.type === 'playlist' && !isProcessing && !transcriptionResult && (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl animate-fade-in p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold mb-2">
                <List size={20} /> <span>Playlist de YouTube</span>
              </div>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 leading-tight">
                {resultData.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-base font-medium">
                De: {resultData.author} • {resultData.totalItems} videos en total
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto z-10 relative">
               <div className="w-full sm:w-64">
                 <CustomSelect
                    value={globalFormat}
                    onChange={setGlobalFormat}
                    options={[
                      { value: 'video', label: 'Descargar en Video' },
                      { value: 'audio', label: 'Descargar en Audio' }
                    ]}
                  />
               </div>
                <button
                  onClick={downloadPlaylist}
                  disabled={selectedItems.size === 0}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all shadow-md"
                >
                  <Download size={20} /> Descargar ({selectedItems.size})
                </button>
            </div>
          </div>

          <div className="flex gap-6 mb-6">
             <button onClick={handleSelectAll} className="text-sm font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2 hover:opacity-80 transition-opacity">
               <CheckSquare size={18} /> SELECCIONAR TODO
             </button>
             <button onClick={handleDeselectAll} className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 hover:opacity-80 transition-opacity">
               <Square size={18} /> QUITAR SELECCIÓN
             </button>
          </div>

          <div className="space-y-3 max-h-[650px] overflow-y-auto pr-3 custom-scrollbar">
            {resultData.items.map((item, idx) => (
              <div 
                key={item.id} 
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group ${
                  selectedItems.has(item.id) 
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10 shadow-sm' 
                    : 'border-slate-100 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
                onClick={() => handleToggleSelect(item.id)}
              >
                <div className="flex-shrink-0">
                  {selectedItems.has(item.id) ? (
                    <CheckSquare className="text-primary-600 dark:text-primary-400" size={28} />
                  ) : (
                    <Square className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400" size={28} />
                  )}
                </div>
                
                <div className="flex-shrink-0 w-32 aspect-video bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden hidden sm:block relative">
                   {item.thumbnail ? (
                     <>
                       <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                       <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-[10px] font-bold rounded tracking-wider">
                         {item.durationText}
                       </div>
                     </>
                   ) : (
                     <PlayCircle className="w-full h-full text-slate-300 p-3" />
                   )}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-base font-bold text-slate-900 dark:text-white truncate mb-1">{idx + 1}. {item.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{item.author}</p>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); downloadPlaylistItem(item.url); }}
                  className="p-3 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                  title={`Descargar este ${globalFormat}`}
                >
                  <Download size={22} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progreso de transcripción */}
      {isProcessing && transcriptionStatus && (
        <div className="mt-8 max-w-2xl mx-auto bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 mb-6">
             <Mic size={32} className="animate-pulse" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Transcribiendo video</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 line-clamp-1 px-4">{resultData?.title}</p>
          
          <ProgressBar status={transcriptionStatus} />
          
          <button
            onClick={handleCancelTranscription}
            className="mt-8 px-6 py-3 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-xl font-bold transition-colors"
          >
            Cancelar Proceso
          </button>
        </div>
      )}

      {/* Resultado de Transcripción */}
      {transcriptionResult && (
        <div className="mt-8 animate-slide-up">
          <TextEditorTTS 
            initialText={transcriptionResult.transcription} 
            initialMetadata={transcriptionResult}
            onReset={resetTranscription}
            showReset={true}
          />
        </div>
      )}
    </div>
  );
}
