# Voxelis - Guia comercial y tecnica

Esta guia resume para que sirve el proyecto, como funciona y como presentarlo a usuarios, clientes y desarrolladores. Esta escrita a partir de la inspeccion del codigo actual del repositorio.

## Resumen en una frase

Voxelis convierte audios, videos, grabaciones y enlaces de YouTube en texto editable, y tambien permite convertir texto en voz, combinando Whisper via Groq, FFmpeg, Azure Blob Storage, React e IndexedDB.

## Problema que resuelve

Transcribir manualmente una reunion, clase, entrevista, video largo o nota de voz consume tiempo, cansa y hace facil perder informacion importante. Voxelis automatiza ese trabajo: el usuario sube un archivo o graba audio, ve el progreso del procesamiento, recibe una transcripcion lista para copiar, editar o reutilizar, y conserva un historial local.

## Usuarios ideales

- Creadores de contenido que necesitan convertir videos o audios en guiones, articulos, subtitulos o notas.
- Estudiantes que quieren transformar clases grabadas en apuntes.
- Profesionales que graban reuniones, entrevistas, llamadas o ideas de voz.
- Equipos que necesitan una herramienta simple para pasar audio a texto sin montar una plataforma pesada con cuentas y base de datos.
- Desarrolladores que quieren una base full stack para integrar STT, TTS, procesamiento de audio y almacenamiento temporal.

## Propuesta de valor para promocion

- Ahorra tiempo: reduce la friccion de escuchar, pausar, escribir y corregir manualmente.
- Soporta archivos grandes: el backend divide el audio con FFmpeg cuando excede el limite configurado para la API.
- Funciona con audio y video: si el archivo tiene video, extrae primero la pista de audio.
- Da progreso visible: el flujo de transcripcion usa Server-Sent Events para mostrar etapas como subida, analisis, division, transcripcion y finalizacion.
- Privacidad practica: el historial y las credenciales del usuario se guardan en el navegador mediante IndexedDB y localStorage; los archivos temporales del servidor se limpian al terminar.
- Flexible en costos: puede usar claves propias del usuario o claves configuradas en el servidor como respaldo.
- Incluye texto a voz: puede leer texto con SpeechSynthesis del navegador o generar audio remoto con ElevenLabs/Google TTS.
- Es facil de desplegar en contenedores: hay Dockerfile para frontend y backend.

## Como funciona para el usuario

1. El usuario abre la app y elige una opcion: subir archivo, grabar audio, usar YouTube, revisar historial o convertir texto a voz.
2. Si sube audio/video, el navegador valida formato y tamano antes de enviarlo.
3. El backend recibe el archivo en `/api/transcription/upload`.
4. El archivo se guarda temporalmente en Azure Blob Storage.
5. FFmpeg analiza el medio. Si es video, extrae audio; si es grande, lo divide en segmentos.
6. Cada segmento se envia a Groq usando el modelo `whisper-large-v3`.
7. El backend une los fragmentos y devuelve la transcripcion completa por eventos SSE.
8. El frontend muestra el texto, estadisticas, acciones de copia/descarga y opcion de leerlo con TTS.
9. El historial queda guardado en IndexedDB del navegador.

## Arquitectura actual

```text
Usuario
  |
  v
Frontend React + Vite + Tailwind
  - UploadZone / AudioRecorder / YouTubePanel
  - TextEditorTTS
  - HistoryPanel
  - IndexedDB para historial y cache TTS
  - localStorage para temas y API keys
  |
  v
Backend Express
  - /api/transcription/upload
  - /api/youtube/analyze, /download, /transcribe
  - /api/tts/generate, /elevenlabs
  - /api/health
  |
  v
Servicios internos
  - audioSplitter: FFmpeg/FFprobe, extraccion y chunking
  - whisperService: envio de chunks a Groq Whisper
  - azureBlobService: almacenamiento temporal y limpieza
  - youtubeService: analisis/descarga de YouTube
  |
  v
Proveedores externos
  - Groq: transcripcion con Whisper
  - Azure Blob Storage: archivos temporales
  - ElevenLabs / Google TTS / Web Speech API: texto a voz
```

## Componentes tecnicos clave

- `frontend/src/App.jsx`: orquesta pestanas, flujo de transcripcion, estado de progreso, historial, temas y API keys.
- `frontend/src/components/UploadZone.jsx`: valida formatos y tamano antes de subir.
- `frontend/src/components/TextEditorTTS.jsx`: editor de texto, lectura por voz nativa, TTS remoto y cache de audios.
- `frontend/src/components/YouTubePanel.jsx`: analiza enlaces de YouTube, descarga y permite transcribir.
- `frontend/src/utils/historyStorage.js`: IndexedDB para historial y cache de TTS.
- `backend/src/server.js`: configura Express, CORS, rutas, health check y Azure Blob.
- `backend/src/routes/transcription.js`: flujo principal de subida, SSE, procesamiento, limpieza y errores.
- `backend/src/services/audioSplitter.js`: FFmpeg, FFprobe, extraccion de audio y division en segmentos.
- `backend/src/services/whisperService.js`: prepara `multipart/form-data` y llama a Groq.
- `backend/src/services/azureBlobService.js`: capa de almacenamiento temporal y limpieza por prefijo/expiracion.

## Ventajas tecnicas reales

- Separacion frontend/backend clara: facilita mantenimiento y despliegue independiente.
- Procesamiento de archivos grandes: el chunking es una ventaja importante porque las APIs de transcripcion suelen tener limites de archivo.
- Progreso en tiempo real sin WebSockets: SSE es suficiente para reportar estados del servidor al navegador durante trabajos largos.
- Almacenamiento local del historial: reduce necesidad de base de datos para un MVP y evita cuentas de usuario.
- Uso de FFmpeg: permite manejar formatos variados y extraer audio de video.
- Backend stateless parcial: no depende de sesiones ni usuarios; los archivos remotos se tratan como temporales.
- Dockerfiles disponibles: buena base para produccion.

## Mensajes de marketing sugeridos

### Version corta

Convierte audios, videos y enlaces de YouTube en texto listo para usar. Voxelis evita el trabajo repetitivo de escuchar y escribir manualmente, procesa archivos grandes por partes y guarda tu historial localmente.

### Version para landing

Voxelis transforma voz en texto editable para reuniones, clases, entrevistas, videos y notas de voz. Sube un archivo, graba desde el navegador o usa un enlace de YouTube; la app analiza el contenido, divide archivos grandes cuando hace falta y entrega una transcripcion lista para copiar, descargar o convertir nuevamente en audio.

### Pitch para desarrolladores

Voxelis es una aplicacion full stack de transcripcion y TTS construida con React, Express, FFmpeg, Azure Blob Storage y Groq Whisper. Su arquitectura separa UI, procesamiento multimedia, almacenamiento temporal y proveedores de IA, lo que la hace facil de extender hacia colas de trabajo, autenticacion, multiusuario, diarizacion o despliegues empresariales.

## Casos de uso vendibles

- Convertir una reunion grabada en minuta editable.
- Pasar una clase o conferencia a apuntes.
- Extraer texto de un video largo para crear resumenes, blogs o subtitulos.
- Reutilizar entrevistas como articulos o publicaciones.
- Escuchar textos largos con TTS para revision auditiva.
- Crear una base interna para automatizaciones con voz.

## Observaciones importantes antes de promocionarlo

- Unificar marca: el codigo muestra `Voxelis`, el README dice `AudioFlow` y el repositorio se llama `whisper-transcriber`.
- Ajustar claims: el texto de la UI dice que el progreso se sincroniza "en la nube", pero el historial real se guarda en IndexedDB local.
- README desactualizado: menciona `start.sh`, `azure.yaml` y documentos de Azure que actualmente aparecen eliminados en Git.
- Endpoint documentado incorrecto: el README menciona `POST /api/transcription/transcribe`, pero el codigo usa `POST /api/transcription/upload`.
- Puertos inconsistentes: README habla de 3003, `server.js` usa 3001 por defecto y `nginx.conf` proxyea a `backend:3002`.
- TTS documentado distinto: README menciona `/api/tts/synthesize` y `/api/tts/voices`, pero el codigo expone `/api/tts/generate` y `/api/tts/elevenlabs`.
- Tests del backend: `npm test -- --runInBand` falla en este entorno por Jest 25/Node actual. Conviene actualizar Jest antes de usar esto como prueba de calidad.

## Mejoras recomendadas para motivar desarrolladores

1. Crear un README tecnico actualizado con rutas reales, puertos reales, variables `.env` y flujo de arquitectura.
2. Agregar `docker-compose.yml` para levantar frontend, backend y configuracion de red en un comando.
3. Corregir el desalineamiento de puertos entre backend, Nginx y documentacion.
4. Actualizar Jest y dejar pruebas que corran en Node 20/22.
5. Agregar OpenAPI/Swagger para que otros desarrolladores entiendan y prueben los endpoints rapido.
6. Separar `processTranscription` en un servicio de dominio, no dentro de una ruta Express, para hacerlo reutilizable sin acoplarlo a HTTP.
7. Agregar cola de trabajos para produccion, por ejemplo BullMQ/Redis o Azure Queue, si habra multiples usuarios procesando videos largos.
8. Implementar politicas nativas de lifecycle en Azure Blob para reforzar la limpieza automatica de archivos temporales.
9. Agregar limites por usuario/IP y validacion de duracion para controlar costos de Groq/ElevenLabs.
10. Cifrar API keys locales o, mejor, permitir modo servidor con vault/secret manager para clientes empresariales.
11. Agregar opcion de exportar Markdown, CSV, TXT y SRT/VTT si se quiere vender a creadores de contenido.
12. Agregar timestamps y diarizacion como mejoras premium.

## Fuentes utiles para sustentar ventajas

- OpenAI Whisper: Whisper se presenta como modelo de reconocimiento de voz general, multilingue y con identificacion de idioma. Fuente: https://github.com/openai/whisper
- Groq Speech-to-Text: la documentacion recomienda chunking para audios que exceden limites o requieren mas control. Fuente: https://console.groq.com/docs/speech-to-text
- MDN Web Speech API: SpeechSynthesis permite texto a voz desde el navegador. Fuente: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- MDN SpeechSynthesis: la interfaz permite consultar voces disponibles, iniciar, pausar y controlar sintesis. Fuente: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- Azure Blob lifecycle management: Azure permite reglas automatizadas para mover o eliminar blobs al final de su ciclo de vida. Fuente: https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-overview
- Azure Blob Storage docs: documentacion general para seguridad, acceso, transferencia y administracion de blobs. Fuente: https://learn.microsoft.com/en-us/azure/storage/blobs/

## Posicionamiento recomendado

No lo vendas como "otro transcriptor". Vendelo como una herramienta de productividad para convertir contenido hablado en material reutilizable: notas, guiones, resumenes, documentos, subtitulos y audio narrado.

El mensaje central debe ser:

> Menos tiempo transcribiendo, mas tiempo usando la informacion.

