import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Play } from 'lucide-react';

export default function InteractiveMarkdown({
  markdown = '',
  activeCharIndex = -1,
  onWordClick = () => {},
  onSelectionPlay = () => {},
  containerRef = null,
}) {
  const [selectionPopup, setSelectionPopup] = useState(null); // { x, y, charIndex }
  const localRef = useRef(null);
  const actualContainerRef = containerRef || localRef;

  // Mapa de palabras en el texto original con su charIndex
  const wordTokens = useMemo(() => {
    if (!markdown) return [];
    const tokens = [];
    const regex = /([\wáéíóúüñÁÉÍÓÚÜÑ]+)/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      tokens.push({
        word: match[0],
        charIndex: match.index,
        length: match[0].length,
      });
    }
    return tokens;
  }, [markdown]);

  // Manejo de selección con ratón
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectionPopup(null);
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText) {
      setSelectionPopup(null);
      return;
    }

    // Buscar el span interactivo más cercano a anchorNode
    let node = sel.anchorNode;
    let charIndex = -1;

    while (node && node !== actualContainerRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.charIndex) {
        charIndex = parseInt(node.dataset.charIndex, 10);
        break;
      }
      node = node.parentNode;
    }

    // Fallback: buscar la primera palabra del texto seleccionado en el markdown
    if (charIndex === -1) {
      const firstWordMatch = /([\wáéíóúüñÁÉÍÓÚÜÑ]+)/.exec(selectedText);
      if (firstWordMatch) {
        const found = wordTokens.find(t => t.word.toLowerCase() === firstWordMatch[0].toLowerCase());
        if (found) charIndex = found.charIndex;
      }
    }

    if (charIndex >= 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = actualContainerRef.current?.getBoundingClientRect() || { top: 0, left: 0 };

      setSelectionPopup({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 36,
        charIndex,
      });
    } else {
      setSelectionPopup(null);
    }
  };

  // Cerrar popup al hacer clic fuera
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.tts-selection-popup')) {
        setSelectionPopup(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Auto-scroll hacia la palabra activa
  useEffect(() => {
    if (activeCharIndex < 0 || !actualContainerRef.current) return;
    const activeEl = actualContainerRef.current.querySelector(`[data-char-index="${activeCharIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCharIndex, actualContainerRef]);

  // Construcción de componentes personalizados para ReactMarkdown
  const customComponents = useMemo(() => {
    let searchOffset = 0;

    const wrapText = (textStr) => {
      if (typeof textStr !== 'string') return textStr;

      const elements = [];
      const regex = /([\wáéíóúüñÁÉÍÓÚÜÑ]+)/g;
      let lastIdx = 0;
      let match;

      while ((match = regex.exec(textStr)) !== null) {
        const word = match[0];
        const matchStart = match.index;

        if (matchStart > lastIdx) {
          elements.push(textStr.substring(lastIdx, matchStart));
        }

        // Buscar coincidencia exacta en el markdown original a partir de searchOffset
        let wordCharIndex = markdown.indexOf(word, searchOffset);
        if (wordCharIndex === -1) {
          // Fallback buscando desde el inicio
          wordCharIndex = markdown.indexOf(word);
        } else {
          searchOffset = wordCharIndex + word.length;
        }

        const isActive = activeCharIndex >= wordCharIndex && activeCharIndex < (wordCharIndex + word.length);

        elements.push(
          <span
            key={`mw_${wordCharIndex}_${matchStart}`}
            data-char-index={wordCharIndex}
            onClick={(e) => {
              e.stopPropagation();
              onWordClick(wordCharIndex);
            }}
            className={`tts-word cursor-pointer rounded px-0.5 transition-all duration-100 ${
              isActive
                ? 'bg-primary-500 text-white shadow-md scale-105 inline-block font-semibold'
                : 'hover:bg-primary-100 dark:hover:bg-primary-900/40 opacity-90 hover:opacity-100'
            }`}
            title="Clic para reproducir desde aquí"
          >
            {word}
          </span>
        );

        lastIdx = matchStart + word.length;
      }

      if (lastIdx < textStr.length) {
        elements.push(textStr.substring(lastIdx));
      }

      return elements;
    };

    const processChildren = (children) => {
      return React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return wrapText(child);
        }
        if (React.isValidElement(child) && child.props && child.props.children) {
          return React.cloneElement(child, {
            children: processChildren(child.props.children),
          });
        }
        return child;
      });
    };

    const makeInteractive = (Tag) => ({ children, ...props }) => (
      <Tag {...props}>{processChildren(children)}</Tag>
    );

    return {
      p: makeInteractive('p'),
      h1: makeInteractive('h1'),
      h2: makeInteractive('h2'),
      h3: makeInteractive('h3'),
      h4: makeInteractive('h4'),
      h5: makeInteractive('h5'),
      h6: makeInteractive('h6'),
      li: makeInteractive('li'),
      blockquote: makeInteractive('blockquote'),
      th: makeInteractive('th'),
      td: makeInteractive('td'),
      strong: makeInteractive('strong'),
      em: makeInteractive('em'),
    };
  }, [markdown, activeCharIndex, onWordClick]);

  return (
    <div
      ref={actualContainerRef}
      onMouseUp={handleMouseUp}
      className="relative w-full h-full p-4 overflow-y-auto text-slate-800 dark:text-slate-200 prose prose-sm sm:prose-base prose-slate dark:prose-invert max-w-none bg-transparent select-text"
    >
      {/* Botón flotante al seleccionar texto */}
      {selectionPopup && (
        <button
          onClick={() => {
            onSelectionPlay(selectionPopup.charIndex);
            setSelectionPopup(null);
          }}
          style={{
            position: 'absolute',
            left: `${Math.max(10, selectionPopup.x)}px`,
            top: `${Math.max(10, selectionPopup.y)}px`,
            transform: 'translateX(-50%)',
          }}
          className="tts-selection-popup z-30 flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-lg animate-fade-in transition-transform hover:scale-105 cursor-pointer"
        >
          <Play size={12} fill="currentColor" /> Leer desde aquí
        </button>
      )}

      <ReactMarkdown remarkPlugins={[remarkGfm]} components={customComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
