# Almacenamiento con Azure Blob Storage

Este proyecto utiliza Azure Blob Storage para almacenar de forma segura todos los archivos temporales (subidas, fragmentos de audio, audios extraídos de video) durante el proceso de transcripción, evitando el uso del sistema de archivos local para persistencia.

## 1. Dependencias Instaladas

- `@azure/storage-blob`: SDK oficial de Azure para interactuar con Blob Storage.

## 2. Variables de Entorno Necesarias

Agrega estas variables a tu `.env` del backend (y en las variables de entorno de Vercel/Producción):

```env
# Requerido: Connection string de tu cuenta de Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=TU_CUENTA;AccountKey=TU_CLAVE;EndpointSuffix=core.windows.net

# Opcional: Nombre del contenedor (por defecto: archivos-temporales)
AZURE_STORAGE_CONTAINER_NAME=archivos-temporales

# Opcional: Retención de archivos en horas antes de considerarlos expirados (por defecto: 24)
AZURE_STORAGE_TEMP_RETENTION_HOURS=24

# Opcional: Tamaño máximo de archivo permitido (por defecto: 1024 MB)
AZURE_STORAGE_MAX_FILE_SIZE_MB=1024
```

## 3. Creación del Contenedor en Azure

1. Ve al [Portal de Azure](https://portal.azure.com).
2. Crea una "Storage account" (Cuenta de almacenamiento) si no tienes una.
3. En la sección "Access keys" (Claves de acceso), copia la "Connection string" y ponla en tu `.env`.
4. **El contenedor se creará automáticamente** la primera vez que se inicie el backend (si la connection string es válida). El contenedor se crea como **Privado** (sin acceso anónimo).

## 4. Estrategia de Limpieza Automática

Para evitar costos innecesarios, los archivos se eliminan mediante una estrategia en múltiples niveles:

1. **Bloque `finally`**: Al terminar exitosamente o fallar un proceso de transcripción, el código elimina explícitamente todos los archivos de Azure Blob asociados a ese `jobId`.
2. **Endpoint de limpieza**: Existe un endpoint en `POST /api/storage/cleanup` que elimina cualquier archivo que haya superado las `AZURE_STORAGE_TEMP_RETENTION_HOURS`.
   - **Vercel Cron Jobs**: Se recomienda configurar un cron job en Vercel que llame a este endpoint una vez al día para limpiar blobs "huérfanos" (por ejemplo, si el servidor crasheó antes del `finally`).
3. **Lifecycle Rules (Recomendado)**: Puedes configurar una regla en Azure Portal (Storage Account > Lifecycle management) para eliminar blobs en el contenedor `archivos-temporales` después de 1 o 2 días.

## 5. Pruebas y Validación

El código cuenta con validación estricta de tipos MIME, extensiones y tamaños máximos.
Para ejecutar los tests automatizados:

```bash
cd backend
npm test
```

## 6. Consideraciones para Vercel Serverless

- **Timeouts**: Las Vercel Functions tienen un límite de 10s (Hobby) o 60s (Pro). Archivos grandes o videos que requieran dividir o extraer audio usando ffmpeg **pueden exceder este tiempo**.
- **FFmpeg**: Vercel no incluye `ffmpeg` en su entorno estándar. La app asume que `ffmpeg` está disponible en el sistema. Para un despliegue puramente Serverless, se requeriría una capa adicional (`@ffmpeg-installer/ffmpeg`) o procesar todo de manera síncrona en un VPS.
- **Sistema efímero (`/tmp`)**: La app utiliza `os.tmpdir()` para procesar archivos localmente con `ffmpeg` antes o después de interactuar con Azure. Esto cumple con los requisitos de Vercel (límite ~512MB en `/tmp`).

## 7. Rotación de Credenciales

Si necesitas rotar las claves:

1. Genera una nueva clave ("Key 2") en Azure Portal.
2. Actualiza la variable `AZURE_STORAGE_CONNECTION_STRING` en tu `.env` o en Vercel con la nueva connection string.
3. Guarda y redespliega. El cambio será inmediato. No necesitas modificar código.
