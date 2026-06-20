import React from 'react';
import { Search, Scissors, Bot, CheckCircle, Check } from 'lucide-react';

const STAGE_LABELS = {
  analyzing:    { label: 'Analizando archivo',         icon: <Search size={14} /> },
  splitting:    { label: 'Dividiendo en segmentos',    icon: <Scissors size={14} /> },
  transcribing: { label: 'Transcribiendo con Whisper', icon: <Bot size={14} /> },
  complete:     { label: 'Transcripción completada',   icon: <CheckCircle size={14} /> },
};

export default function ProgressBar({ status }) {
  if (!status) return null;

  const { stage, message, progress = 0, current, total } = status;
  const stageInfo = STAGE_LABELS[stage] || { label: stage, icon: '⏳' };

  const stages = ['analyzing', 'splitting', 'transcribing', 'complete'];
  const currentStageIdx = stages.indexOf(stage);

  return (
    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm animate-fade-in mt-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg">{stageInfo.icon}</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{stageInfo.label}</span>
        </div>
        <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
          {progress}%
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Mensaje de estado */}
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 font-medium">
        {message}
        {current && total && (
          <span className="ml-2 text-primary-600 dark:text-primary-400 font-bold">
            ({current}/{total})
          </span>
        )}
      </p>

      {/* Pasos visuales */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        {stages.slice(0, -1).map((s, idx) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 whitespace-nowrap ${
              idx <= currentStageIdx 
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700' 
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
            }`}>
              <span className={`text-xs ${idx <= currentStageIdx ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {idx < currentStageIdx ? <Check size={12} strokeWidth={3} /> : STAGE_LABELS[s].icon}
              </span>
              <span className={`text-xs ${idx <= currentStageIdx ? 'text-primary-700 dark:text-primary-300 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
                {STAGE_LABELS[s].label}
              </span>
            </div>
            {idx < stages.length - 2 && (
              <div className={`flex-1 h-0.5 min-w-[16px] transition-colors duration-300 ${
                idx < currentStageIdx ? 'bg-primary-400 dark:bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
