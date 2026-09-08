# Especificación de Diseño: División de Multimedia (Audio y Video)

**Fecha**: 2026-09-07  
**Estado**: Validado y listo para implementación  
**Objetivo**: Reemplazar la sección "Dividir Audio" por "División de Multimedia" en la interfaz de Voxelis, soportando tanto división de audio como división de video en partes iguales (de 1 a 100 fragmentos) de forma paralela y precisa.

---

## 1. Contexto y Requerimientos

### 1.1 Necesidad
El usuario requiere:
1. Renombrar la funcionalidad en la barra de navegación y vistas de **"Dividir Audio"** a **"División de Multimedia"**.
2. Proveer dos modalidades independientes dentro de la misma sección:
   - **Dividir Audio**: Subir archivo de audio (o video para extraer su audio) y dividirlo en $N$ fracciones iguales (ej. 4, 7, 10, 100 partes).
   - **Dividir Video**: Subir archivo de video (ej. MP4, WebM, MOV, MKV, AVI) y dividirlo en $N$ fragmentos de video completos (manteniendo video y audio sincronizados), generando clips descargables e indexados en el historial.
3. Calcular y mostrar al usuario en tiempo real la duración estimada de cada fragmento según la duración total del archivo.
4. Extender el historial de fragmentos para soportar tanto chunks de audio (`.mp3`) como de video (`.mp4`), con capacidades de descarga directa y transcripción mediante Whisper AI.

---

## 2. Arquitectura de la Solución

```
+-------------------------------------------------------------+
|                      Frontend (React)                       |
|  - Navbar: "División de Multimedia"                         |
|  - Sub-selector de Modo: [🎵 Dividir Audio] [🎬 Dividir Video]  |
|  - Control de Partes (1 - 100) + Cálculo de duración estimada|
|  - Historial de Fragmentos Multimedia (Audio / Video)       |
+-------------------------------------------------------------+
                              |
                     POST /api/transcription/split
                     (FormData: audio/video file,
                      parts: number,
                      mediaType: 'audio' | 'video')
                              |
                              v
+-------------------------------------------------------------+
|                   Backend (Express + FFmpeg)                |
|  - uploadMiddleware: Validación MIME / extensiones           |
|  - mediaSplitter:                                           |
|      * splitAudioIntoEqualParts (MP3 con libmp3lame)        |
|      * splitVideoIntoEqualParts (MP4 con libx264 ultrafast) |
|  - Almacenamiento: Azure Blob / Fallback local temporal     |
+-------------------------------------------------------------+
                              |
    +-------------------------+-------------------------+
    |                                                   |
    v                                                   v
GET /chunks/:session/:id/download          POST /chunks/:session/:id/transcribe
(Descarga .mp3 o .mp4 según formato)       (Transcribe audio/video con Groq Whisper)
```

---

## 3. Componentes y Cambios Técnicos

### 3.1 Backend
1. **Servicio `backend/src/services/audioSplitter.js` (o `mediaSplitter.js`)**:
   - Agregar función `splitVideoIntoEqualParts(inputPath, parts, onProgress)`:
     - Utiliza `fluent-ffmpeg` para recortar con exactitud temporal:
       ```javascript
       ffmpeg(inputPath)
         .setStartTime(startTime)
         .setDuration(partDuration)
         .videoCodec('libx264')
         .outputOptions(['-preset ultrafast', '-crf 22', '-movflags +faststart'])
         .audioCodec('aac')
         .audioBitrate('128k')
         .format('mp4')
       ```
     - Emite chunks con metadatos: `{ index, duration, start, type: 'video', ext: 'mp4' }`.
     - Ejecuta la segmentación con concurrencia controlada (`MANUAL_SPLIT_CONCURRENCY`).
   - Exportar `splitVideoIntoEqualParts`.

2. **Rutas `backend/src/routes/transcription.js`**:
   - Actualizar `POST /api/transcription/split`:
     - Leer `mediaType` (`'audio'` o `'video'`).
     - Si `mediaType === 'video'`, verificar que el archivo contenga video con `analyzeMedia`. Si no contiene video, retornar error claro `400`.
     - Invocar `splitVideoIntoEqualParts` para video o `splitAudioIntoEqualParts` para audio.
     - Guardar blobs con el mimetype correspondiente (`video/mp4` o `audio/mpeg`).
     - Responder con `mediaType`, `chunks` (indicando mimetype, tipo de archivo y urls).
   - Actualizar `GET /api/transcription/chunks/:sessionId/:chunkId/download`:
     - Detectar dinámicamente si el fragmento en blob storage es `.mp4` o `.mp3`.
     - Asignar `Content-Type: video/mp4` o `audio/mpeg` y nombre de descarga adecuado.
   - Actualizar `POST /api/transcription/chunks/:sessionId/:chunkId/transcribe`:
     - Detectar si el blob es `.mp4` o `.mp3`.
     - Whisper de Groq admite MP4 nativamente (hasta 25MB). Si es MP4, enviar con mimetype `video/mp4`.

### 3.2 Frontend (`frontend/src/App.jsx`)
1. **Navegación**:
   - Renombrar opción del menú: "Dividir Audio" -> "División de Multimedia" (en vista desktop y menú hamburguesa móvil).
2. **Estado y Controles**:
   - Estado `splitMediaType` (`'audio'` o `'video'`).
   - Selector visual destacado (botones tipo pill/tabs con iconos 🎵 y 🎬) para alternar entre "Dividir Audio" y "Dividir Video".
   - Si el usuario selecciona "Dividir Video" pero sube un archivo que solo es audio, mostrar advertencia amigable indicando que debe subir un archivo con pista de video.
   - Cálculo automático en tiempo real: al seleccionar un archivo y cambiar el número de partes, mostrar "Duración total: X min Y s → Cada parte durará aprox. Z min W s".
3. **Historial de Fragmentos Multimedia**:
   - Mostrar etiquetas identificadoras claras: `[🎬 Video]` vs `[🎵 Audio]`.
   - Botón de descarga con la extensión correcta (`.mp4` o `.mp3`).
   - Botón de transcripción ("Transcribir con Whisper AI").
   - Previsualización accesible de clips de video o audios.

---

## 4. Plan de Verificación

1. **Prueba funcional de división de audio**:
   - Subir archivo de audio o muestra de audio.
   - Dividir en 4 partes.
   - Verificar creación de 4 fragmentos MP3, cálculo de duración y descarga.
2. **Prueba funcional de división de video**:
   - Generar/usar clip de video de prueba con ffmpeg (video + audio).
   - Dividir en 3 fragmentos.
   - Verificar creación de 3 fragmentos MP4 válidos, sincronizados, reproducibles y descargables.
3. **Prueba de integración de transcripción de fragmento**:
   - Probar endpoint de transcripción en un fragmento de video y audio.
4. **Verificación de UI y Build**:
   - `npm run build --prefix frontend` para garantizar que no hay errores de sintaxis o bundling.
