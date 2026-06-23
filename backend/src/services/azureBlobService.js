const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const AlmacenamientoInterfaz = require('./almacenamientoInterfaz');

class AzureBlobService extends AlmacenamientoInterfaz {
  constructor() {
    super();
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'archivos-temporales';
    this.defaultRetentionHours = parseInt(process.env.AZURE_STORAGE_TEMP_RETENTION_HOURS || '24', 10);
    this.localBaseDir = process.env.LOCAL_STORAGE_DIR || path.join(__dirname, '..', '..', 'uploads');
    this.storageMode = 'local';
    
    if (!this.connectionString) {
      console.warn('⚠️ AZURE_STORAGE_CONNECTION_STRING no está configurada. Se usará almacenamiento local temporal.');
    } else {
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        this.storageMode = 'azure';
      } catch (error) {
        console.warn('[Storage] Configuración de Azure inválida. Se usará almacenamiento local temporal:', error.message);
        this.storageMode = 'local';
      }
    }
  }

  /**
   * Inicializa el contenedor si no existe.
   * Debe llamarse al inicio de la aplicación o la primera vez que se usa el servicio.
   */
  async inicializar() {
    await this.inicializarLocal();
    if (!this.containerClient) {
      console.log(`[Storage] Modo local activo en ${this.localBaseDir}`);
      return;
    }
    try {
      const exists = await this.containerClient.exists();
      if (!exists) {
        await this.containerClient.create(); // Privado por defecto
        console.log(`[AzureBlob] Contenedor '${this.containerName}' creado.`);
      }
      this.storageMode = 'azure';
    } catch (error) {
      console.warn('[AzureBlob] Error inicializando contenedor. Se usará almacenamiento local temporal:', error.message);
      this.storageMode = 'local';
    }
  }

  async subirArchivo(origen, rutaDestino, opciones = {}) {
    if (this.storageMode === 'azure' && this.containerClient) {
      try {
        return await this.subirArchivoAzure(origen, rutaDestino, opciones);
      } catch (error) {
        console.warn(`[Storage] Azure falló al subir ${rutaDestino}. Usando almacenamiento local temporal:`, error.message);
        this.storageMode = 'local';
      }
    }

    return this.subirArchivoLocal(origen, rutaDestino, opciones);
  }

  async subirArchivoAzure(origen, rutaDestino, opciones = {}) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaDestino);
    const options = {
      blobHTTPHeaders: {
        blobContentType: opciones.mimetype || 'application/octet-stream',
      },
      metadata: {
        temporal: 'true',
        jobId: opciones.jobId || 'unknown',
        ...opciones.metadata
      }
    };

    try {
      if (typeof origen === 'string') {
        // Es una ruta local
        await blockBlobClient.uploadFile(origen, options);
      } else if (Buffer.isBuffer(origen)) {
        // Es un Buffer
        await blockBlobClient.uploadData(origen, options);
      } else if (typeof origen.pipe === 'function') {
        // Es un Stream
        const streamOptions = { bufferSize: 4 * 1024 * 1024, maxBuffers: 20 }; // 4MB chunks
        await blockBlobClient.uploadStream(origen, streamOptions.bufferSize, streamOptions.maxBuffers, options);
      } else {
        throw new Error('Origen de archivo no soportado.');
      }
      return { url: blockBlobClient.url, ruta: rutaDestino };
    } catch (error) {
      console.error(`[AzureBlob] Error subiendo archivo ${rutaDestino}:`, error.message);
      throw error;
    }
  }

  async descargarArchivo(rutaOrigen, rutaDestinoLocal) {
    if (this.storageMode === 'azure' && this.containerClient) {
      try {
        return await this.descargarArchivoAzure(rutaOrigen, rutaDestinoLocal);
      } catch (error) {
        console.warn(`[Storage] Azure falló al descargar ${rutaOrigen}. Intentando almacenamiento local:`, error.message);
        this.storageMode = 'local';
      }
    }

    return this.descargarArchivoLocal(rutaOrigen, rutaDestinoLocal);
  }

  async descargarArchivoAzure(rutaOrigen, rutaDestinoLocal) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    try {
      await blockBlobClient.downloadToFile(rutaDestinoLocal);
    } catch (error) {
      console.error(`[AzureBlob] Error descargando archivo ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async obtenerFlujoArchivo(rutaOrigen) {
    if (this.storageMode === 'azure' && this.containerClient) {
      try {
        return await this.obtenerFlujoArchivoAzure(rutaOrigen);
      } catch (error) {
        console.warn(`[Storage] Azure falló al obtener flujo para ${rutaOrigen}. Intentando almacenamiento local:`, error.message);
        this.storageMode = 'local';
      }
    }

    return this.obtenerFlujoArchivoLocal(rutaOrigen);
  }

  async obtenerFlujoArchivoAzure(rutaOrigen) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    try {
      const downloadBlockBlobResponse = await blockBlobClient.download(0);
      return downloadBlockBlobResponse.readableStreamBody;
    } catch (error) {
      console.error(`[AzureBlob] Error obteniendo flujo para ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async obtenerBufferArchivo(rutaOrigen) {
    if (this.storageMode === 'azure' && this.containerClient) {
      try {
        return await this.obtenerBufferArchivoAzure(rutaOrigen);
      } catch (error) {
        console.warn(`[Storage] Azure falló al obtener buffer para ${rutaOrigen}. Intentando almacenamiento local:`, error.message);
        this.storageMode = 'local';
      }
    }

    return this.obtenerBufferArchivoLocal(rutaOrigen);
  }

  async obtenerBufferArchivoAzure(rutaOrigen) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    try {
      return await blockBlobClient.downloadToBuffer();
    } catch (error) {
      console.error(`[AzureBlob] Error obteniendo buffer para ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async generarUrlTemporal(rutaOrigen, expiracionMin = 60) {
    if (this.storageMode !== 'azure' || !this.containerClient) {
      return this.generarUrlTemporalLocal(rutaOrigen);
    }

    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn);
    expiresOn.setMinutes(startsOn.getMinutes() + expiracionMin);

    try {
      const sasToken = generateBlobSASQueryParameters({
        containerName: this.containerName,
        blobName: rutaOrigen,
        permissions: BlobSASPermissions.parse("r"), // Read only
        startsOn,
        expiresOn,
      }, this.blobServiceClient.credential).toString();

      return `${blockBlobClient.url}?${sasToken}`;
    } catch (error) {
      console.error(`[AzureBlob] Error generando URL temporal para ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async eliminarArchivo(rutaOrigen) {
    if (this.containerClient) {
      try {
        const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
        await blockBlobClient.deleteIfExists();
      } catch (error) {
        console.warn(`[AzureBlob] Error eliminando archivo ${rutaOrigen}:`, error.message);
      }
    }

    await this.eliminarArchivoLocal(rutaOrigen);
  }

  async existeArchivo(rutaOrigen) {
    if (this.storageMode === 'azure' && this.containerClient) {
      try {
        const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
        return await blockBlobClient.exists();
      } catch (error) {
        console.warn(`[Storage] Azure falló verificando ${rutaOrigen}. Intentando almacenamiento local:`, error.message);
        this.storageMode = 'local';
      }
    }

    return this.existeArchivoLocal(rutaOrigen);
  }

  async eliminarPorPrefijo(prefijo) {
    let count = 0;

    if (this.containerClient) {
      try {
        for await (const blob of this.containerClient.listBlobsFlat({ prefix: prefijo })) {
          const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
          await blockBlobClient.deleteIfExists();
          count++;
        }
      } catch (error) {
        console.warn(`[AzureBlob] Error eliminando por prefijo ${prefijo}:`, error.message);
      }
    }

    count += await this.eliminarPorPrefijoLocal(prefijo);
    return count;
  }

  async eliminarArchivosExpirados(prefijo = '', horasMaximas = this.defaultRetentionHours) {
    let count = 0;
    const umbralExpiracion = new Date();
    umbralExpiracion.setHours(umbralExpiracion.getHours() - horasMaximas);

    if (this.containerClient) {
      try {
        for await (const blob of this.containerClient.listBlobsFlat({ prefix: prefijo })) {
          // Verificamos si el blob fue creado antes del umbral
          if (blob.properties.createdOn < umbralExpiracion) {
            const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
            await blockBlobClient.deleteIfExists();
            count++;
          }
        }
      } catch (error) {
        console.warn(`[AzureBlob] Error eliminando expirados:`, error.message);
      }
    }

    count += await this.eliminarArchivosExpiradosLocal(prefijo, umbralExpiracion);
    return count;
  }

  getStatus() {
    return {
      mode: this.storageMode,
      azureConfigured: Boolean(this.containerClient),
      localBaseDir: this.localBaseDir
    };
  }

  async inicializarLocal() {
    await fs.promises.mkdir(this.localBaseDir, { recursive: true });
    await fs.promises.mkdir(path.join(this.localBaseDir, 'cargas'), { recursive: true });
    await fs.promises.mkdir(path.join(this.localBaseDir, 'temporales'), { recursive: true });
  }

  getLocalPath(ruta) {
    const normalized = path.normalize(ruta).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(this.localBaseDir, normalized);
    const rootPath = path.resolve(this.localBaseDir);
    if (!fullPath.startsWith(rootPath + path.sep) && fullPath !== rootPath) {
      throw new Error('Ruta de almacenamiento local inválida.');
    }
    return fullPath;
  }

  async subirArchivoLocal(origen, rutaDestino, opciones = {}) {
    await this.inicializarLocal();
    const destino = this.getLocalPath(rutaDestino);
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });

    if (typeof origen === 'string') {
      await fs.promises.copyFile(origen, destino);
    } else if (Buffer.isBuffer(origen)) {
      await fs.promises.writeFile(destino, origen);
    } else if (typeof origen.pipe === 'function') {
      await pipeline(origen, fs.createWriteStream(destino));
    } else {
      throw new Error('Origen de archivo no soportado.');
    }

    const metadataPath = `${destino}.metadata.json`;
    await fs.promises.writeFile(metadataPath, JSON.stringify({
      temporal: true,
      jobId: opciones.jobId || 'unknown',
      mimetype: opciones.mimetype || 'application/octet-stream',
      createdAt: new Date().toISOString(),
      metadata: opciones.metadata || {}
    }, null, 2));

    return { url: `local://${rutaDestino}`, ruta: rutaDestino, storage: 'local' };
  }

  async descargarArchivoLocal(rutaOrigen, rutaDestinoLocal) {
    const origen = this.getLocalPath(rutaOrigen);
    await fs.promises.mkdir(path.dirname(rutaDestinoLocal), { recursive: true });
    await fs.promises.copyFile(origen, rutaDestinoLocal);
  }

  async obtenerFlujoArchivoLocal(rutaOrigen) {
    return fs.createReadStream(this.getLocalPath(rutaOrigen));
  }

  async obtenerBufferArchivoLocal(rutaOrigen) {
    return fs.promises.readFile(this.getLocalPath(rutaOrigen));
  }

  async generarUrlTemporalLocal(rutaOrigen) {
    return `local://${rutaOrigen}`;
  }

  async eliminarArchivoLocal(rutaOrigen) {
    const archivo = this.getLocalPath(rutaOrigen);
    await fs.promises.rm(archivo, { force: true }).catch(() => {});
    await fs.promises.rm(`${archivo}.metadata.json`, { force: true }).catch(() => {});
  }

  async existeArchivoLocal(rutaOrigen) {
    try {
      await fs.promises.access(this.getLocalPath(rutaOrigen), fs.constants.F_OK);
      return true;
    } catch (_) {
      return false;
    }
  }

  async eliminarPorPrefijoLocal(prefijo) {
    const target = this.getLocalPath(prefijo);
    const root = path.resolve(this.localBaseDir);
    if (target === root) return 0;

    if (await this.existeDirectorioLocal(target)) {
      const count = await this.contarArchivosLocal(target);
      await fs.promises.rm(target, { recursive: true, force: true });
      return count;
    }

    const parent = path.dirname(target);
    const basename = path.basename(target);
    if (!(await this.existeDirectorioLocal(parent))) return 0;

    const entries = await fs.promises.readdir(parent, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.name.startsWith(basename)) continue;
      const entryPath = path.join(parent, entry.name);
      count += entry.isDirectory() ? await this.contarArchivosLocal(entryPath) : 1;
      await fs.promises.rm(entryPath, { recursive: true, force: true });
    }
    return count;
  }

  async eliminarArchivosExpiradosLocal(prefijo, umbralExpiracion) {
    const target = this.getLocalPath(prefijo || '.');
    if (!(await this.existeDirectorioLocal(target))) return 0;

    let count = 0;
    const entries = await fs.promises.readdir(target, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(target, entry.name);
      const stats = await fs.promises.stat(entryPath);
      if (stats.mtime < umbralExpiracion) {
        count += entry.isDirectory() ? await this.contarArchivosLocal(entryPath) : 1;
        await fs.promises.rm(entryPath, { recursive: true, force: true });
      } else if (entry.isDirectory()) {
        count += await this.eliminarArchivosExpiradosLocal(path.relative(this.localBaseDir, entryPath), umbralExpiracion);
      }
    }
    return count;
  }

  async existeDirectorioLocal(dirPath) {
    try {
      return (await fs.promises.stat(dirPath)).isDirectory();
    } catch (_) {
      return false;
    }
  }

  async contarArchivosLocal(dirPath) {
    let count = 0;
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      count += entry.isDirectory() ? await this.contarArchivosLocal(entryPath) : 1;
    }
    return count;
  }
}

// Exportamos una instancia (Singleton)
const azureBlobService = new AzureBlobService();
module.exports = azureBlobService;
