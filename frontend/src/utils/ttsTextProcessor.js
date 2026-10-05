/**
 * Utilidad para procesar texto para SpeechSynthesis (TTS)
 * y mapear de forma exacta cada palabra hablada a su posición en el texto original.
 */

/**
 * Prepara el contenido para lectura por voz y genera una función de mapeo de caracteres.
 * @param {string} fullText - Texto completo original (Markdown o plano)
 * @param {number} startOffset - Índice de carácter desde donde empezar a leer
 * @param {boolean} isMarkdown - Si el texto está en formato Markdown
 * @returns {{ speechText: string, getGlobalCharIndex: (speechCharIdx: number) => number, words: Array }}
 */
export function prepareTTSContent(fullText = '', startOffset = 0, isMarkdown = false) {
  if (!fullText) {
    return {
      speechText: '',
      getGlobalCharIndex: () => 0,
      words: []
    };
  }

  const rawSlice = fullText.substring(startOffset);

  if (!isMarkdown) {
    // Modo texto plano
    const words = [];
    const regex = /([\wáéíóúüñÁÉÍÓÚÜÑ]+)/g;
    let match;
    while ((match = regex.exec(rawSlice)) !== null) {
      words.push({
        word: match[0],
        speechStart: match.index,
        speechEnd: match.index + match[0].length,
        globalCharIndex: startOffset + match.index
      });
    }

    const getGlobalCharIndex = (speechIdx) => {
      if (words.length === 0) return startOffset;
      const exact = words.find(w => speechIdx >= w.speechStart && speechIdx < w.speechEnd);
      if (exact) return exact.globalCharIndex;
      const next = words.find(w => w.speechStart > speechIdx);
      if (next) return next.globalCharIndex;
      return words[words.length - 1].globalCharIndex;
    };

    return { speechText: rawSlice, getGlobalCharIndex, words };
  }

  // Modo Markdown: limpiar de forma inteligente para una locución fluida y natural
  const lines = rawSlice.split('\n');
  const speechLines = [];

  for (let line of lines) {
    let trimmed = line.trim();

    // 1. Filtrar líneas separadoras de tablas (| --- | --- |)
    if (/^\|?[\s-:]+\|[\s-:|]+$/.test(trimmed)) {
      continue;
    }

    // 2. Procesar filas de tablas (| Celda 1 | Celda 2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim().replace(/[*_~`]/g, ''))
        .filter(c => c.length > 0);
      if (cells.length > 0) {
        speechLines.push(cells.join(', ') + '.');
      }
      continue;
    }

    // 3. Filtrar vallas de código (```js, ```mermaid, etc.)
    if (/^```[a-zA-Z0-9_-]*$/.test(trimmed)) {
      continue;
    }

    // 4. Encabezados: remover # y añadir punto para pausa natural
    if (/^#{1,6}\s+/.test(trimmed)) {
      trimmed = trimmed.replace(/^#{1,6}\s+/, '') + '.';
    }

    // 5. Listas: remover viñetas y añadir punto
    if (/^\s*[-*+]\s+/.test(trimmed)) {
      trimmed = trimmed.replace(/^\s*[-*+]\s+/, '') + '.';
    } else if (/^\s*\d+\.\s+/.test(trimmed)) {
      trimmed = trimmed.replace(/^\s*\d+\.\s+/, '') + '.';
    }

    // 6. Citas: remover >
    if (/^>\s*/.test(trimmed)) {
      trimmed = trimmed.replace(/^>\s*/, '') + '.';
    }

    // 7. Enlaces: mantener texto, remover URL [texto](url) -> texto
    trimmed = trimmed.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // 8. Imágenes: mantener alt o remover ![alt](url) -> alt
    trimmed = trimmed.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1');

    // 9. Formatos en línea: negritas, cursivas, código, tachado
    trimmed = trimmed.replace(/[*_~`]/g, '');

    // 10. Limpieza de pipes sueltos
    trimmed = trimmed.replace(/\|/g, ', ');

    if (trimmed) {
      speechLines.push(trimmed);
    }
  }

  const speechText = speechLines.join('\n');

  // Mapear cada palabra en speechText con su posición real en fullText
  const mappedWords = [];
  const wordRegex = /([\wáéíóúüñÁÉÍÓÚÜÑ]+)/g;
  let match;
  let currentSearchIdx = startOffset;

  while ((match = wordRegex.exec(speechText)) !== null) {
    const word = match[0];
    const speechStart = match.index;
    const speechEnd = match.index + word.length;

    let foundIdx = fullText.indexOf(word, currentSearchIdx);
    if (foundIdx === -1) {
      foundIdx = fullText.indexOf(word, startOffset);
    }

    if (foundIdx !== -1) {
      currentSearchIdx = foundIdx + word.length;
    } else {
      foundIdx = currentSearchIdx;
    }

    mappedWords.push({
      word,
      speechStart,
      speechEnd,
      globalCharIndex: foundIdx
    });
  }

  const getGlobalCharIndex = (speechIdx) => {
    if (mappedWords.length === 0) return startOffset;
    const exact = mappedWords.find(w => speechIdx >= w.speechStart && speechIdx < w.speechEnd);
    if (exact) return exact.globalCharIndex;
    const next = mappedWords.find(w => w.speechStart > speechIdx);
    if (next) return next.globalCharIndex;
    return mappedWords[mappedWords.length - 1].globalCharIndex;
  };

  return { speechText: speechText || rawSlice, getGlobalCharIndex, words: mappedWords };
}
