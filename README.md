# Voxelis - Whisper Transcriber & TTS

Aplicación web Full Stack para transcribir audios y videos de gran tamaño utilizando el modelo **Whisper de OpenAI (vía Groq)** y sintetizar texto a voz utilizando **ElevenLabs** y el **TTS nativo del navegador**.

Este proyecto ha sido diseñado bajo los principios de *stateless architecture* (sin base de datos tradicional), priorizando la privacidad del usuario, la fluidez de la interfaz y la flexibilidad en la gestión de credenciales.

> Para una explicación comercial, casos de uso, arquitectura para desarrolladores, ventajas y fuentes de referencia, consulta [GUIA_COMERCIAL_Y_TECNICA.md](./GUIA_COMERCIAL_Y_TECNICA.md).

---

## 🚀 Características Principales

### 🎙️ Procesamiento de Audio e IA
* **Transcripción con Whisper vía Groq:** Convierte voz en texto usando `whisper-large-v3`.
* **Procesamiento de archivos grandes:** El backend utiliza `fluent-ffmpeg` para dividir automáticamente audios y videos cuando superan el tamaño objetivo por segmento.
* **Audio desde video:** Si el archivo contiene video, FFmpeg extrae primero la pista de audio.
* **Formatos soportados:** MP3, WAV, M4A, OGG, FLAC, MP4, WebM, AAC, MOV, AVI y MKV.

### 🗣️ Texto a Voz (TTS) Híbrido
* **Modo Nativo Autodetectable:** Utiliza la API de `speechSynthesis` integrada en Chrome/Edge/Firefox. Detecta el idioma del navegador y preselecciona automáticamente la voz nativa correspondiente.
* **Controles Avanzados:** Ajuste fino de Tono (Pitch), Velocidad (Rate) y Volumen.
* **Modo IA Premium:** Integración directa con ElevenLabs para sintetizar voces ultra realistas.

### 🎨 Motor de Estilos Dinámicos (UI/UX)
* **Diseño Fluido y Expansivo:** Interfaz construida con Tailwind CSS, optimizando los márgenes laterales para aprovechar pantallas ultra-anchas en los paneles de lectura e historial.
* **Selector de Temas en Tiempo Real:** Motor basado en *Variables CSS* que permite a los usuarios alternar entre paletas de colores exclusivas (Océano Profundo, Tropical Bliss, Atardecer, Clásico) de forma instantánea y persistente.
* **Modo Oscuro OLED Premium:** Alternancia entre modo claro (fondos sutiles para alto contraste) y un modo oscuro con profundidad y estética OLED.
* **Scrollbars Personalizadas:** Barras de desplazamiento elegantes y minimalistas en toda la aplicación.

### 💾 Almacenamiento y Productividad
* **Sin base de datos de usuarios:** Las configuraciones viven en `localStorage` y el historial/cache TTS en `IndexedDB`.
* **Historial con filtros:** Búsqueda por nombre, fecha, hora, tipo de archivo y extensión.
* **Exportación sencilla:** Opciones para copiar o descargar transcripciones en `.txt` y `.md`.

---

## 📁 Arquitectura y Estructura del Proyecto

El proyecto está separado lógicamente en `frontend` y `backend`.

```text
/
├── backend/
│   ├── .env              # Variables de entorno secretas (Groq, ElevenLabs)
│   ├── src/
│   │   ├── middleware/   # Manejadores de subida de archivos (multer)
│   │   ├── routes/       # Rutas Express (transcription.js, tts.js)
│   │   ├── services/     # Lógica de FFmpeg y llamadas HTTP a la API (whisperService.js)
│   │   └── server.js     # Punto de entrada de la API Express (Puerto 3001 por defecto)
│   └── package.json
│
└── frontend/
    ├── .env              # Variables públicas (VITE_API_URL)
    ├── src/
    │   ├── components/   # Componentes UI de React (ThemeSelector, HistoryPanel, etc.)
    │   ├── utils/        # Lógica de IndexedDB (historyStorage.js)
    │   ├── index.css     # Variables CSS del Motor de Temas
    │   └── App.jsx       # Layout principal y enrutador de estados
    ├── tailwind.config.js# Mapeo de paletas dinámicas y tokens de diseño
    ├── vite.config.js    # Configuración de empaquetado y proxy de desarrollo
    └── package.json
```

---

## 🛠️ Configuración e Instalación

### Requisitos Previos
* **Node.js** v18 o superior.
* **FFmpeg** instalado (Obligatorio para trocear archivos):
  * Windows: Descargar binarios o usar `winget install ffmpeg`
  * macOS: `brew install ffmpeg`
  * Linux: `sudo apt install ffmpeg`

### Instalación Manual

**1. Configurar Backend:**
```bash
cd backend
npm install
cp .env.example .env
```
Edita `backend/.env`:
* `GROQ_API_KEY`: Clave predeterminada de Groq (fallback).
* `ELEVENLABS_API_KEY`: Clave predeterminada de ElevenLabs (fallback).
* `AZURE_STORAGE_CONNECTION_STRING`: Cadena de conexión para Azure Blob Storage.
* `AZURE_STORAGE_CONTAINER_NAME`: Contenedor para archivos temporales.
* `LOCAL_STORAGE_DIR`: Carpeta local usada como fallback cuando Azure no está configurado o falla.
* `TEMP_DIR` / `UPLOADS_DIR`: Carpetas locales para archivos temporales de FFmpeg y subidas iniciales.
* `PORT`: 3001 por defecto si no se define.

**2. Configurar Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
```
Asegúrate de que `frontend/.env` apunte al backend: `VITE_API_URL=http://localhost:3001/api`

---

## 🔒 Gestión Descentralizada de API Keys

Para evitar agotar las cuotas del servidor principal, Voxelis implementa un modelo de delegación de credenciales:
1. El usuario hace clic en **"Configuración / API Keys"** (icono de engranaje).
2. Ingresa sus claves de Groq o ElevenLabs. Estas claves **solo se guardan localmente** en el navegador (`localStorage`).
3. En cada petición, las claves viajan en los Headers (`X-Groq-Api-Key`, `X-Elevenlabs-Api-Key`).
4. Si se proveen Headers, el servidor backend los usa como prioridad uno. Si no, usa el `.env` del servidor como respaldo.

---

## 🚀 Peticiones a la API (Endpoints Principales)

* **`POST /api/transcription/upload`**: Recibe `multipart/form-data` con un archivo en el campo `audio`. Devuelve eventos SSE con progreso y resultado final. Trocea automáticamente archivos grandes.
* **`DELETE /api/transcription/cancel/:jobId`**: Marca un trabajo activo como cancelado.
* **`POST /api/youtube/analyze`**: Analiza un video o playlist de YouTube.
* **`GET /api/youtube/download`**: Descarga audio o video desde una URL de YouTube.
* **`POST /api/youtube/transcribe`**: Descarga audio de YouTube y reutiliza el flujo de transcripción.
* **`POST /api/tts/generate`**: Recibe `{ text, lang, speed }` y genera audio MP3 usando `google-tts-api`.
* **`POST /api/tts/elevenlabs`**: Recibe `{ text }` y genera audio MP3 con ElevenLabs.
* **`GET /api/health`**: Verifica estado del backend y conexión con Azure Blob Storage.

### Almacenamiento temporal sin Azure

Azure Blob Storage es opcional para pruebas locales. Si `AZURE_STORAGE_CONNECTION_STRING` no está configurada, o si Azure falla durante la subida, el backend usa almacenamiento local temporal en `backend/uploads` y `backend/temp`.

Al terminar la transcripción, el backend elimina el archivo original, los audios extraídos y los segmentos temporales asociados al trabajo.

---

## 🌍 Despliegue en Producción

1. **Construir el Frontend:**
   ```bash
   cd frontend && npm run build
   ```
   Esto generará una carpeta `dist/`.

2. **Despliegue del Backend:**
   * Usa **PM2** o **Docker** para mantener vivo el proceso `node src/server.js`.
   * Expón el servidor Express usando un proxy inverso con **Nginx** o **Caddy**, habilitando la subida de archivos grandes (`client_max_body_size 500M` en Nginx).
   * Puedes servir la carpeta `dist/` del frontend usando Nginx en la misma máquina o utilizar un servicio de CDN / Edge (ej. Vercel, Netlify) apuntando la variable de entorno `VITE_API_URL` a la IP o dominio de tu backend.

### Docker Compose

También puedes levantar ambos servicios con Docker Compose:

```bash
docker compose up --build
```

El frontend quedará disponible en `http://localhost:8080` y el backend en `http://localhost:3001`.

### Contrato de API

El contrato base de endpoints está documentado en [`docs/openapi.yaml`](./docs/openapi.yaml).

---

## ⚠️ Limitaciones Conocidas

1. **Dependencia de IndexedDB:** El rendimiento de almacenamiento depende del navegador. Archivos excesivamente gigantes (ej. un video de 3GB) podrían agotar la cuota local o saturar la RAM durante el pase a `Blob`.
2. **FFmpeg en Servidor:** El servidor de producción necesitará RAM/CPU decente si planeas procesar videos muy grandes de forma simultánea (recomendado > 2GB RAM si esperas alto tráfico de troceado de videos).
3. **Pérdida de Configuración:** Al ser una app *stateless* (sin cuentas de usuario), si se vacía la caché del navegador, el historial de audios transcritos y la configuración de paletas/claves desaparecerán.
