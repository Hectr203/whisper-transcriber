/**
 * Contrato/Interfaz para los servicios de almacenamiento temporal.
 * Esto permite desacoplar la lógica de negocio del proveedor de almacenamiento específico
 * (ej. Azure Blob Storage, AWS S3, disco local, etc.)
 */
class AlmacenamientoInterfaz {
  /**
   * Sube un archivo al almacenamiento.
   * @param {string|Buffer|Stream} origen - Ruta local, Buffer o Stream de datos
   * @param {string} rutaDestino - Ruta o clave del destino (ej. 'cargas/123/archivo.mp3')
   * @param {Object} [opciones] - Opciones adicionales (metadatos, tipo MIME, etc.)
   * @returns {Promise<Object>} - Información del archivo subido
   */
  async subirArchivo(origen, rutaDestino, opciones = {}) {
    throw new Error('Método subirArchivo() no implementado');
  }

  /**
   * Descarga un archivo a una ruta local.
   * @param {string} rutaOrigen - Ruta o clave del archivo en almacenamiento
   * @param {string} rutaDestinoLocal - Ruta local donde guardar el archivo
   * @returns {Promise<void>}
   */
  async descargarArchivo(rutaOrigen, rutaDestinoLocal) {
    throw new Error('Método descargarArchivo() no implementado');
  }

  /**
   * Obtiene un flujo de lectura de un archivo almacenado.
   * @param {string} rutaOrigen - Ruta o clave del archivo en almacenamiento
   * @returns {Promise<ReadableStream>}
   */
  async obtenerFlujoArchivo(rutaOrigen) {
    throw new Error('Método obtenerFlujoArchivo() no implementado');
  }

  /**
   * Genera una URL temporal (SAS, presigned, etc.) para acceso directo.
   * @param {string} rutaOrigen - Ruta o clave del archivo
   * @param {number} expiracionMin - Minutos de validez de la URL
   * @returns {Promise<string>} - URL firmada
   */
  async generarUrlTemporal(rutaOrigen, expiracionMin = 60) {
    throw new Error('Método generarUrlTemporal() no implementado');
  }

  /**
   * Elimina un archivo del almacenamiento.
   * @param {string} rutaOrigen - Ruta o clave del archivo
   * @returns {Promise<void>}
   */
  async eliminarArchivo(rutaOrigen) {
    throw new Error('Método eliminarArchivo() no implementado');
  }

  /**
   * Verifica si un archivo existe.
   * @param {string} rutaOrigen - Ruta o clave del archivo
   * @returns {Promise<boolean>}
   */
  async existeArchivo(rutaOrigen) {
    throw new Error('Método existeArchivo() no implementado');
  }

  /**
   * Elimina todos los archivos que comiencen con un prefijo (ej. un jobId).
   * @param {string} prefijo - Prefijo a buscar
   * @returns {Promise<number>} - Cantidad de archivos eliminados
   */
  async eliminarPorPrefijo(prefijo) {
    throw new Error('Método eliminarPorPrefijo() no implementado');
  }

  /**
   * Elimina archivos que hayan superado su tiempo de retención.
   * @param {string} [prefijo] - Prefijo opcional para limitar la búsqueda
   * @param {number} [horasMaximas] - Horas de retención (usa el valor por defecto si no se indica)
   * @returns {Promise<number>} - Cantidad de archivos eliminados
   */
  async eliminarArchivosExpirados(prefijo = '', horasMaximas) {
    throw new Error('Método eliminarArchivosExpirados() no implementado');
  }
}

module.exports = AlmacenamientoInterfaz;
