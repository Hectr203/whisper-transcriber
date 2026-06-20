import React, { useState, useEffect } from 'react';
import { Key, Save, Trash2, ShieldCheck, X } from 'lucide-react';

export default function ApiKeysConfig({ onClose }) {
  const [groqKey, setGroqKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  
  const [savedGroq, setSavedGroq] = useState(false);
  const [savedElevenLabs, setSavedElevenLabs] = useState(false);

  useEffect(() => {
    const currentGroq = localStorage.getItem('groqApiKey');
    const currentEleven = localStorage.getItem('elevenLabsApiKey');
    
    if (currentGroq) {
      setGroqKey(currentGroq);
      setSavedGroq(true);
    }
    if (currentEleven) {
      setElevenLabsKey(currentEleven);
      setSavedElevenLabs(true);
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
  };

  const handleClear = () => {
    localStorage.removeItem('groqApiKey');
    localStorage.removeItem('elevenLabsApiKey');
    setGroqKey('');
    setElevenLabsKey('');
    setSavedGroq(false);
    setSavedElevenLabs(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, color: 'var(--text)' }}>
          <Key size={22} color="var(--accent)" /> Configuración de API Keys
        </h2>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
          Si tienes tus propias credenciales, introdúcelas aquí. Se guardarán <strong>solo en tu navegador</strong> y tendrán prioridad sobre las predeterminadas del servidor.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
            Groq API Key (Whisper)
            {savedGroq && <ShieldCheck size={14} color="var(--success)" style={{ marginLeft: '6px', verticalAlign: 'middle' }} />}
          </label>
          <input 
            type="password"
            value={groqKey}
            onChange={(e) => { setGroqKey(e.target.value); setSavedGroq(false); }}
            placeholder="gsk_..."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)'
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
            ElevenLabs API Key (Opcional, TTS)
            {savedElevenLabs && <ShieldCheck size={14} color="var(--success)" style={{ marginLeft: '6px', verticalAlign: 'middle' }} />}
          </label>
          <input 
            type="password"
            value={elevenLabsKey}
            onChange={(e) => { setElevenLabsKey(e.target.value); setSavedElevenLabs(false); }}
            placeholder="sk_..."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            onClick={handleClear}
            style={{
              padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--error)',
              background: 'transparent', color: 'var(--error)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500
            }}
          >
            <Trash2 size={16} /> Borrar locales
          </button>
          
          <button 
            onClick={() => { handleSave(); onClose(); }}
            style={{
              padding: '10px 16px', borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500
            }}
          >
            <Save size={16} /> Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
