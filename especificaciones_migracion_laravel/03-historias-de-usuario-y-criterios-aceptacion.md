# 03. Historias de Usuario y Criterios de Aceptación

Este documento modela las necesidades del usuario final a través de Historias de Usuario (HU) estructuradas y define la matriz formal de Criterios de Aceptación (CA) requerida por el estándar de Spec Driven Development de la Agencia.

---

## 1. Catálogo de Historias de Usuario (HU)

### HU-001: Subida y Transcripción de Archivo Multimedia
- **Como** usuario con grabaciones de clases, entrevistas o conferencias en audio o video,
- **Quiero** subir un archivo (hasta 1 GB) y solicitar su transcripción automática,
- **Para** obtener una versión en texto editable y reutilizable con precisión profesional.

### HU-002: Grabación Directa desde el Navegador
- **Como** profesional o estudiante en una reunión o ponencia,
- **Quiero** presionar un botón para grabar directamente desde mi micrófono,
- **Para** transcribir mis ideas o la sesión en curso sin necesidad de aplicaciones externas.

### HU-003: Seguimiento de Progreso en Tiempo Real
- **Como** usuario que procesa grabaciones de larga duración (hasta 1 hora),
- **Quiero** observar el avance paso a paso del procesamiento (subida, análisis, segmentación, transcripción),
- **Para** tener certidumbre de que mi archivo se está procesando activamente y saber cuánto falta.

### HU-004: Edición y Verificación de la Transcripción
- **Como** redactor o transcriptor,
- **Quiero** ver el texto transcrito junto con un reproductor de audio sincronizado con control de velocidad,
- **Para** escuchar tramos dudosos y corregir manualmente cualquier término mientras verifico el conteo de palabras.

### HU-005: Exportación de Resultados
- **Como** usuario que necesita integrar la transcripción en sus flujos de trabajo,
- **Quiero** copiar el texto con un clic o descargarlo en formato plano (.txt) o formateado (.md),
- **Para** archivarlo o utilizarlo en procesadores de texto y herramientas de notas.

### HU-006: Mejora de Redacción y Ortografía con IA
- **Como** usuario cuyo audio contenía titubeos, muletillas o incorrecciones gramaticales,
- **Quiero** solicitar la mejora del texto con un solo clic,
- **Para** obtener una versión pulida, formal y gramaticalmente impecable sin perder el sentido original.

### HU-007: Conversión a Prompt para Modelos de IA
- **Como** usuario que dicta instrucciones o notas de voz para ChatGPT, Claude o Gemini,
- **Quiero** convertir automáticamente la transcripción en un prompt estructurado (Rol, Tarea, Restricciones),
- **Para** alimentar herramientas de inteligencia artificial de forma productiva.

### HU-008: Conmutación de Proveedor de Inteligencia Artificial
- **Como** usuario técnico o con preferencias de privacidad,
- **Quiero** elegir si la mejora de texto se realiza con Groq, NVIDIA NIM u Ollama local,
- **Para** ajustar la velocidad, precisión o privacidad según mis necesidades.

### HU-009: División de Archivo de Audio en N Partes
- **Como** podcaster o creador de contenido con audios extensos,
- **Quiero** ingresar un número de partes (ej. 4, 7 o 10 partes) y dividir mi audio en fragmentos MP3 iguales,
- **Para** compartirlos en plataformas con restricciones de tamaño o duración por archivo.

### HU-010: División de Archivo de Video en Clips MP4
- **Como** editor de video o creador de cursos,
- **Quiero** subir un video de 1 hora y dividirlo en $N$ fragmentos iguales en formato MP4 con video y audio sincronizados,
- **Para** publicar lecciones modulares o clips para redes sociales sin pérdida de fotogramas ni desincronización sonora.

### HU-011: Previsualización de Fragmentos Generados
- **Como** usuario que acaba de segmentar un medio,
- **Quiero** previsualizar y reproducir cualquier fragmento directamente en un modal del navegador,
- **Para** confirmar que el corte temporal y el contenido corresponden exactamente a lo que necesito antes de descargarlo.

### HU-012: Transcripción Directa por Fragmento
- **Como** usuario que segmentó un archivo de varias horas en partes pequeñas,
- **Quiero** poder transcribir un fragmento específico directamente desde el historial de partes,
- **Para** procesar únicamente la sección de mi interés sin tener que transcribir todo el medio.

### HU-013: Descarga y Transcripción de Enlaces de YouTube
- **Como** investigador o estudiante que consulta material en YouTube,
- **Quiero** pegar el enlace de un video o playlist y transcribir su contenido,
- **Para** estudiar el material en texto sin tener que descargar manualmente el archivo de video a mi equipo.

### HU-014: Síntesis de Texto a Voz Nativa
- **Como** usuario que desea escuchar un texto redactado sin incurrir en costos de red ni consumir saldo de API,
- **Quiero** sintetizar la lectura en voz alta usando las voces de mi navegador con control de tono y velocidad,
- **Para** revisar auditivamente mis textos de forma instantánea.

### HU-015: Síntesis de Voz Premium con ElevenLabs
- **Como** productor de contenido audiovisual o narrador,
- **Quiero** convertir texto a voz utilizando el catálogo de voces hiperrealistas de ElevenLabs,
- **Para** obtener audios profesionales con entonación natural y descargarlos en formato MP3.

### HU-016: Gestión de Credenciales y Personalización Visual
- **Como** usuario que valora la ergonomía y la seguridad,
- **Quiero** alternar entre temas de color, activar el modo oscuro OLED y guardar mis claves privadas en mi navegador,
- **Para** trabajar cómodamente en sesiones prolongadas sabiendo que mis credenciales no se comparten en servidores ajenos.

---

## 2. Matriz Formal de Criterios de Aceptación (CA)

Siguiendo el estándar de la plantilla de requerimientos de la Agencia:

| ID | Criterio de Aceptación | Prioridad | Tipo | Estado inicial |
| :--- | :--- | :--- | :--- | :--- |
| **CA-001** | El sistema valida y acepta archivos de audio (MP3, WAV, M4A, OGG, FLAC, WebM) y video (MP4, WebM, MOV, AVI, MKV) de hasta 1024 MB. | Alta | Funcional | Pendiente |
| **CA-002** | Archivos que superen 1024 MB o con formatos no soportados son rechazados con código HTTP 413 o 400 y mensaje en español. | Alta | Funcional | Pendiente |
| **CA-003** | La grabación por micrófono genera un stream válido capturado por el navegador y puede procesarse como archivo de entrada. | Media | Funcional | Pendiente |
| **CA-004** | Los archivos de video enviados a transcripción o división de audio son despojados de su pista de video, generando un audio MP3 a 64 kbps. | Alta | Funcional | Pendiente |
| **CA-005** | Audios mayores a 24 MB o 10 minutos se dividen automáticamente en chunks de 600 segundos antes de invocar la API de Whisper. | Alta | Funcional | Pendiente |
| **CA-006** | Cada chunk se transcribe mediante el modelo `whisper-large-v3` y se consolida en un texto único sin cortes fonéticos. | Alta | Funcional | Pendiente |
| **CA-007** | El progreso se transmite en tiempo real al cliente por SSE o WebSockets con las 8 etapas estandarizadas. | Alta | Funcional | Pendiente |
| **CA-008** | El sistema prioriza las API Keys enviadas por el cliente en encabezados `X-Groq-Api-Key` frente a la del entorno del servidor. | Alta | Funcional | Pendiente |
| **CA-009** | Ante errores HTTP 429 de la API de Whisper, el sistema ejecuta hasta 5 reintentos con retardo exponencial antes de fallar. | Alta | No Funcional | Pendiente |
| **CA-010** | El editor de transcripción muestra conteo dinámico exacto de palabras, caracteres y duración del audio. | Media | Funcional | Pendiente |
| **CA-011** | El usuario puede exportar la transcripción a formato `.txt`, `.md` o copiarla al portapapeles con confirmación visual. | Media | Funcional | Pendiente |
| **CA-012** | La sección *División de Multimedia* ofrece selector conmutador entre modo *Dividir Audio* y modo *Dividir Video*. | Alta | Funcional | Pendiente |
| **CA-013** | El control de partes admite números enteros estrictamente entre 1 y 100. | Alta | Funcional | Pendiente |
| **CA-014** | La interfaz calcula en tiempo real la duración estimada por fragmento al cambiar el número de partes o el archivo. | Media | Funcional | Pendiente |
| **CA-015** | En modo *Dividir Video*, el sistema produce fragmentos MP4 sincronizados con códec H.264 ultrafast y audio AAC. | Alta | Funcional | Pendiente |
| **CA-016** | Si se intenta dividir video sobre un archivo sin flujo de video, el sistema rechaza la operación con alerta explícita. | Alta | Funcional | Pendiente |
| **CA-017** | En modo *Dividir Audio*, el sistema produce fragmentos MP3 normalizados de igual duración. | Alta | Funcional | Pendiente |
| **CA-018** | El historial de fragmentos muestra etiquetas claras `[🎬 Video MP4]` o `[🎵 Audio MP3]`, permitiendo previsualizar y descargar cada parte. | Alta | Funcional | Pendiente |
| **CA-019** | Cada fragmento del historial puede enviarse directamente a transcripción individual con Whisper AI. | Media | Funcional | Pendiente |
| **CA-020** | El módulo de YouTube analiza enlaces válidos y extrae título, autor, duración y miniatura. | Media | Funcional | Pendiente |
| **CA-021** | El sistema permite descargar el audio de YouTube en streaming o transcribirlo directamente. | Media | Funcional | Pendiente |
| **CA-022** | El TTS nativo utiliza `window.speechSynthesis`, autodetecta el idioma y permite alterar tono, velocidad y volumen. | Media | Funcional | Pendiente |
| **CA-023** | El TTS Cloud se integra con ElevenLabs, permitiendo seleccionar modelos y voces y descargar el audio generado. | Media | Funcional | Pendiente |
| **CA-024** | La mejora de texto con IA en modo *mejorar_texto* corrige gramática y ortografía sin añadir saludos ni notas. | Media | Funcional | Pendiente |
| **CA-025** | La mejora de texto en modo *mejorar_prompt* estructura el contenido en formato de prompt para LLMs. | Media | Funcional | Pendiente |
| **CA-026** | Las peticiones de mejora de texto mayores a 25,000 caracteres son rechazadas con error HTTP 413 descriptivo. | Baja | Funcional | Pendiente |
| **CA-027** | El historial de transcripciones se almacena en el cliente (`IndexedDB`), permitiendo búsqueda por nombre, fecha y tipo. | Alta | Funcional | Pendiente |
| **CA-028** | La limpieza masiva de historial exige confirmación interactiva previa. | Media | Funcional | Pendiente |
| **CA-029** | El selector de temas alterna dinámicamente entre las 4 paletas de color y persiste la elección en el cliente. | Baja | Funcional | Pendiente |
| **CA-030** | El backend ejecuta el cómputo pesado mediante colas desacopladas (Jobs/Queues) sin bloquear el servidor web. | Alta | No Funcional | Pendiente |
