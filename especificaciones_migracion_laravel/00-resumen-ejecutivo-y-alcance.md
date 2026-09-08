# 00. Resumen Ejecutivo y Alcance del Proyecto

**Proyecto:** Voxelis - Whisper Transcriber & Multimedia Suite  
**Fase:** Levantamiento de Requerimientos para Migración a Laravel  
**Fecha:** 2026-09-07  

---

## 1. Resumen Ejecutivo

Voxelis es una plataforma integral de procesamiento multimedia y texto basada en inteligencia artificial. Proporciona transcripción automática de voz a texto de alta precisión (STT) con modelos Whisper, síntesis de texto a voz (TTS) híbrida, segmentación paralela de archivos de audio y video en partes iguales, descarga directa de contenido de audio desde plataformas externas (YouTube) y refinamiento textual con modelos de lenguaje de gran tamaño (LLM).

El presente documento establece el **marco de requerimientos** para migrar la solución actual hacia el entorno de **Laravel**. La meta es transicionar hacia un ecosistema empresarial que garantice una gestión sólida del ciclo de vida de peticiones, colas de procesamiento asíncrono en segundo plano, manejo escalable de almacenamiento y APIs consistentes, preservando el 100% de la experiencia de usuario y la privacidad que caracteriza al sistema.

---

## 2. Contexto y Justificación

### 2.1 Estado Actual
- La versión original está implementada sobre un backend ligero en Node.js/Express y una interfaz en React/Vite.
- Las tareas de computación pesada (segmentación con FFmpeg y peticiones HTTP de larga duración a APIs de IA) se ejecutan dentro del proceso principal de Node.js o mediante SSE directo acoplado a la máquina local.
- La gestión de almacenamiento opera con almacenamiento temporal en disco y una capa opcional hacia Azure Blob Storage.

### 2.2 Objetivos de la Migración a Laravel
1. **Robusteza Arquitectónica:** Adoptar un marco de trabajo de estándar industrial con convenciones claras de inyección de dependencias, validación de formularios, arquitectura modular y políticas de seguridad (CSRF, sanitización, manejo de cabeceras).
2. **Desacoplamiento de Cargas Pesadas:** Establecer un pipeline formal de procesamiento asíncrono mediante Jobs, Queues (colas con Redis/Database) y eventos que aíslen las tareas de FFmpeg y llamadas externas del ciclo de vida HTTP.
3. **Escalabilidad y Concurrencia:** Permitir que la plataforma pueda absorber desde cientos hasta miles de usuarios concurrentes sin riesgo de bloqueo en el bucle de eventos del servidor web.
4. **Mantenimiento y Extensibilidad:** Facilitar la integración futura de autenticación multiusuario (si el negocio lo requiere), almacenamiento en múltiples nubes (S3, Azure Blob, Local) y pruebas automatizadas unitarias y de integración continuas.

---

## 3. Alcance del Proyecto de Migración

El alcance de la migración abarca la replicación exacta y potenciación funcional de los siguientes módulos funcionales:

1. **Ingesta de Medios:**
   - Carga de archivos locales de audio y video hasta 1024 MB.
   - Grabación directa de audio desde el navegador mediante micrófono.
   - Detección automática de pistas de video y extracción normalizada a audio.
2. **Transcripción de Voz a Texto (STT):**
   - Integración con el modelo `whisper-large-v3` vía API.
   - Troceado automático para archivos que superen los 24 MB o los 10 minutos de duración.
   - Notificación de progreso paso a paso en tiempo real hacia el cliente (etapas: subida, análisis, extracción, segmentación, transcripción, mejora, completado).
3. **División de Multimedia (Audio y Video):**
   - Modalidad de división de audio en $N$ fragmentos de igual duración en formato MP3.
   - Modalidad de división de video en $N$ fragmentos de igual duración en formato MP4 con sincronización exacta de audio y video mediante códec H.264 ultrafast y audio AAC.
   - Historial de fragmentos interactivo con capacidades de previsualización, descarga individual y transcripción de cada fragmento.
4. **Módulo de YouTube:**
   - Inspección y extracción de metadatos de videos y listas de reproducción.
   - Descarga de audio en streaming.
   - Transcripción directa de URLs de YouTube.
5. **Síntesis de Texto a Voz (TTS):**
   - Modalidad nativa del navegador con detección automática de idioma y control de pitch, rate y volumen.
   - Modalidad premium en la nube con selector de voces y control de velocidad.
6. **Mejora Textual Asistida por IA:**
   - Corrección ortográfica y de redacción (`mejorar_texto`).
   - Estructuración de instrucciones para inteligencia artificial (`mejorar_prompt`).
   - Soporte para múltiples proveedores de IA (Groq, NVIDIA, Ollama).
7. **Persistencia e Interfaz de Usuario:**
   - Historial local persistente del usuario, con filtros de búsqueda por nombre, fecha y tipo.
   - Editor de transcripción interactivo con métricas (palabras, caracteres, tiempo) y exportación a TXT y Markdown.
   - Sistema de temas visuales dinámicos (Océano, Tropical, Atardecer, Clásico) y modo oscuro OLED.

---

## 4. Fuera de Alcance

Para mantener el enfoque en la migración funcional y evitar desviaciones no autorizadas, se declara explícitamente fuera de alcance:

1. **Monetización y Pasarelas de Pago:** No se contempla la inclusión de pasarelas de pago (Stripe, PayPal, etc.) ni cobro de suscripciones en esta fase.
2. **Sistemas de Red Social o Colaboración en Vivo:** No se desarrollará edición colaborativa multi-cursor de transcripciones tipo Google Docs.
3. **Entrenamiento o Fine-Tuning de Modelos Propios:** La solución consumirá APIs de inferencia existentes; no incluye pipelines de entrenamiento o reentrenamiento de modelos Whisper o LLMs.
4. **Soporte para Formatos Obsoletos de Video/Audio Analógico:** No se soportarán contenedores o códecs discontinuados fuera de los definidos formalmente en los requerimientos.

---

## 5. Supuestos y Restricciones Generales

- **Privacidad por Diseño (*Privacy First*):** El sistema debe respetar la premisa de no obligar al usuario final a crear una cuenta para transcribir o utilizar las herramientas básicas. Las configuraciones y el historial personal deben poder residir localmente en el cliente o en sesión efímera.
- **Herramientas del Sistema:** El servidor destino debe disponer de binarios de `ffmpeg` y `ffprobe` accesibles para el procesamiento multimedia.
- **Conectividad a Proveedores de Inferencia:** El servidor debe disponer de salida a Internet hacia las APIs de Groq, ElevenLabs y NVIDIA.
