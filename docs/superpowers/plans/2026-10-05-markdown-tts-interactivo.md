# Plan de Implementación: Detección y Lectura Interactiva de Markdown en TTS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar la detección automática de sintaxis Markdown en textos entrantes y permitir la selección interactiva (clic en palabras o selección con cursor) para iniciar o continuar la lectura con TTS en la vista Markdown, con resaltado sincronizado palabra por palabra.

**Architecture:** Módulo detector de sintaxis Markdown (`markdownDetector.js`), componente de renderizado interactivo `InteractiveMarkdown.jsx` que envuelve recursivamente los nodos de texto de `react-markdown` en tokens interactivos con `charIndex`, y actualización del flujo de reproducción/resaltado en `TextEditorTTS.jsx` con auto-scroll y barra flotante de selección.

**Tech Stack:** React 18, `react-markdown` v10, `remark-gfm` v4, Tailwind CSS, Web Speech API / TTS Cloud, Node.js Test Runner (`node --test`).

---

### Task 1: Módulo de Detección de Sintaxis Markdown (`markdownDetector.js`)

**Files:**
- Create: `frontend/src/utils/markdownDetector.js`
- Test: `frontend/test/markdownDetector.test.js`

- [ ] **Step 1: Escribir la prueba unitaria para la detección de Markdown**

Crear el archivo `frontend/test/markdownDetector.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMarkdownContent } from '../src/utils/markdownDetector.js';

test('detectMarkdownContent detecta encabezados markdown', () => {
  assert.equal(detectMarkdownContent('# Título principal'), true);
  assert.equal(detectMarkdownContent('### Subtítulo'), true);
  assert.equal(detectMarkdownContent('No es encabezado # sin espacio'), false);
});

test('detectMarkdownContent detecta negritas y cursivas', () => {
  assert.equal(detectMarkdownContent('Este es un texto **en negrita** aquí'), true);
  assert.equal(detectMarkdownContent('Texto con *cursiva* normal'), true);
  assert.equal(detectMarkdownContent('Texto simple sin formato alguno'), false);
});

test('detectMarkdownContent detecta listas ordenadas y desordenadas', () => {
  assert.equal(detectMarkdownContent('- Primer punto\n- Segundo punto'), true);
  assert.equal(detectMarkdownContent('* Punto con asterisco'), true);
  assert.equal(detectMarkdownContent('1. Primer paso\n2. Segundo paso'), true);
});

test('detectMarkdownContent detecta enlaces y bloques de código', () => {
  assert.equal(detectMarkdownContent('[Enlace a web](https://example.com)'), true);
  assert.equal(detectMarkdownContent('Código en línea `const a = 1;`'), true);
  assert.equal(detectMarkdownContent('```js\nconsole.log(123);\n```'), true);
});

test('detectMarkdownContent retorna false para cadenas vacías o texto plano común', () => {
  assert.equal(detectMarkdownContent(''), false);
  assert.equal(detectMarkdownContent(null), false);
  assert.equal(detectMarkdownContent(undefined), false);
  assert.equal(detectMarkdownContent('Esta es una transcripción regular de audio sin marcas especiales.'), false);
});
```

- [ ] **Step 2: Ejecutar la prueba para verificar que falla**

Ejecutar:
```bash
node --test frontend/test/markdownDetector.test.js
```
Resultado esperado: FALLA (módulo `markdownDetector.js` no existe).

- [ ] **Step 3: Implementar la función `detectMarkdownContent`**

Crear `frontend/src/utils/markdownDetector.js`:
```javascript
/**
 * Detecta si una cadena de texto contiene sintaxis estructural de Markdown.
 * @param {string} content - Texto a evaluar
 * @returns {boolean} true si se detecta Markdown, false en caso contrario.
 */
export function detectMarkdownContent(content) {
  if (!content || typeof content !== 'string') return false;

  const patterns = [
    /^#{1,6}\s+\S+/m,                                  // Encabezados (# Título)
    /\*\*[^\*\n]+\*\*|__[^\_\n]+__/,                    // Negritas (**texto**)
    /(?<!\*)\*[^\*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)/,  // Cursivas (*texto*)
    /^\s*[-*+]\s+\S+/m,                                // Listas desordenadas (- item)
    /^\s*\d+\.\s+\S+/m,                                 // Listas numeradas (1. item)
    /```[\s\S]*?```|`[^`\n]+`/,                        // Bloques de código o código inline
    /\[[^\]]+\]\([^\)]+\)/,                            // Enlaces ([texto](url))
    /^>\s+\S+/m,                                        // Citas (> cita)
    /\|.+\|.+\|/m                                       // Tablas (| col1 | col2 |)
  ];

  return patterns.some(pattern => pattern.test(content));
}
```

- [ ] **Step 4: Ejecutar la prueba para verificar que pasa**

Ejecutar:
```bash
node --test frontend/test/markdownDetector.test.js
```
Resultado esperado: PASS (todos los tests pasan).

- [ ] **Step 5: Confirmar cambios en git**

```bash
git add frontend/src/utils/markdownDetector.js frontend/test/markdownDetector.test.js
git commit -m "feat: agregar utilidad de detección de sintaxis Markdown con pruebas"
```

---

### Task 2: Componente `InteractiveMarkdown.jsx` con Palabras Cliqueables y Selección

**Files:**
- Create: `frontend/src/components/InteractiveMarkdown.jsx`

- [ ] **Step 1: Crear el componente `InteractiveMarkdown.jsx`**

Este componente recibe el markdown, el índice activo de lectura (`activeCharIndex`), y los callbacks `onWordClick` y `onSelectionPlay`. Procesa recursivamente los elementos HTML de `ReactMarkdown` para convertir cada palabra en un span interactivo con hover, tooltip y resaltado activo:

```jsx
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
```

- [ ] **Step 2: Verificar sintaxis y transpilación con Vite**

Ejecutar:
```bash
npm run build --prefix frontend
```
Resultado esperado: Build exitoso sin errores de sintaxis o importación.

- [ ] **Step 3: Confirmar cambios en git**

```bash
git add frontend/src/components/InteractiveMarkdown.jsx
git commit -m "feat: crear componente InteractiveMarkdown con palabras cliqueables y selección de texto"
```

---

### Task 3: Integrar Detección Automática y `InteractiveMarkdown` en `TextEditorTTS.jsx`

**Files:**
- Modify: `frontend/src/components/TextEditorTTS.jsx`

- [ ] **Step 1: Importar detector y componente interactivo**

En `frontend/src/components/TextEditorTTS.jsx`:
- Importar `detectMarkdownContent` desde `../utils/markdownDetector`.
- Importar `InteractiveMarkdown` desde `./InteractiveMarkdown`.

- [ ] **Step 2: Integrar la auto-detección al recibir texto o al pegar**

En `TextEditorTTS.jsx`:
- En el `useEffect` que observa `initialText`:
  ```javascript
  useEffect(() => {
    setText(initialText);
    if (initialText && detectMarkdownContent(initialText)) {
      setIsMarkdownMode(true);
    }
  ...
  ```
- En el `<textarea>` del modo edición, agregar el manejador `onPaste`:
  ```javascript
  onPaste={(e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    if (detectMarkdownContent(pasted)) {
      setIsMarkdownMode(true);
    }
  }}
  ```

- [ ] **Step 3: Reemplazar el renderizado de `ReactMarkdown` plano por `InteractiveMarkdown`**

En el bloque de renderizado (alrededor de la línea 638):
```jsx
{isMarkdownMode ? (
  <InteractiveMarkdown
    markdown={text}
    activeCharIndex={activeCharIndex}
    onWordClick={jumpToOffset}
    onSelectionPlay={jumpToOffset}
    containerRef={markdownRef}
  />
) : playState !== 'idle' ? (
...
```

- [ ] **Step 4: Refinar la limpieza en `playFrom` para garantizar dicción natural de Markdown**

Asegurar que `playFrom` maneje adecuadamente los encabezados, enlaces y listas al construir `sliceBuffer`:
```javascript
let sliceBuffer = rawSlice;
if (isMarkdownMode) {
  sliceBuffer = sliceBuffer
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .trim();
  if (!sliceBuffer) sliceBuffer = rawSlice;
}
```

- [ ] **Step 5: Ejecutar build del frontend para validar compilación completa**

Ejecutar:
```bash
npm run build --prefix frontend
```
Resultado esperado: Compilación exitosa sin advertencias críticas.

- [ ] **Step 6: Confirmar cambios en git**

```bash
git add frontend/src/components/TextEditorTTS.jsx
git commit -m "feat: integrar detección automática de Markdown y lectura interactiva en TextEditorTTS"
```

---

### Task 4: Verificación Integral End-to-End y Pruebas Manuales

**Files:**
- Test: `frontend/test/markdownDetector.test.js`

- [ ] **Step 1: Ejecutar pruebas unitarias de regresión**

Ejecutar:
```bash
node --test frontend/test/markdownDetector.test.js
```
Resultado esperado: PASS.

- [ ] **Step 2: Probar el flujo en navegador o entorno local**

Verificar:
1. Al cargar texto con Markdown (o pegar texto con títulos `#`, listas `-`, negritas `**`), la "Vista Markdown" se enciende automáticamente.
2. Cada palabra en la vista Markdown muestra hover interactivo.
3. Al hacer clic en cualquier palabra (en títulos, párrafos o listas), el TTS empieza a reproducir desde esa palabra.
4. El resaltado avanza palabra por palabra y el auto-scroll mantiene la palabra visible.
5. Al resaltar texto con el cursor, aparece el botón flotante "Leer desde aquí" e inicia correctamente la lectura.
6. El modo texto plano sigue funcionando sin afectación.

- [ ] **Step 3: Confirmar estado final limpio en git**

```bash
git status
```
Verificar que los cambios estén listos y confirmados.
