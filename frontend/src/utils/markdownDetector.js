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
