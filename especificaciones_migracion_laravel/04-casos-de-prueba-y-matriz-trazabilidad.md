# 04. Casos de Prueba, Matriz de Trazabilidad y Gestión de Riesgos

Este documento establece los Casos de Prueba (CP) ejecutables, la matriz de trazabilidad extremo a extremo, las condiciones de finalización y el análisis de riesgos para la migración técnica a Laravel.

---

## 1. Casos de Prueba Formales (CP)

Siguiendo la plantilla oficial de la Agencia de Proyectos Existentes:

| ID | Criterio Asociado | Escenario | Pasos | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| **CP-001** | CA-001, CA-002 | Validación de formatos y tamaño | 1. Intentar subir archivo .exe.<br>2. Intentar subir video de 1.2 GB.<br>3. Subir video MP4 válido de 50 MB. | Pasos 1 y 2 retornan error HTTP 400 y 413. Paso 3 es aceptado y analizado exitosamente. |
| **CP-002** | CA-003 | Grabación directa por micrófono | 1. Conceder permiso de micrófono.<br>2. Iniciar grabación de 5 segundos.<br>3. Detener y enviar a transcripción. | El navegador genera un blob de audio válido con temporizador y el backend lo procesa sin errores. |
| **CP-003** | CA-004 | Extracción de audio desde video | 1. Subir archivo MP4 con video y audio.<br>2. Iniciar transcripción. | El sistema invoca FFmpeg, extrae la pista a MP3 64 kbps y transcribre el audio resultante. |
| **CP-004** | CA-005, CA-006 | Segmentación automática para archivos extensos | 1. Subir un archivo de audio de 45 minutos (50 MB).<br>2. Solicitar transcripción. | El sistema divide el archivo en 5 chunks de 10 min, los transcribe ordenadamente y unifica el texto completo. |
| **CP-005** | CA-007 | Emisión de eventos de progreso en tiempo real | 1. Enviar archivo a transcribir.<br>2. Monitorear el flujo de eventos SSE/WebSocket. | El cliente recibe sucesivamente eventos `uploading`, `analyzing`, `transcribing` con porcentaje creciente hasta `complete`. |
| **CP-006** | CA-008 | Uso de API Key provista por el cliente | 1. Configurar una clave inválida en el cliente (`gsk_fake`).<br>2. Enviar petición con cabecera `X-Groq-Api-Key: gsk_fake`. | La petición falla con error 401 de Groq, demostrando que se utilizó la clave del cliente y no la del servidor. |
| **CP-007** | CA-009 | Reintento automático ante Rate Limiting | 1. Simular respuesta HTTP 429 desde la API externa.<br>2. Monitorear reintentos en logs del servidor. | El worker espera el retardo exponencial y reintenta hasta 5 veces antes de abortar. |
| **CP-008** | CA-010, CA-011 | Edición y exportación de transcripción | 1. Abrir resultado de transcripción.<br>2. Modificar texto manualmente.<br>3. Probar botones de copiar, descargar .txt y .md. | Los contadores de palabras y caracteres se actualizan en tiempo real; los archivos descargados contienen el texto editado. |
| **CP-009** | CA-012, CA-014 | Cambio de modo en División de Multimedia y cálculo | 1. Entrar a *División de Multimedia*.<br>2. Cambiar a modo Video.<br>3. Cargar video de 10 minutos y fijar 5 partes. | El selector cambia a modo video; el sistema indica: "Duración por fragmento: ~ 2 min 00 s". |
| **CP-010** | CA-015 | Segmentación de video en clips MP4 | 1. Subir video MP4 de 30 segundos.<br>2. Seleccionar 3 partes en modo Video.<br>3. Ejecutar división. | Se generan 3 clips .mp4 de 10s cada uno con pista de video y audio perfectamente sincronizados y reproducibles. |
| **CP-011** | CA-016 | Rechazo de archivo sin video en modo Video | 1. Seleccionar modo *Dividir Video*.<br>2. Intentar procesar un archivo MP3 de solo audio. | La interfaz y el backend impiden la acción y muestran alerta explicativa: "El archivo no contiene video". |
| **CP-012** | CA-017 | Segmentación de audio en partes MP3 | 1. Cargar audio de 1 minuto en modo Audio.<br>2. Dividir en 4 partes. | Se generan 4 fragmentos .mp3 de 15 segundos cada uno con bitrate constante. |
| **CP-013** | CA-018 | Previsualización y descarga en historial de fragmentos | 1. Abrir historial de fragmentos generados.<br>2. Hacer clic en botón de previsualización (Play).<br>3. Hacer clic en Descargar. | Se abre el modal con reproductor `<video>` o `<audio>` funcional con reproducción inmediata; la descarga guarda el archivo con nombre correcto. |
| **CP-014** | CA-019 | Transcripción directa de un fragmento | 1. Localizar un fragmento en el historial.<br>2. Presionar "Transcribir". | El fragmento específico se procesa con Whisper y su resultado se muestra en el editor de transcripción. |
| **CP-015** | CA-020, CA-021 | Análisis y transcripción de URL de YouTube | 1. Ingresar URL pública de YouTube.<br>2. Analizar metadatos.<br>3. Transcribir. | Se extraen título y miniatura; el audio se descarga en streaming y se transcribe entregando el texto completo. |
| **CP-016** | CA-022 | Síntesis TTS Nativa en navegador | 1. Ingresar texto en español.<br>2. Ajustar velocidad a 1.25x y presionar Escuchar. | El navegador sintetiza la voz con la voz española predeterminada a velocidad 1.25x sin peticiones al servidor. |
| **CP-017** | CA-023 | Síntesis TTS Cloud con ElevenLabs | 1. Configurar clave de ElevenLabs.<br>2. Seleccionar voz y generar audio. | Se obtiene un buffer de audio MP3 con entonación natural y opción de descarga directa. |
| **CP-018** | CA-024, CA-025 | Modos de mejora de texto con IA | 1. Probar `mejorar_texto` sobre texto con faltas.<br>2. Probar `mejorar_prompt` sobre una nota desordenada. | En el caso 1 se devuelve el texto corregido sin saludos; en el caso 2 se devuelve un prompt estructurado (Rol, Tarea, Restricciones). |
| **CP-019** | CA-026 | Límite de caracteres en mejora textual | 1. Enviar texto de 26,000 caracteres al endpoint de mejora. | El sistema retorna error HTTP 413 informando que excede el límite de 25,000 caracteres. |
| **CP-020** | CA-027, CA-028 | Persistencia local y borrado con confirmación | 1. Realizar una transcripción y recargar la página.<br>2. Filtrar historial por fecha.<br>3. Presionar "Limpiar historial" y cancelar.<br>4. Presionar y confirmar. | La transcripción persiste tras recarga; el filtro la encuentra; cancelar conserva los datos; confirmar los elimina. |
| **CP-021** | CA-029 | Cambio dinámico de temas visuales | 1. Alternar sucesivamente entre Océano, Tropical, Atardecer y Clásico.<br>2. Conmutar modo oscuro.<br>3. Recargar página. | La interfaz adapta todos sus colores de fondo y acento en tiempo real; tras la recarga se preserva la configuración elegida. |
| **CP-022** | CA-030 | Procesamiento asíncrono no bloqueante | 1. Lanzar 5 trabajos de segmentación de video simultáneos.<br>2. Realizar peticiones GET de health check y consulta de historial. | Las consultas HTTP responden en menos de 100 ms; los 5 trabajos se procesan en los workers sin saturar el servidor web. |
| **CP-023** | RN-004 | Limpieza automática de archivos temporales | 1. Ejecutar un trabajo de segmentación o transcripción.<br>2. Verificar directorio temporal del sistema operativo. | Los archivos temporales locales son eliminados al finalizar el trabajo; no quedan residuos huérfanos. |
| **CP-024** | RNF-012 | Prevención de ataques de Path Traversal | 1. Intentar subir un archivo con nombre `../../etc/passwd`. | El sistema sanitiza el nombre eliminando secuencias relativas y asigna un identificador UUID seguro. |

---

## 2. Matriz de Trazabilidad (RF -> HU -> CA -> CP)

| Requerimiento Funcional | Historia de Usuario | Criterio de Aceptación | Caso de Prueba |
| :--- | :--- | :--- | :--- |
| **RF-001, RF-002** | HU-001 | CA-001, CA-002 | CP-001 |
| **RF-003** | HU-002 | CA-003 | CP-002 |
| **RF-004, RF-005** | HU-001 | CA-004 | CP-003 |
| **RF-006, RF-007** | HU-001, HU-003 | CA-005, CA-006 | CP-004 |
| **RF-008** | HU-003 | CA-007 | CP-005 |
| **RF-009, RF-010** | HU-001, HU-016 | CA-008, CA-009 | CP-006, CP-007 |
| **RF-011, RF-034** | HU-004, HU-005 | CA-010, CA-011 | CP-008 |
| **RF-012, RF-013, RF-014** | HU-009, HU-010 | CA-012, CA-013, CA-014 | CP-009 |
| **RF-015, RF-016** | HU-010 | CA-015, CA-016 | CP-010, CP-011 |
| **RF-016, RF-017** | HU-009 | CA-017 | CP-012 |
| **RF-017** | HU-011, HU-012 | CA-018, CA-019 | CP-013, CP-014 |
| **RF-018, RF-019, RF-020, RF-021** | HU-013 | CA-020, CA-021 | CP-015 |
| **RF-022, RF-024, RF-025, RF-026** | HU-014 | CA-022 | CP-016 |
| **RF-023, RF-025** | HU-015 | CA-023 | CP-017 |
| **RF-027, RF-028, RF-029** | HU-006, HU-007, HU-008 | CA-024, CA-025 | CP-018 |
| **RF-030** | HU-006, HU-007 | CA-026 | CP-019 |
| **RF-031, RF-032, RF-033** | HU-004, HU-005 | CA-027, CA-028 | CP-020 |
| **RF-035, RF-036, RF-037, RF-038** | HU-016 | CA-029 | CP-021 |
| **RNF-005, RNF-006, RNF-007** | HU-003, HU-010 | CA-030 | CP-022 |
| **RN-004, RNF-012** | HU-001, HU-010 | CA-001, CA-018 | CP-023, CP-024 |

---

## 3. Condiciones de Finalización de la Migración

Para declarar la migración a Laravel como completada y exitosa ante el Asistente Principal y QA, deben verificarse las siguientes compuertas:

- [ ] Todos los 38 Requerimientos Funcionales (RF-001 a RF-038) se encuentran implementados y respaldados con código en el backend Laravel.
- [ ] Los 30 Criterios de Aceptación (CA-001 a CA-030) obtienen el estado **Cumplido** respaldado por evidencias en ejecución real.
- [ ] Los 24 Casos de Prueba (CP-001 a CP-024) concluyen con resultado satisfactorio sin defectos críticos abiertos.
- [ ] La segmentación de audio y de video opera con FFmpeg en colas asíncronas de Laravel sin bloquear la API REST.
- [ ] No existen vulnerabilidades bloqueantes ni fugas de credenciales en logs o almacenamiento público.
- [ ] La documentación de arquitectura, variables de entorno y comandos de despliegue coincide exactamente con el código entregado.

---

## 4. Matriz de Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Estrategia de Mitigación |
| :--- | :--- | :--- | :--- |
| **Timeout en subida de archivos de 1 GB en Laravel/PHP** | Alta | Alto | Configurar `upload_max_filesize = 1024M`, `post_max_size = 1024M`, `max_execution_time = 600` en `php.ini`, o implementar carga directa a almacenamiento mediante SAS/Presigned URLs. |
| **Saturación de CPU por múltiples tareas concurrentes de FFmpeg** | Alta | Alto | Desacoplar la transcodificación a Workers de Laravel (`php artisan queue:work`) con límite de concurrencia y prioridad de colas. |
| **Cierre de conexión SSE en servidores web (Nginx/Apache)** | Media | Medio | Deshabilitar el almacenamiento en búfer de proxy (`X-Accel-Buffering: no` en Nginx) y enviar paquetes *heartbeat* cada 15 segundos. |
| **Rate Limit (HTTP 429) en API de Whisper de Groq** | Media | Alto | Implementar limitador de tasa (*RateLimiter*) en la cola de Laravel y reintentos automáticos con retardo exponencial. |
| **Dependencias de binarios del sistema (FFmpeg y yt-dlp)** | Media | Alto | Utilizar contenedores Docker estandarizados o scripts de aprovisionamiento que verifiquen la presencia de FFmpeg y yt-dlp antes de iniciar la aplicación. |

---

## 5. Preguntas Abiertas para la Fase de Arquitectura de Laravel

1. **¿Qué motor de colas se prefiere para el entorno de producción?**
   - Opción recomendada: **Redis** con **Laravel Horizon** para supervisión gráfica de trabajos y reintentos, o base de datos relacional para entornos locales.
2. **¿Se mantendrá la interfaz de usuario en React o se prefiere migrar a Blade / Livewire + Alpine.js?**
   - La especificación está desacoplada: permite tanto mantener el frontend React comunicándose por API REST con Laravel, como implementar vistas interactivas con Livewire si se busca una integración monolítica en PHP.
