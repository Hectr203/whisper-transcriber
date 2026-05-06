import React from 'react';
import { Search, Scissors, Bot, CheckCircle, Check } from 'lucide-react';

const STAGE_LABELS = {
  analyzing:    { label: 'Analizando archivo',         icon: <Search size={11} /> },
  splitting:    { label: 'Dividiendo en segmentos',    icon: <Scissors size={11} /> },
  transcribing: { label: 'Transcribiendo con Whisper', icon: <Bot size={11} /> },
  complete:     { label: 'Transcripción completada',   icon: <CheckCircle size={11} /> },
};

export default function ProgressBar({ status }) {
  if (!status) return null;

  const { stage, message, progress = 0, current, total } = status;
  const stageInfo = STAGE_LABELS[stage] || { label: stage, icon: '⏳' };

  const stages = ['analyzing', 'splitting', 'transcribing', 'complete'];
  const currentStageIdx = stages.indexOf(stage);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '24px',
      marginTop: '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{stageInfo.icon}</span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{stageInfo.label}</span>
        </div>
        <span style={{
          background: 'var(--accent-light)',
          color: 'var(--accent)',
          padding: '2px 10px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 600,
        }}>{progress}%</span>
      </div>

      {/* Barra de progreso */}
      <div style={{
        height: '8px',
        background: 'var(--surface2)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '12px',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: `linear-gradient(90deg, var(--accent), #a855f7)`,
          borderRadius: '4px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Mensaje de estado */}
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        {message}
        {current && total && (
          <span style={{ marginLeft: '8px', color: 'var(--accent)', fontWeight: 500 }}>
            ({current}/{total})
          </span>
        )}
      </p>

      {/* Pasos visuales */}
      <div style={{
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
      }}>
        {stages.slice(0, -1).map((s, idx) => (
          <React.Fragment key={s}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: idx <= currentStageIdx ? 'var(--accent-light)' : 'var(--surface2)',
              border: `1px solid ${idx <= currentStageIdx ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.3s ease',
            }}>
              <span style={{ fontSize: '11px' }}>
                {idx < currentStageIdx ? <Check size={11} /> : STAGE_LABELS[s].icon}
              </span>
              <span style={{
                fontSize: '11px',
                color: idx <= currentStageIdx ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: idx === currentStageIdx ? 600 : 400,
              }}>
                {STAGE_LABELS[s].label}
              </span>
            </div>
            {idx < stages.length - 2 && (
              <div style={{
                flex: 1,
                height: '1px',
                background: idx < currentStageIdx ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.3s ease',
                minWidth: '12px',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
