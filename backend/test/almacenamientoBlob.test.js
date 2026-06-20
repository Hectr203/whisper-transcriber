process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=mock;AccountKey=mock;EndpointSuffix=core.windows.net';
const azureBlobService = require('../src/services/azureBlobService');
const { BlobServiceClient, BlockBlobClient, ContainerClient } = require('@azure/storage-blob');
const fs = require('fs');

// Mockear el SDK de Azure
jest.mock('@azure/storage-blob', () => {
  const mBlockBlobClient = {
    uploadFile: jest.fn().mockResolvedValue({}),
    downloadToFile: jest.fn().mockResolvedValue({}),
    deleteIfExists: jest.fn().mockResolvedValue({}),
    exists: jest.fn().mockResolvedValue(true),
    url: 'https://mock.blob.core.windows.net/container/file.mp3'
  };

  const mContainerClient = {
    exists: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({}),
    getBlockBlobClient: jest.fn(() => mBlockBlobClient),
    listBlobsFlat: jest.fn().mockReturnValue([
      { name: 'temporales/123/chunk_1.mp3', properties: { createdOn: new Date(Date.now() - 48*3600*1000) } }
    ])
  };

  const mBlobServiceClient = {
    getContainerClient: jest.fn(() => mContainerClient),
    credential: {}
  };

  return {
    BlobServiceClient: {
      fromConnectionString: jest.fn(() => mBlobServiceClient)
    },
    BlobSASPermissions: {
      parse: jest.fn()
    },
    generateBlobSASQueryParameters: jest.fn(() => 'mock-sas-token')
  };
});

describe('AzureBlobService', () => {
  beforeEach(() => {
    // Resetear mocks
    jest.clearAllMocks();
  });

  it('debería subir un archivo correctamente desde una ruta local', async () => {
    const res = await azureBlobService.subirArchivo('/ruta/local.mp3', 'cargas/local.mp3');
    expect(res.url).toBe('https://mock.blob.core.windows.net/container/file.mp3');
    expect(res.ruta).toBe('cargas/local.mp3');
  });

  it('debería verificar existencia de archivo', async () => {
    const exists = await azureBlobService.existeArchivo('cargas/test.mp3');
    expect(exists).toBe(true);
  });

  it('debería eliminar archivo correctamente', async () => {
    await azureBlobService.eliminarArchivo('cargas/test.mp3');
    // Si no lanza error, consideramos éxito
    expect(true).toBe(true); 
  });

  it('debería generar una URL temporal (SAS)', async () => {
    const url = await azureBlobService.generarUrlTemporal('cargas/test.mp3', 60);
    expect(url).toContain('mock-sas-token');
  });

  it('debería limpiar archivos expirados', async () => {
    const eliminados = await azureBlobService.eliminarArchivosExpirados('temporales/', 24);
    expect(eliminados).toBe(1);
  });
});
