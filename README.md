# Whisper Transcriber & TTS

Aplicación web Full Stack para transcribir audios de gran tamaño utilizando el modelo **Whisper de OpenAI (vía Groq)** y sintetizar texto a voz utilizando **ElevenLabs** y el **TTS nativo del navegador**.

Este proyecto está diseñado para funcionar de manera completamente *stateless* (sin base de datos) y permitir tanto una configuración centralizada (API keys en el servidor) como personalizada (cada usuario ingresa sus propias API keys guardadas en el navegador de manera segura).

## 🚀 Características Principales

* **Sin Base de Datos:** Todo se guarda en tu navegador (`localStorage` para configuraciones, `IndexedDB` para el historial de archivos grandes).
* **Gestión Flexible de API Keys:** Usa las credenciales gratuitas de la empresa desde el `.env` o permite a los usuarios poner las suyas para no consumir los límites de la cuenta principal.
* **Procesamiento de Archivos Grandes:** El backend utiliza `fluent-ffmpeg` para trocear audios de más de 24 MB para eludir los límites de la API de Whisper.
* **Texto a Voz (TTS) Híbrido:**
  * Modo Nativo: Utiliza la API de `speechSynthesis` integrada en Chrome/Edge/Firefox (sin límite, gratuito).
  * Modo IA Premium: Integración con ElevenLabs a través del backend para voces ultra realistas.

---

## 📁 Estructura del Proyecto

El proyecto está separado lógicamente en `frontend` y `backend`.

```text
/
├── backend/
│   ├── .env              # Variables de entorno secretas y de configuración
│   ├── src/
│   │   ├── middleware/   # Manejadores de subida de archivos (multer)
│   │   ├── routes/       # Rutas Express (transcription.js, tts.js)
│   │   ├── services/     # Lógica de FFmpeg y llamadas HTTP a Groq (whisperService.js)
│   │   └── server.js     # Punto de entrada de la API
│   └── package.json
│
└── frontend/
    ├── .env              # Variables públicas (VITE_API_URL)
    ├── src/
    │   ├── components/   # React Components (ApiKeysConfig, TextEditorTTS, etc)
    │   ├── utils/        # Lógica de almacenamiento IndexedDB (historyStorage.js)
    │   └── App.jsx       # Interfaz Principal
    ├── vite.config.js    # Configuración de compilación y proxy
    └── package.json
```

---

## ⚙️ Requisitos Previos

* **Node.js** v18 o superior.
* **FFmpeg** instalado en la máquina o servidor donde se ejecuta el backend.
  * Windows: Descargar binarios o usar `winget install ffmpeg`
  * macOS: `brew install ffmpeg`
  * Ubuntu/Debian: `sudo apt install ffmpeg`

---

## 🛠️ Configuración e Instalación

### 1. Configurar el Backend

```bash
cd backend
npm install
cp .env.example .env
```

Abre el archivo `backend/.env` y configura tus variables:

* `GROQ_API_KEY`: Tu clave predeterminada de Groq (necesaria para transcripciones si el usuario no pone la suya).
* `ELEVENLABS_API_KEY`: Tu clave predeterminada de ElevenLabs (opcional, para TTS IA).
* `PORT`: Puerto (ej. 3003).

### 2. Configurar el Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Abre `frontend/.env` (si lo creaste) y asegúrate de que apunte al backend (solo necesario en producción, en desarrollo Vite hace proxy automático):

```env
VITE_API_URL=http://localhost:3003/api
```

---

## 💻 Ejecución en Desarrollo

Para ejecutar ambos entornos localmente en modo desarrollo:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
# El servidor correrá en http://localhost:3003
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
# La aplicación abrirá en http://localhost:5173
```

---

## 🔒 Privacidad y Configuración Personal de API Keys

Por defecto, la aplicación usará la `GROQ_API_KEY` del backend.
Sin embargo, para evitar agotar la cuota del servidor principal:

1. El usuario puede hacer clic en el botón **"API Keys"** en la esquina superior derecha del frontend.
2. Ingresar su propia clave de **Groq** o **ElevenLabs**.
3. Estas claves **se guardan localmente usando `localStorage`**. No viajan por la URL, no se almacenan en el servidor, no quedan registradas en los logs del servidor y no afectan a otros usuarios.
4. Cuando el usuario procesa un archivo, su clave se envía en el header HTTP (`X-Groq-Api-Key` o `X-Elevenlabs-Api-Key`) y el servidor la usa exclusivamente en esa petición.

Si el usuario borra sus credenciales del frontend, la aplicación volverá a utilizar la configuración predeterminada del backend.

---

## 🚀 Despliegue en Producción

### 1. Construir el Frontend
```bash
cd frontend
npm run build
```
Esto generará una carpeta `dist/` con archivos HTML, CSS y JS listos para servir.

### 2. Preparar el Servidor Backend
En producción, tu servidor Node.js debería:
1. Ejecutar el backend con PM2 o Docker (`pm2 start src/server.js`).
2. Servir los archivos estáticos de la carpeta `dist/` a través de **Nginx** o directamente integrarlos en Express si se prefiere.

Asegúrate de que en el servidor de producción el `backend/.env` contenga las API Keys correctas si deseas proveer el servicio de manera gratuita a tus usuarios.

---

## ⚠️ Limitaciones Conocidas

* **Navegadores Soportados:** Se requiere un navegador moderno con soporte para `IndexedDB` y `SpeechSynthesis API` (Chrome, Edge, Firefox, Safari actualizados).
* **Almacenamiento Local:** Si el usuario vacía la caché del navegador, perderá el historial de transcripciones (ya que viven en su máquina) y las API keys guardadas en `localStorage`.
* **Archivos muy pesados:** El backend acepta subidas grandes, pero el navegador puede consumir demasiada memoria RAM al mantener el archivo `Blob` activo en `IndexedDB`. Archivos mayores a 500MB deben monitorearse.
