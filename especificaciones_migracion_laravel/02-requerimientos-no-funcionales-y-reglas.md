# 02. Requerimientos No Funcionales y Reglas de Negocio

Este documento define los atributos de calidad, estándares de rendimiento y reglas de negocio obligatorias que rigen el sistema y su migración técnica a Laravel.

---

## 1. Catálogo de Requerimientos No Funcionales (RNF)

### 1.1 Rendimiento (Performance)

- **RNF-001: Velocidad de Inferencia de Transcripción:**
  - El tiempo de transcripción para audios de hasta 10 minutos no debe superar el 30% de la duración real del audio (ej. un audio de 10 minutos debe transcribirse en menos de 3 minutos bajo condiciones normales de API de inferencia).
- **RNF-002: Eficiencia en la Segmentación Multimedia:**
  - La segmentación de video en $N$ partes debe utilizar códecs acelerados (`-preset ultrafast` con libx264) para garantizar que el tiempo total de procesamiento de un video de 1 hora no supere los 60 a 90 segundos en el servidor de cómputo.
- **RNF-003: Tiempo de Carga Inicial de la Interfaz:**
  - El primer renderizado significativo (*First Contentful Paint*) de la aplicación web no debe superar los 1.5 segundos en redes estándar.
- **RNF-004: Eficiencia en Memoria y Flujos I/O:**
  - El servidor no debe cargar archivos completos de audio o video de 1 GB en la memoria RAM. Toda operación de subida, transformación y descarga debe gestionarse mediante flujos de datos (*streams*) y archivos temporales en disco.

---

### 1.2 Escalabilidad y Concurrencia

- **RNF-005: Soporte de Concurrencia Elástica (1,000 a 10,000 usuarios):**
  - La arquitectura del backend en Laravel debe soportar una base de usuarios activos de entre 1,000 y 10,000 usuarios registrados, con una capacidad de procesamiento concurrente simultáneo de al menos 50 a 100 trabajos pesados (FFmpeg/Whisper) sin degradar la respuesta de la API REST.
- **RNF-006: Procesamiento Desacoplado Asíncrono (Job Queue Pattern):**
  - Ninguna operación pesada de transcodificación o inferencia debe ejecutarse dentro del ciclo de vida síncrono de la petición HTTP. Las operaciones deben encolarse en un sistema de colas (Redis / Database / Azure Service Bus) con trabajadores (*workers*) independientes.
- **RNF-007: Concurrencia Controlada por Tareas:**
  - La segmentación paralela dentro de un mismo archivo debe permitir configurar el nivel máximo de subprocesos concurrentes simultáneos (parámetro `MANUAL_SPLIT_CONCURRENCY`, valor por defecto: 3 a 5) para prevenir saturación de núcleos de CPU.

---

### 1.3 Disponibilidad y Tolerancia a Fallos

- **RNF-008: Tolerancia a Desconexiones del Cliente:**
  - Si el cliente cierra el navegador durante un proceso de transcripción o división, el sistema debe registrar la cancelación del trabajo, limpiar los archivos temporales asociados en disco/nube y no desperdiciar cómputo innecesario.
- **RNF-009: Política de Reintentos Exponenciales:**
  - Ante fallos transitorios de red o códigos HTTP 429 / 503 de proveedores de IA externos, el backend debe implementar reintentos con retardo exponencial y fluctuación aleatoria (*jitter*) con un tope de 5 reintentos.
- **RNF-010: Degradación Elegante ante Ausencia de Servicios Cloud:**
  - Si el almacenamiento en la nube (Azure Blob Storage / S3) no está configurado o pierde conectividad temporalmente, el backend debe conmutar automáticamente a almacenamiento local en disco sin interrumpir el servicio.

---

### 1.4 Seguridad y Protección de Datos

- **RNF-011: Validación Estricta de Archivos en Capas Múltiples:**
  - La validación de archivos no debe basarse únicamente en la extensión del nombre, sino en la verificación de cabeceras mágicas (*magic bytes*) y tipos MIME reales reportados por el sistema operativo (`finfo` o `mime_content_type`).
- **RNF-012: Sanitización de Nombres de Archivo y Aislamiento de Rutas:**
  - Todo nombre de archivo recibido debe sanitizarse para eliminar caracteres especiales, espacios y secuencias de escape de directorio (`../`, directiva *path traversal*).
  - Cada trabajo debe ejecutarse en un directorio temporal aislado con identificador UUID v4 único.
- **RNF-013: No Persistencia de Credenciales Privadas en Servidor:**
  - Las API Keys enviadas por los usuarios no deben almacenarse en bases de datos del servidor ni quedar registradas en archivos de registro (*logs*). Deben tratarse como credenciales efímeras en memoria de ejecución.
- **RNF-014: Protección contra Ataques Web:**
  - El backend en Laravel debe implementar protección CSRF para rutas web, límites de tasa de peticiones (*rate limiting* / throttle) en endpoints de subida, y cabeceras de seguridad estrictas (CORS con orígenes explícitos, X-Content-Type-Options, X-Frame-Options).

---

### 1.5 Usabilidad y Estética

- **RNF-015: Diseño Premium y Respuesta Visual Inmediata:**
  - La interfaz de usuario debe ofrecer una experiencia dinámica y moderna, con transiciones suaves, estados de carga claros, microanimaciones e indicadores de progreso precisos.
- **RNF-016: Compatibilidad Multidispositivo y Navegadores:**
  - La solución debe ser 100% operativa en Google Chrome, Mozilla Firefox, Microsoft Edge y Safari (en sus versiones de los últimos 2 años), tanto en escritorio como en dispositivos móviles.

---

## 2. Catálogo de Reglas de Negocio (RN)

### RN-001: Límite Máximo de Tamaño de Carga
- Ningún archivo individual podrá superar los **1024 MB (1 GB)** de tamaño. Todo intento de subida superior será abortado inmediatamente antes de consumir ancho de banda innecesario.

### RN-002: Límite de Fragmentación de Medios
- El número de partes para la división de multimedia estará acotado estrictamente entre un mínimo de **1 parte** y un máximo de **100 partes**. Cualquier valor fuera de este rango debe ser rechazado en la validación de entrada.

### RN-003: Prelación de Credenciales de Inferencia (API Keys)
- **Regla:** La clave enviada por el cliente en las cabeceras HTTP (`X-Groq-Api-Key`, `X-Elevenlabs-Api-Key`, `X-Nvidia-Api-Key`) tiene prioridad absoluta. Si el cliente no la provee, se utiliza la clave global del servidor en `.env`. Si ninguna está disponible, la operación se bloquea informando al usuario.

### RN-004: Política de Ciclo de Vida y Limpieza de Archivos Temporales
- Los archivos originales subidos, las pistas de audio extraídas y los fragmentos generados son de naturaleza **estrictamente temporal**.
- Todo archivo temporal debe eliminarse del disco local inmediatamente después de ser procesado o entregado al usuario.
- En caso de almacenamiento en nube temporal, debe aplicarse una política de expiración y borrado automático a las **24 horas**.

### RN-005: Exclusividad del Modo Video para Archivos con Video
- La funcionalidad de *Dividir Video* requiere obligatoriamente que el contenedor multimedia posea al menos un flujo de video (`codec_type === 'video'`). Si se envía un archivo de solo audio, la petición debe ser rechazada con código HTTP 400 y mensaje explicativo.

### RN-006: Garantía de Sincronización A/V en Segmentación
- En la segmentación de video, los puntos de corte temporal deben forzar la recreación de fotogramas clave y cabeceras de contenedor (`faststart`) para garantizar que el primer segundo de cada fragmento no quede congelado, en negro ni con desfase de sonido respecto a la imagen.

### RN-007: Principio de Privacidad Absoluta (*No-Account Needed*)
- El uso de la plataforma para transcribir, dividir medios y sintetizar voz no debe estar condicionado al registro o inicio de sesión del usuario. El historial y las configuraciones residen en el almacenamiento del navegador del cliente salvo que el usuario decida explícitamente compartirlos.

### RN-008: Límite de Longitud para Mejora Textual con IA
- Las solicitudes de mejora de texto (`mejorar_texto` o `mejorar_prompt`) no podrán exceder de **25,000 caracteres**. Para textos más extensos, el usuario debe procesar el contenido por secciones o fragmentos.

### RN-009: Prohibición de Respuestas Conversacionales en Modos de Mejora
- Cuando se invoca la mejora de texto o estructuración de prompt, la IA debe devolver única y exclusivamente el texto procesado. Está terminantemente prohibido incluir saludos, explicaciones de cambios, notas de advertencia o preámbulos ("Aquí tienes el texto mejorado:").

### RN-010: Integridad y Confirmación en Borrado de Historial
- Toda acción de borrado masivo de transcripciones o de fragmentos multimedia debe requerir confirmación explícita del usuario a través de un diálogo modal preventivo, informando que la acción es irreversible.
