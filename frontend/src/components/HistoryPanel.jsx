import React, { useState, useMemo } from 'react';
import { Clock, RefreshCw, CheckCircle, AlertTriangle, FileAudio, FileVideo, Search, FilterX, Calendar, Filter } from 'lucide-react';

export default function HistoryPanel({ history, onLoadItem }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterTime, setFilterTime] = useState('all');
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [filterExtension, setFilterExtension] = useState('all');

  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

  const availableExtensions = useMemo(() => {
    if (!history) return [];
    const exts = new Set();
    history.forEach(item => {
      const name = item.fileName || '';
      const dotIndex = name.lastIndexOf('.');
      if (dotIndex > 0) {
        exts.add(name.substring(dotIndex).toLowerCase());
      }
    });
    return Array.from(exts).sort();
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    
    return history.filter(item => {
      const name = (item.fileName || '').toLowerCase();
      const extMatch = name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.')).toLowerCase() : '';
      const dateObj = new Date(item.timestamp);
      const isVideo = videoExtensions.includes(extMatch);

      // 1. Nombre
      if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
      
      // 2. Fecha
      if (filterDate) {
        const offset = dateObj.getTimezoneOffset() * 60000;
        const localISODate = new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
        if (localISODate !== filterDate) return false;
      }
      
      // 3. Hora
      if (filterTime && filterTime !== 'all') {
        const itemHour = dateObj.getHours().toString().padStart(2, '0');
        if (itemHour !== filterTime) return false;
      }
      
      // 4. Tipo de Medio
      if (filterMediaType !== 'all') {
        if (filterMediaType === 'video' && !isVideo) return false;
        if (filterMediaType === 'audio' && isVideo) return false;
      }
      
      // 5. Extensión
      if (filterExtension !== 'all' && extMatch !== filterExtension) return false;
      
      return true;
    });
  }, [history, searchQuery, filterDate, filterTime, filterMediaType, filterExtension]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDate('');
    setFilterTime('all');
    setFilterMediaType('all');
    setFilterExtension('all');
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  if (!history || history.length === 0) {
    return (
      <div className="w-full animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
          <Clock className="text-primary-600" /> Historial de Grabaciones
        </h2>
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center">
          <Clock size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
          <p className="text-center text-slate-500 dark:text-slate-400 font-medium text-lg">
            No hay grabaciones recientes en el historial.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Clock className="text-primary-600" /> Historial de Grabaciones
        </h2>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl">
          Mostrando {filteredHistory.length} de {history.length} elementos
        </div>
      </div>

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-8 shadow-sm flex flex-col gap-4 relative z-20">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre de archivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase">
              <Calendar size={14} /> Fecha
            </label>
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase">
              <Clock size={14} /> Hora
            </label>
            <select 
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="all">Todas las horas</option>
              {hours.map(h => (
                <option key={h} value={h}>{h}:00 - {h}:59</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase">
              <Filter size={14} /> Tipo
            </label>
            <select 
              value={filterMediaType}
              onChange={(e) => setFilterMediaType(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="all">Cualquier tipo</option>
              <option value="audio">Solo Audio</option>
              <option value="video">Solo Video</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase">
              <Filter size={14} /> Extensión
            </label>
            <select 
              value={filterExtension}
              onChange={(e) => setFilterExtension(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="all">Cualquier formato</option>
              {availableExtensions.map(ext => (
                <option key={ext} value={ext}>{ext.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {(searchQuery || filterDate || filterTime !== 'all' || filterMediaType !== 'all' || filterExtension !== 'all') && (
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
            <button 
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-600 transition-colors bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg"
            >
              <FilterX size={16} /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {filteredHistory.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 font-medium">No hay resultados que coincidan con los filtros actuales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredHistory.map(item => {
            const name = (item.fileName || '').toLowerCase();
            const extMatch = name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.')).toLowerCase() : '';
            const isVideo = videoExtensions.includes(extMatch);
            
            return (
            <div 
              key={item.id} 
              onClick={() => onLoadItem(item)}
              className="flex flex-col p-6 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer bg-white dark:bg-surface-dark hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all group relative overflow-hidden transform hover:-translate-y-1"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${item.status === 'complete' ? 'bg-green-500' : item.status === 'error' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
              
              <div className="flex justify-between items-start mb-4 pl-2">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-all ${isVideo ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400 group-hover:bg-indigo-100' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400 group-hover:bg-emerald-100'}`}>
                    {isVideo ? <FileVideo size={24} /> : <FileAudio size={24} />}
                  </div>
                  <div>
                    <p className="font-bold text-base text-slate-800 dark:text-slate-200 line-clamp-1 break-all" title={item.fileName}>
                      {item.fileName || 'Audio guardado'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pl-2 mt-auto pt-4 flex items-center justify-between border-t border-slate-50 dark:border-slate-800/50">
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400 opacity-80 group-hover:opacity-100 transition-all flex items-center gap-1">
                  Cargar transcripción <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </span>
                <div>
                  {item.status === 'complete' && <CheckCircle size={20} className="text-green-500" title="Completado" />}
                  {item.status === 'error' && <AlertTriangle size={20} className="text-red-500" title="Error, intentar de nuevo" />}
                  {item.status === 'analyzing' && <RefreshCw size={20} className="text-orange-500 animate-spin" title="Pendiente" />}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
