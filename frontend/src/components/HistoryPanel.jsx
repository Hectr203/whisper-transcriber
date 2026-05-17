import React from 'react';
import { Clock, RefreshCw, CheckCircle, AlertTriangle, FileAudio } from 'lucide-react';

export default function HistoryPanel({ history, onLoadItem, onClose }) {
  if (!history || history.length === 0) {
    return (
      <div style={panelStyles}>
        <div style={headerStyles}>
          <h3>Historial Local</h3>
          <button onClick={onClose} style={closeBtnStyles}>✕</button>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
          No hay grabaciones recientes en el historial.
        </p>
      </div>
    );
  }

  return (
    <div style={panelStyles}>
      <div style={headerStyles}>
        <h3>Historial Local</h3>
        <button onClick={onClose} style={closeBtnStyles}>✕</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {history.map(item => (
          <div key={item.id} style={itemStyles} onClick={() => onLoadItem(item)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileAudio size={20} color="var(--accent)" />
              <div>
                <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>
                  {item.fileName || 'Audio guardado'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div>
              {item.status === 'complete' && <CheckCircle size={18} color="var(--success)" title="Completado" />}
              {item.status === 'error' && <AlertTriangle size={18} color="var(--error)" title="Error, intentar de nuevo" />}
              {item.status === 'analyzing' && <RefreshCw size={18} color="var(--warning)" title="Pendiente" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const panelStyles = {
  position: 'absolute',
  top: '70px',
  right: '20px',
  width: '320px',
  maxHeight: '400px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  display: 'flex',
  flexDirection: 'column',
  padding: '16px',
  zIndex: 100,
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '8px',
};

const closeBtnStyles = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '16px',
};

const itemStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  marginBottom: '8px',
  cursor: 'pointer',
  background: 'var(--surface2)',
  transition: 'background 0.2s',
};
