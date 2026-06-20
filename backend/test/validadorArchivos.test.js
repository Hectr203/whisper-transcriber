const { validarArchivo } = require('../src/middleware/validadorArchivos');

describe('Validador de Archivos', () => {
  it('debería aceptar un archivo MP3 válido', () => {
    const file = {
      originalname: 'test.mp3',
      mimetype: 'audio/mpeg',
      size: 1024
    };
    expect(validarArchivo(file)).toBe(true);
  });

  it('debería rechazar un archivo con mimetype y extensión no permitida', () => {
    const file = {
      originalname: 'virus.exe',
      mimetype: 'application/x-msdownload',
      size: 1024
    };
    expect(() => validarArchivo(file)).toThrow('Formato no soportado');
  });

  it('debería rechazar un archivo vacío', () => {
    const file = {
      originalname: 'vacio.mp3',
      mimetype: 'audio/mpeg',
      size: 0
    };
    expect(() => validarArchivo(file)).toThrow('vacío');
  });

  it('debería fallar si no se proporciona archivo', () => {
    expect(() => validarArchivo(null)).toThrow('No se ha proporcionado');
  });
});
