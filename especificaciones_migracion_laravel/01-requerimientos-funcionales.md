# 01. Catálogo de Requerimientos Funcionales (RF)

Este documento detalla exhaustivamente todos los requerimientos funcionales que debe satisfacer la plataforma migrada a Laravel, agrupados por subsistema.

---

## Subsistema 1: Ingesta de Medios y Grabación Directa

### RF-001: Carga de Archivos Multimedia
- **Descripción:** El sistema debe permitir al usuario seleccionar o arrastrar y soltar un archivo local de audio o video.
- **Entradas:** Archivo multimedia mediante interfaz gráfica (campo multipart/form-data).
- **Formatos soportados:** 
  - Audio: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.webm`, `.aac`.
  - Video: `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`.
- **Restricción de tamaño:** Hasta un máximo de 1024 MB (1 GB).
- **Salida:** Archivo cargado en almacenamiento temporal con identificador único (UUID), cálculo de duración y tamaño en MB.

### RF-002: Validación de Integridad y Formato
- **Descripción:** El sistema debe validar que el archivo cargado no esté vacío (mayor a 0 bytes) y que su tipo MIME real y extensión correspondan a los formatos permitidos.
- **Salida en error:** Mensaje de error descriptivo con código HTTP 400 (`LIMIT_UNEXPECTED_FILE`) si el formato no es válido o HTTP 413 si excede el tamaño máximo.

### RF-003: Grabación Directa desde el Micrófono
- **Descripción:** El sistema debe proporcionar una grabadora interactiva en el cliente que capture la voz en tiempo real mediante Web Audio API / MediaRecorder.
- **Comportamiento:**
  - Botón de iniciar, pausar y detener grabación.
  - Temporizador visible de grabación en tiempo real.
  - Indicador visual de actividad de audio (onda/frecuencia).
- **Salida:** Archivo de audio grabado (`audio/webm` o `audio/wav`) listo para ser procesado o descargado por el usuario.

### RF-004: Inspección y Análisis de Contenedor de Medios
- **Descripción:** El sistema debe inspeccionar el archivo recibido para determinar:
  - Duración total exacta en segundos.
  - Presencia o ausencia de flujo de video (`hasVideo: true/false`).
  - Tasa de bits y canales de audio.
- **Salida:** Objeto estructurado con metadatos técnicos del archivo.

### RF-005: Extracción Automática de Audio desde Video
- **Descripción:** Cuando se sube un archivo que contiene pista de video para su transcripción o división de audio, el sistema debe extraer automáticamente la pista de audio antes de procesarlo.
- **Regla:** La extracción debe generar un flujo de audio normalizado en formato MP3 con codificación a 64 kbps (optimizado para voz).

---

## Subsistema 2: Transcripción Automática de Voz a Texto (STT) y Streaming

### RF-006: Segmentación Automática por Límite de Tamaño (Chunking Automático)
- **Descripción:** Si el archivo de audio a transcribir supera los 24 MB (margen de seguridad de la API de 25 MB) o dura más de 10 minutos (600 segundos), el sistema debe dividirlo automáticamente en fragmentos secuenciales continuos sin pérdida de contenido sonoro en las fronteras.
- **Salida:** Lista de fragmentos temporales indexados para procesamiento secuencial o por lotes.

### RF-007: Inferencia de Transcripción con Whisper
- **Descripción:** El sistema debe enviar cada fragmento al modelo `whisper-large-v3` para convertir la voz en texto editable.
- **Parámetros configurables:** Idioma objetivo (o autodetección), prompt de contexto previo para mantener continuidad ortográfica y nombres propios.
- **Salida:** Texto transcrito por fragmento y texto consolidado continuo.

### RF-008: Notificación de Progreso en Tiempo Real (Eventos de Estado)
- **Descripción:** El cliente debe recibir el estado del procesamiento paso a paso sin necesidad de recargar la página.
- **Etapas obligatorias:**
  1. `uploading`: Carga y almacenamiento del archivo.
  2. `analyzing`: Inspección técnica de códec y duración.
  3. `extracting`: Extracción de audio si el origen fue video.
  4. `splitting`: Segmentación de chunks si es un archivo grande.
  5. `transcribing`: Inferencia de Whisper por cada fragmento con porcentaje acumulativo.
  6. `improving`: Ejecución opcional de mejora textual con IA.
  7. `complete`: Finalización con entrega de la transcripción y metadatos.
  8. `error`: Reporte detallado del error con causa específica.

### RF-009: Inyección Dinámica de Credenciales de Cliente
- **Descripción:** El sistema debe permitir que el usuario envíe su propia API Key de Groq en las cabeceras HTTP (`X-Groq-Api-Key`). Si el cliente no envía una llave, el sistema debe utilizar la clave predeterminada configurada en el entorno del servidor.
- **Salida:** Si ninguna llave existe, retornar error HTTP 401 solicitando la configuración de la credencial.

### RF-010: Tolerancia a Fallos y Reintentos ante Rate Limiting (HTTP 429)
- **Descripción:** Ante respuestas HTTP 429 (Too Many Requests) emitidas por el proveedor de inferencia, el sistema debe capturar el encabezado `retry-after` o aplicar un retardo exponencial con jitter y reintentar la operación hasta un máximo de 5 intentos antes de fallar.

### RF-011: Cálculo de Métricas de Transcripción
- **Descripción:** Al finalizar la transcripción, el sistema debe calcular y presentar:
  - Número total de caracteres.
  - Número total de palabras.
  - Duración del audio procesado.
  - Indicador de si el texto fue mejorado por IA.

---

## Subsistema 3: División de Multimedia (Audio y Video)

### RF-012: Conmutación de Modo de División
- **Descripción:** La sección de *División de Multimedia* debe permitir al usuario seleccionar explícitamente entre dos modalidades de trabajo:
  - **Modo Audio:** Segmentación en fragmentos de solo audio (.mp3).
  - **Modo Video:** Segmentación en fragmentos de video completos (.mp4).

### RF-013: Parámetro Configurable de Partes
- **Descripción:** El usuario debe poder definir el número de fragmentos $N$ deseados mediante un control numérico con un rango permitido de 1 a 100 partes.

### RF-014: Estimación de Duración en Tiempo Real
- **Descripción:** Al seleccionar un archivo y cambiar el número de partes, la interfaz debe calcular y mostrar dinámicamente la duración estimada que tendrá cada fragmento (`Duración total / N`), con formato legible (`~ X min Y seg`).

### RF-015: Segmentación de Video en Partes Iguales
- **Descripción:** En modo video, el sistema debe dividir el archivo en $N$ fragmentos iguales en formato MP4:
  - Cada fragmento debe preservar la pista de video y la pista de audio sincronizadas al milisegundo.
  - Codificación de video H.264 ultrafast con banderas de inicio rápido (`+faststart`) para streaming web inmediato.
  - Codificación de audio AAC a 128 kbps.
- **Restricción:** Si el usuario elige modo video pero carga un archivo de solo audio, el sistema debe rechazar la operación con una advertencia explicativa.

### RF-016: Segmentación de Audio en Partes Iguales
- **Descripción:** En modo audio, el sistema debe dividir el archivo en $N$ fragmentos de igual duración en formato MP3 con codificación a 64 kbps. Si el archivo original contenía video, debe extraer primero el audio antes de segmentar.

### RF-017: Historial y Gestión de Fragmentos Multimedia
- **Descripción:** Los fragmentos generados deben registrarse en un historial accesible:
  - Indicador visual del tipo (`[🎬 Video MP4]` o `[🎵 Audio MP3]`).
  - Botón de previsualización para reproducir el fragmento directamente en un reproductor modal del navegador.
  - Botón de descarga individual con el nombre descriptivo (`[nombre_original]_parte_[i]_de_[N].[ext]`).
  - Botón de transcripción directa para enviar el fragmento específico al motor de Whisper AI.
  - Opción de borrado de historial de fragmentos con diálogo de confirmación.

---

## Subsistema 4: Ingesta desde Plataformas Externas (YouTube)

### RF-018: Análisis de Enlaces de YouTube
- **Descripción:** El sistema debe recibir una URL de YouTube (video individual o lista de reproducción) y extraer sus metadatos sin descargar el archivo completo:
  - Título del video.
  - Canal o autor.
  - Duración formateada.
  - Imagen miniatura (thumbnail).
  - Si es playlist: lista de videos con sus títulos y duraciones.

### RF-019: Descarga de Audio de YouTube en Streaming
- **Descripción:** El sistema debe permitir la descarga del flujo de audio del video de YouTube directamente hacia el cliente o almacenamiento temporal, convirtiéndolo a MP3 con cabeceras de descarga de adjunto.

### RF-020: Transcripción Directa de Enlaces de YouTube
- **Descripción:** El sistema debe permitir transcribir un video de YouTube a partir de su URL:
  - Descarga del audio en segundo plano.
  - Enrutamiento automático hacia el pipeline de transcripción de Whisper.
  - Emisión de progreso en tiempo real al cliente.

### RF-021: Validación de Enlaces y Manejo de Errores de Extracción
- **Descripción:** Validar formato de URL y controlar videos privados, bloqueados por región, eliminados o con restricciones de edad, retornando mensajes legibles al usuario.

---

## Subsistema 5: Síntesis de Texto a Voz (TTS Híbrido)

### RF-022: Síntesis con Motor Nativo del Navegador
- **Descripción:** Sintetizar voz localmente mediante la API `window.speechSynthesis`:
  - Sin costo de red ni consumo de APIs.
  - Detección automática del idioma del texto para sugerir la voz del sistema correspondiente.
  - Controles de velocidad (rate: 0.5x a 2x), tono (pitch: 0.5 a 1.5) y volumen (0 a 1).

### RF-023: Síntesis con Motor Cloud Premium (ElevenLabs)
- **Descripción:** Generar audio ultra realista consumiendo la API de ElevenLabs:
  - Selección de modelos de voz (Multilingual v2, Turbo v2.5).
  - Selector de catálogo de voces predefinidas y clonadas.
  - Ajuste fino de estabilidad (*stability*) y claridad/similitud (*similarity boost*).

### RF-024: Conversión y Ajuste de Velocidad con Filtros de Audio
- **Descripción:** Si la síntesis del servidor requiere alteración de tempo, el sistema debe aplicar filtros de audio continuos (ej. cadena de filtros de tempo) preservando el tono natural de la voz.

### RF-025: Previsualización y Descarga del Audio Sintetizado
- **Descripción:** La interfaz debe proveer un reproductor de audio inmediato para escuchar la voz generada y un botón de descarga para guardar el archivo resultante en formato `.mp3`.

### RF-026: Caché de Síntesis Frecuentes
- **Descripción:** Para evitar llamadas redundantes a APIs de pago, el cliente debe almacenar en caché local las combinaciones de texto + voz generadas recientemente.

---

## Subsistema 6: Refinamiento y Post-procesamiento Textual (IA)

### RF-027: Modo "Mejorar Texto" (Ortografía y Redacción)
- **Descripción:** Recibir un texto transcrito y procesarlo con un LLM con instrucciones estrictas de corrección:
  - Corregir errores gramaticales, ortografía, puntuación y concordancia.
  - Eliminar muletillas comunes de la transcripción fonética.
  - Prohibido agregar introducciones, notas o saludos; devolver únicamente el texto refinado.

### RF-028: Modo "Mejorar Prompt" (Estructuración para IA)
- **Descripción:** Transformar una transcripción o nota en un prompt optimizado para modelos de lenguaje:
  - Estructura clara: Rol, Contexto, Instrucción principal, Restricciones y Formato de salida.
  - Devolver únicamente el prompt estructurado listo para copiar.

### RF-029: Soporte Multi-proveedor de Modelos
- **Descripción:** Permitir seleccionar el proveedor de inferencia:
  - **Groq:** Modelos Llama 3 / Mixtral de alta velocidad.
  - **NVIDIA NIM:** Modelos avanzados (GLM, Llama 3.3).
  - **Ollama:** Servidor local auto-hospedado (Open Source).

### RF-030: Límite y Protección de Longitud
- **Descripción:** Validar que el texto a mejorar no supere los 25,000 caracteres por petición. Si lo supera, devolver error informativo sugiriendo procesar por fragmentos.

---

## Subsistema 7: Gestión de Historial, Persistencia y Exportación

### RF-031: Historial Local Persistente
- **Descripción:** Registrar cada transcripción completada con: ID único, fecha/hora, nombre del archivo original, texto transcrito, metadatos técnicos (duración, palabras, caracteres) y estado.
- **Privacidad:** Los datos deben persistirse en el almacenamiento del navegador del usuario (`IndexedDB`), garantizando funcionamiento sin cuentas forzadas.

### RF-032: Filtrado y Búsqueda en el Historial
- **Descripción:** Proporcionar una barra de búsqueda y filtros reactivos que permitan localizar transcripciones por:
  - Término de texto en el nombre del archivo o en la transcripción.
  - Fecha de procesamiento.
  - Tipo de medio (audio o video).

### RF-033: Carga y Re-edición desde el Historial
- **Descripción:** Al hacer clic en un elemento del historial, el sistema debe cargar el texto en el editor interactivo y restaurar el audio/video asociado para su reproducción.

### RF-034: Exportación Multiformato
- **Descripción:** Permitir al usuario exportar la transcripción con un solo clic:
  - Copiado al portapapeles con confirmación visual.
  - Descarga en formato de texto plano (`.txt`).
  - Descarga en formato Markdown formateado (`.md`).

---

## Subsistema 8: Configuración, Credenciales y Experiencia de Usuario (UI/UX)

### RF-035: Modal de Gestión Segura de Credenciales (API Keys)
- **Descripción:** Permitir al usuario ingresar, visualizar enmascaradas, guardar y eliminar sus claves privadas de Groq, ElevenLabs y NVIDIA.
- **Regla:** Las claves deben residir únicamente en el almacenamiento local del navegador (`localStorage`) y viajar al servidor solo como cabecera por petición (`X-Groq-Api-Key`, etc.), sin guardarse en bases de datos del servidor si el usuario no tiene cuenta.

### RF-036: Selector Dinámico de Temas de Color
- **Descripción:** Proporcionar un selector de paletas visuales en tiempo real que altere todas las variables CSS de la aplicación:
  - Océano Profundo (Azules/Cyan).
  - Tropical Bliss (Esmeralda/Verde menta).
  - Atardecer (Naranja/Ámbar).
  - Clásico (Slate/Indigo).
- **Salida:** Persistencia automática de la paleta elegida en el almacenamiento del navegador.

### RF-037: Modo Oscuro OLED / Modo Claro
- **Descripción:** Alternar entre tema claro y tema oscuro con negros profundos (OLED dark mode) y persistencia del estado.

### RF-038: Diseño Responsivo y Menú Móvil
- **Descripción:** La interfaz debe adaptarse fluidamente a dispositivos de escritorio (layout expansivo ultra-ancho) y móviles (menú lateral tipo drawer/hamburguesa con todas las opciones operativas).
