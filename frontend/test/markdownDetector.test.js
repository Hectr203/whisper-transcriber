import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMarkdownContent } from '../src/utils/markdownDetector.js';

test('detectMarkdownContent detecta encabezados markdown', () => {
  assert.equal(detectMarkdownContent('# Título principal'), true);
  assert.equal(detectMarkdownContent('### Subtítulo'), true);
  assert.equal(detectMarkdownContent('No es encabezado # sin espacio'), false);
});

test('detectMarkdownContent detecta negritas y cursivas', () => {
  assert.equal(detectMarkdownContent('Este es un texto **en negrita** aquí'), true);
  assert.equal(detectMarkdownContent('Texto con *cursiva* normal'), true);
  assert.equal(detectMarkdownContent('Texto simple sin formato alguno'), false);
});

test('detectMarkdownContent detecta listas ordenadas y desordenadas', () => {
  assert.equal(detectMarkdownContent('- Primer punto\n- Segundo punto'), true);
  assert.equal(detectMarkdownContent('* Punto con asterisco'), true);
  assert.equal(detectMarkdownContent('1. Primer paso\n2. Segundo paso'), true);
});

test('detectMarkdownContent detecta enlaces y bloques de código', () => {
  assert.equal(detectMarkdownContent('[Enlace a web](https://example.com)'), true);
  assert.equal(detectMarkdownContent('Código en línea `const a = 1;`'), true);
  assert.equal(detectMarkdownContent('```js\nconsole.log(123);\n```'), true);
});

test('detectMarkdownContent retorna false para cadenas vacías o texto plano común', () => {
  assert.equal(detectMarkdownContent(''), false);
  assert.equal(detectMarkdownContent(null), false);
  assert.equal(detectMarkdownContent(undefined), false);
  assert.equal(detectMarkdownContent('Esta es una transcripción regular de audio sin marcas especiales.'), false);
});
