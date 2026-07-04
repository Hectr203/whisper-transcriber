import React, { useState, useEffect } from 'react';
import { Key, Save, Trash2, ShieldCheck, X } from 'lucide-react';

export default function ApiKeysConfig({ onClose }) {
  const [groqKey, setGroqKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [nvidiaKey, setNvidiaKey] = useState('');
  
  const [savedGroq, setSavedGroq] = useState(false);
  const [savedElevenLabs, setSavedElevenLabs] = useState(false);
  const [savedNvidia, setSavedNvidia] = useState(false);

  useEffect(() => {
    const currentGroq = localStorage.getItem('groqApiKey');
    const currentEleven = localStorage.getItem('elevenLabsApiKey');
    const currentNvidia = localStorage.getItem('nvidiaApiKey');
    
    if (currentGroq) {
      setGroqKey(currentGroq);
      setSavedGroq(true);
    }
    if (currentEleven) {
      setElevenLabsKey(currentEleven);
      setSavedElevenLabs(true);
    }
    if (currentNvidia) {
      setNvidiaKey(currentNvidia);
      setSavedNvidia(true);
    }
  }, []);

  const handleSave = () => {
    if (groqKey.trim()) {
      localStorage.setItem('groqApiKey', groqKey.trim());
      setSavedGroq(true);
    } else {
      localStorage.removeItem('groqApiKey');
      setSavedGroq(false);
    }

    if (elevenLabsKey.trim()) {
      localStorage.setItem('elevenLabsApiKey', elevenLabsKey.trim());
      setSavedElevenLabs(true);
    } else {
      localStorage.removeItem('elevenLabsApiKey');
      setSavedElevenLabs(false);
    }

    if (nvidiaKey.trim()) {
      localStorage.setItem('nvidiaApiKey', nvidiaKey.trim());
      setSavedNvidia(true);
    } else {
      localStorage.removeItem('nvidiaApiKey');
      setSavedNvidia(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('groqApiKey');
    localStorage.removeItem('elevenLabsApiKey');
    localStorage.removeItem('nvidiaApiKey');
    setGroqKey('');
    setElevenLabsKey('');
    setNvidiaKey('');
    setSavedGroq(false);
    setSavedElevenLabs(false);
    setSavedNvidia(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-8 w-full max-w-lg shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={20} />
        </button>

        <h2 className="flex items-center gap-3 mt-0 mb-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl">
            <Key size={24} />
          </div>
          API Keys
        </h2>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
          Si tienes tus propias credenciales, introdúcelas aquí. Se guardarán <strong>solo en tu navegador</strong> y tendrán prioridad sobre las predeterminadas del servidor.
        </p>

        <div className="mb-5">
          <label className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            Groq API Key (Whisper, IA Predeterminada)
            {savedGroq && <ShieldCheck size={16} className="text-green-500" />}
          </label>
          <input 
            type="password"
            value={groqKey}
            onChange={(e) => { setGroqKey(e.target.value); setSavedGroq(false); }}
            placeholder="gsk_..."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
          />
        </div>

        <div className="mb-5">
          <label className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            NVIDIA API Key
            {savedNvidia && <ShieldCheck size={16} className="text-green-500" />}
          </label>
          <input 
            type="password"
            value={nvidiaKey}
            onChange={(e) => { setNvidiaKey(e.target.value); setSavedNvidia(false); }}
            placeholder="nvapi-..."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
          />
        </div>

        <div className="mb-8">
          <label className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            ElevenLabs API Key (Opcional, TTS)
            {savedElevenLabs && <ShieldCheck size={16} className="text-green-500" />}
          </label>
          <input 
            type="password"
            value={elevenLabsKey}
            onChange={(e) => { setElevenLabsKey(e.target.value); setSavedElevenLabs(false); }}
            placeholder="sk_..."
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-mono"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={handleClear}
            className="px-5 py-2.5 rounded-xl border-2 border-red-100 dark:border-red-900/30 bg-transparent text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer flex items-center gap-2 font-bold transition-colors"
          >
            <Trash2 size={16} /> Borrar
          </button>
          
          <button 
            onClick={() => { handleSave(); onClose(); }}
            className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white cursor-pointer flex items-center gap-2 font-bold transition-all shadow-sm transform hover:-translate-y-0.5"
          >
            <Save size={16} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
