const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const AlmacenamientoInterfaz = require('./almacenamientoInterfaz');

class AzureBlobService extends AlmacenamientoInterfaz {
  constructor() {
    super();
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'archivos-temporales';
    this.defaultRetentionHours = parseInt(process.env.AZURE_STORAGE_TEMP_RETENTION_HOURS || '24', 10);
    
    if (!this.connectionString) {
      console.warn('⚠️ AZURE_STORAGE_CONNECTION_STRING no está configurada. AzureBlobService fallará si se intenta usar.');
    } else {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    }
  }

  /**
   * Inicializa el contenedor si no existe.
   * Debe llamarse al inicio de la aplicación o la primera vez que se usa el servicio.
   */
  async inicializar() {
    if (!this.containerClient) return;
    try {
      const exists = await this.containerClient.exists();
      if (!exists) {
        await this.containerClient.create(); // Privado por defecto
        console.log(`[AzureBlob] Contenedor '${this.containerName}' creado.`);
      }
    } catch (error) {
      console.error('[AzureBlob] Error inicializando contenedor:', error.message);
      throw error;
    }
  }

  async subirArchivo(origen, rutaDestino, opciones = {}) {
    if (!this.containerClient) throw new Error('Azure Blob Storage no está configurado.');

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
    if (!this.containerClient) throw new Error('Azure Blob Storage no está configurado.');
    
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    try {
      await blockBlobClient.downloadToFile(rutaDestinoLocal);
    } catch (error) {
      console.error(`[AzureBlob] Error descargando archivo ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async obtenerFlujoArchivo(rutaOrigen) {
    if (!this.containerClient) throw new Error('Azure Blob Storage no está configurado.');
    
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
    if (!this.containerClient) throw new Error('Azure Blob Storage no está configurado.');
    
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    try {
      return await blockBlobClient.downloadToBuffer();
    } catch (error) {
      console.error(`[AzureBlob] Error obteniendo buffer para ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async generarUrlTemporal(rutaOrigen, expiracionMin = 60) {
    if (!this.containerClient) throw new Error('Azure Blob Storage no está configurado.');
    
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
    if (!this.containerClient) throw new Error('Azure Blob Storage no está configurado.');
    
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    try {
      await blockBlobClient.deleteIfExists();
    } catch (error) {
      console.error(`[AzureBlob] Error eliminando archivo ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async existeArchivo(rutaOrigen) {
    if (!this.containerClient) throw new Error('Azure Blob Storage no está configurado.');
    
    const blockBlobClient = this.containerClient.getBlockBlobClient(rutaOrigen);
    try {
      return await blockBlobClient.exists();
    } catch (error) {
      console.error(`[AzureBlob] Error verificando existencia de ${rutaOrigen}:`, error.message);
      throw error;
    }
  }

  async eliminarPorPrefijo(prefijo) {
    if (!this.containerClient) return 0;
    
    let count = 0;
    try {
      for await (const blob of this.containerClient.listBlobsFlat({ prefix: prefijo })) {
        const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
        await blockBlobClient.deleteIfExists();
        count++;
      }
      return count;
    } catch (error) {
      console.error(`[AzureBlob] Error eliminando por prefijo ${prefijo}:`, error.message);
      throw error;
    }
  }

  async eliminarArchivosExpirados(prefijo = '', horasMaximas = this.defaultRetentionHours) {
    if (!this.containerClient) return 0;
    
    let count = 0;
    const umbralExpiracion = new Date();
    umbralExpiracion.setHours(umbralExpiracion.getHours() - horasMaximas);

    try {
      for await (const blob of this.containerClient.listBlobsFlat({ prefix: prefijo })) {
        // Verificamos si el blob fue creado antes del umbral
        if (blob.properties.createdOn < umbralExpiracion) {
          const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
          await blockBlobClient.deleteIfExists();
          count++;
        }
      }
      return count;
    } catch (error) {
      console.error(`[AzureBlob] Error eliminando expirados:`, error.message);
      throw error;
    }
  }
}

// Exportamos una instancia (Singleton)
const azureBlobService = new AzureBlobService();
module.exports = azureBlobService;
