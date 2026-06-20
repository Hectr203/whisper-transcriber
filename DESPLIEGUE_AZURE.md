# Guía Oficial de Despliegue en Azure — AudioFlow (Whisper Transcriber)

Este documento detalla la arquitectura, configuración y procedimiento paso a paso para desplegar el proyecto **AudioFlow** (Whisper Transcriber & TTS) en Microsoft Azure, utilizando Infraestructura como Código (IaC) mediante **Bicep** y la orquestación de **Azure Developer CLI (`azd`)**.

---

## 1. Arquitectura de Despliegue en Azure

Siguiendo nuestra filosofía de minimizar costos mientras garantizamos la potencia necesaria para procesar audios/videos pesados (hasta 1GB con FFmpeg), el proyecto aprovisiona los siguientes recursos en Azure:

1. **Azure Static Web App (`Free`)**: Sirve el código compilado (HTML/CSS/JS) de nuestro frontend de React + Vite a través de una CDN global. No tiene costos.
2. **Azure App Service Plan (`B1 - Básico`)**: Plan de cómputo en Linux subyacente. A diferencia del nivel gratuito (F1), el nivel B1 incluye mayor memoria RAM (1.75GB) y permite la opción "Always On" para evitar apagados durante procesos largos de segmentación de archivos masivos.
3. **Azure App Service Web App (`B1`)**: Ejecuta el entorno de servidor Node.js del backend. Procesa las solicitudes HTTP, el chunking de FFmpeg y la comunicación con Groq / ElevenLabs.
4. **Azure Storage Account (`Standard LRS`)**: Almacenamiento súper económico para hospedar los contenedores de "cargas" y "temporales" de la API antes y después del troceado, vital para evitar reventar la RAM o el disco temporal del App Service.
5. **Application Insights & Log Analytics**: Monitoreo proactivo y recolección de logs de rendimiento de Node.js en tiempo real.

---

## 2. Prevención de Errores Críticos (Parche CORS y Límites de Subida)

### El Problema de CORS (Azure Preflight)
Para evitar que el filtro de red de Azure bloquee las solicitudes `OPTIONS` (Preflight) desde el Frontend hacia la API, se eliminó la biblioteca genérica `cors` de `backend/src/server.js`.
En su lugar, se implementó un **middleware de intercepción manual** que procesa el método `OPTIONS`, respondiendo inmediatamente un `204 No Content` con cabeceras `Access-Control-Allow-Origin` inyectadas explícitamente desde la variable de entorno `CORS_ALLOWED_ORIGINS`.

### Carga de Archivos de 1GB
Para habilitar que multer y express procesen correctamente archivos de hasta 1024 MB en App Service, la variable `MAX_FILE_SIZE_MB: 1024` está forzada e inyectada a través del `main.bicep`. El uso de Azure Storage previene problemas por falta de inodos/disco local.

---

## 3. Preparativos (Requisitos Previos)

Para desplegar esta aplicación necesitas tener instalados en tu equipo:
1. [Azure CLI (`az`)](https://learn.microsoft.com/es-es/cli/azure/install-azure-cli)
2. [Azure Developer CLI (`azd`)](https://learn.microsoft.com/es-es/azure/developer/azure-developer-cli/install-azd)

Debes estar autenticado en ambos. En tu terminal ejecuta:
```bash
az login
azd auth login
```

---

## 4. Procedimiento de Despliegue Completo

Una vez que tengas el código fuente descargado localmente, sigue estos pasos:

### Paso 1: Inicialización del Entorno
Inicia el flujo de `azd`. Este comando crea la carpeta `.azure/` y configura el entorno para vincularlo a la nube.
```bash
azd init
```
*Te pedirá ingresar un nombre de entorno único, por ejemplo: `TRANSCRTOR`.*

### Paso 2: Aprovisionamiento Físico (Bicep)
Este comando leerá el archivo `infra/main.bicep` y creará las máquinas, storage y configuraciones en Azure.
```bash
azd provision
```
* **Suscripción/Grupo:** Te solicitará elegir tu suscripción y región geográfica (ej. `Central US`).
* **Secretos:** La consola te pedirá ingresar tu `groqApiKey` y `elevenLabsApiKey`. Esto los guarda de forma cifrada (`@secure()`) en el backend y no quedan en ningún repositorio.

> **Importante:** Este proceso demora alrededor de 1 a 2 minutos. ¡Espera hasta ver los checks verdes (✅)!

### Paso 3: Empaquetado y Despliegue de Código
Con la infraestructura construida, es momento de subir nuestro código fuente.
```bash
azd deploy
```
* **Frontend:** Ejecuta un `npm run build` interno en la carpeta `frontend` y sube los assets a la Static Web App.
* **Backend:** Comprime la carpeta de Node.js, la sube al App Service, e instala remotamente los paquetes de npm y FFmpeg necesarios.

---

## 5. Actualizaciones de Código (Mantenimiento)

Si modificas el código de React o de Express y quieres subir los cambios:

**Para subir cambios en ambos proyectos:**
```bash
azd deploy
```

**Para subir cambios rápidos solo al frontend:**
```bash
azd deploy frontend
```

**Para subir cambios rápidos solo al backend:**
```bash
azd deploy backend
```

---

## 6. Variables y Rutas (Notas Finales)

- **VITE_API_URL:** La orquestación inyectará automáticamente en la nube la URL productiva de la App Service a la Static Web App; sin embargo, tu archivo `.env` de frontend debería apuntar en local a `http://localhost:3001/api`.
- **Destrucción:** Si alguna vez quieres eliminar el proyecto para no seguir generando cargos, simplemente ejecuta `azd down --force --purge` y toda la infraestructura será limpiada de tu suscripción de Azure.
