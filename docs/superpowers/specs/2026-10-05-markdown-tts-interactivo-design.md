# Especificación de Diseño: Detección y Lectura Interactiva de Markdown en TTS

**Fecha:** 2026-10-05  
**Estado:** Aprobado  
**Módulo:** `frontend/src/components/TextEditorTTS.jsx` y utilidades de soporte  

---

## 1. Resumen Ejecutivo
Actualmente, el componente `TextEditorTTS` permite reproducir texto mediante síntesis de voz (local o en nube) y hacer clic sobre cualquier palabra en modo de texto plano para saltar y continuar la lectura desde esa posición. Sin embargo, al activar la "Vista Markdown", el texto se renderiza como contenido HTML estático mediante `react-markdown`, perdiendo la posibilidad de interactuar con las palabras, hacer clic para continuar la lectura desde un punto específico o auto-detectar cuando un texto entrante contiene formato Markdown.

Este diseño define:
1. Detección automática de sintaxis Markdown en textos entrantes (transcripción, mejoras con IA o pegado manual), activando automáticamente el interruptor "Vista Markdown".
2. Renderizado interactivo de palabras en la vista Markdown (con efectos hover, cursor de puntero y soporte para clic individual).
3. Soporte para selección de texto con el ratón (iniciar lectura desde la selección).
4. Resaltado activo palabra por palabra durante la lectura con auto-scroll sincronizado.

---

## 2. Arquitectura y Componentes

### 2.1 Utilidad de Detección Automática (`detectMarkdownContent`)
Se implementa una función pura para determinar si un texto contiene formato Markdown real:

```javascript
export function detectMarkdownContent(content) {
  if (!content || typeof content !== 'string') return false;
  
  // Reglas de detección estructural
  const patterns = [
    /^#{1,6}\s+\S+/m,                         // Encabezados (# Título)
    /\*\*[^\*\n]+\*\*|__[^\_\n]+__/,           // Negritas (**texto**)
    /(?<!\*)\*[^\*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)/, // Cursivas (*texto*)
    /^\s*[-*+]\s+\S+/m,                       // Listas desordenadas (- item)
    /^\s*\d+\.\s+\S+/m,                        // Listas numeradas (1. item)
    /```[\s\S]*?```|`[^`\n]+`/,               // Bloques de código o inline code
    /\[[^\]]+\]\([^\)]+\)/,                   // Enlaces ([texto](url))
    /^>\s+\S+/m,                               // Citas (> cita)
    /\|.+\|.+\|/m                              // Tablas markdown (| a | b |)
  ];

  return patterns.some(pattern => pattern.test(content));
}
```

#### Comportamiento de Activación:
- En `useEffect` al cambiar `initialText` o cuando el usuario pega texto en el área de edición:
  - Si `detectMarkdownContent(nuevoTexto)` es `true`, se actualiza el estado `setIsMarkdownMode(true)`.
  - El usuario mantiene en todo momento el interruptor visible para activar o desactivar la vista Markdown manualmente según su preferencia.

---

### 2.2 Tokenización y Mapeo Interactivo en Markdown

#### Mapeo entre Palabras Renderizadas y Texto Original:
Para permitir que cualquier palabra dentro de encabezados (`h1`-`h6`), párrafos (`p`), listas (`li`), citas (`blockquote`), tablas (`td`, `th`) y texto con énfasis (`strong`, `em`, `a`, `code`) sea cliqueable:
1. Se extraen todos los tokens de palabras del texto con su `charIndex` y `length`.
2. Se procesan los hijos de `ReactMarkdown` mediante componentes personalizados que envuelven los fragmentos de texto en elementos interactivos `MarkdownWordToken`:
   - Cada token mantiene la referencia a su posición en caracteres (`charIndex`).
   - Muestra clase `cursor-pointer`, `hover:bg-primary-50 dark:hover:bg-primary-900/30` y `title="Clic para reproducir desde aquí"`.
   - Cuando coincide con `activeCharIndex` (palabra actualmente leída por el TTS), se aplica la clase activa: `bg-primary-500 text-white shadow-md rounded px-0.5 scale-105 inline-block`.
3. Auto-scroll: Al cambiar `activeCharIndex`, el elemento activo ejecuta `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` si se encuentra fuera del área visible del contenedor.

---

### 2.3 Selección de Texto con el Ratón
En el contenedor de la vista Markdown (`markdownRef`):
- Se escucha el evento `onMouseUp`.
- Si el usuario ha seleccionado texto (`window.getSelection()` no está vacío ni colapsado):
  - Se identifica el nodo inicial de la selección y su palabra asociada.
  - Se muestra un botón flotante contextual o se permite iniciar la reproducción `playFrom(startCharIndex)` directamente desde el punto de inicio de la selección.

---

### 2.4 Sincronización con el Motor TTS (`playFrom`)
Al llamar a `playFrom(offsetIndex)` en modo Markdown:
1. `rawSlice = text.substring(offsetIndex)`.
2. Se genera `sliceBuffer` eliminando sintaxis visual de Markdown (como `#`, `*`, `_`, `~`, `>`) y transformando enlaces `[texto](url)` en `texto` para una dicción natural y fluida.
3. Se envía el texto limpio al motor de voz (Web Speech API o servicio en la nube ElevenLabs/Google).
4. El evento `onboundary` de la Web Speech API (y la estimación de tiempo en nube) mapea el avance hacia los tokens interactivos para mantener sincronizado el resaltado visual.

---

## 3. Plan de Pruebas y Validación

1. **Prueba de Detección Automática:**
   - Cargar un texto plano sin formato -> `isMarkdownMode` permanece `false`.
   - Cargar o pegar un texto con `# Título`, `**negritas**` o listas `- item` -> `isMarkdownMode` se activa automáticamente en `true`.
   - Alternar manualmente el switch de Vista Markdown -> responde de inmediato.

2. **Prueba de Clic en Palabras en Markdown:**
   - Hacer clic en una palabra dentro de un título `h1`/`h2`.
   - Hacer clic en una palabra dentro de un párrafo normal.
   - Hacer clic en una palabra dentro de un elemento de lista `li`.
   - Hacer clic en una palabra en negrita `**`.
   - En todos los casos, la reproducción TTS debe iniciar/saltar exactamente en esa palabra.

3. **Prueba de Resaltado Activo y Auto-Scroll:**
   - Verificar que durante la lectura la palabra actual se resalte con estilo primario.
   - Verificar que al llegar al final de la pantalla, el contenedor haga scroll automático manteniendo la palabra visible.

4. **Prueba de Selección con el Ratón:**
   - Seleccionar un fragmento con el ratón y activar la reproducción desde la selección.

5. **Prueba de No Regresión:**
   - Verificar que el modo texto plano, la edición manual, el botón limpiar, copiar texto y descargas (.txt, .md, .mp3) funcionen sin alteraciones.
