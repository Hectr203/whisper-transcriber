import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';

const themes = [
  {
    id: 'theme-ocean',
    name: 'Océano Profundo',
    colors: ['#219ebc', '#023047', '#ffb703']
  },
  {
    id: 'theme-tropical',
    name: 'Tropical Bliss',
    colors: ['#227c9d', '#17c3b2', '#ffcb77']
  },
  {
    id: 'theme-sunset',
    name: 'Atardecer',
    colors: ['#ea580c', '#fb923c', '#14b8a6']
  },
  {
    id: 'theme-classic',
    name: 'Clásico',
    colors: ['#2563eb', '#1e40af', '#a855f7']
  }
];

export default function ThemeSelector({ currentTheme, onSelectTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeThemeData = themes.find(t => t.id === currentTheme) || themes[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Cambiar Paleta de Colores"
      >
        <Palette size={20} className="text-primary-500" />
        <span className="text-sm font-medium hidden sm:inline-block">{activeThemeData.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-2 z-50 animate-fade-in origin-top-right">
          <div className="px-3 py-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paletas de Colores</p>
          </div>
          <div className="flex flex-col gap-1">
            {themes.map(theme => (
              <button
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                  currentTheme === theme.id 
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Vista previa de colores (foto de perfil de la paleta) */}
                  <div className="flex -space-x-1">
                    {theme.colors.map((color, idx) => (
                      <div 
                        key={idx}
                        className="w-5 h-5 rounded-full border-2 border-white dark:border-surface-dark shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{theme.name}</span>
                </div>
                {currentTheme === theme.id && <Check size={16} className="text-primary-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
