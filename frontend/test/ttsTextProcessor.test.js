import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareTTSContent } from '../src/utils/ttsTextProcessor.js';

test('prepareTTSContent con texto plano genera texto y mapeo 1 a 1', () => {
  const text = 'Hola mundo, esta es una prueba de voz.';
  const { speechText, getGlobalCharIndex } = prepareTTSContent(text, 0, false);
  
  assert.equal(speechText, text);
  // 'Hola' está en char 0
  assert.equal(getGlobalCharIndex(0), 0);
  // 'mundo' empieza en char 5
  assert.equal(getGlobalCharIndex(5), 5);
});

test('prepareTTSContent limpia encabezados y negritas manteniendo mapeo exacto', () => {
  const markdown = '# Título Principal\n\nEste es un texto **importante** aquí.';
  const { speechText, getGlobalCharIndex } = prepareTTSContent(markdown, 0, true);

  // No debe contener # ni **
  assert.ok(!speechText.includes('#'));
  assert.ok(!speechText.includes('**'));
  assert.ok(speechText.includes('Título'));
  assert.ok(speechText.includes('importante'));

  // El mapeo de 'Título' debe apuntar al índice en markdown (donde empieza Título)
  const tituloIdxInSpeech = speechText.indexOf('Título');
  const tituloIdxInMd = markdown.indexOf('Título');
  assert.equal(getGlobalCharIndex(tituloIdxInSpeech), tituloIdxInMd);

  // El mapeo de 'importante' debe apuntar al índice dentro de **importante** en markdown
  const impIdxInSpeech = speechText.indexOf('importante');
  const impIdxInMd = markdown.indexOf('importante');
  assert.equal(getGlobalCharIndex(impIdxInSpeech), impIdxInMd);
});

test('prepareTTSContent procesa tablas markdown fila por fila sin barras separadoras', () => {
  const tableMd = `| Nombre | Rol |
| --- | --- |
| Ana | Dev |
| Luis | QA |`;

  const { speechText, getGlobalCharIndex } = prepareTTSContent(tableMd, 0, true);

  // No debe contener | ni ---
  assert.ok(!speechText.includes('|'));
  assert.ok(!speechText.includes('---'));
  
  // Debe contener las palabras en orden
  assert.ok(speechText.includes('Nombre'));
  assert.ok(speechText.includes('Rol'));
  assert.ok(speechText.includes('Ana'));
  assert.ok(speechText.includes('Dev'));
  assert.ok(speechText.includes('Luis'));
  assert.ok(speechText.includes('QA'));

  // Cada celda mapea a su posición real en la tabla
  const anaIdxInSpeech = speechText.indexOf('Ana');
  const anaIdxInMd = tableMd.indexOf('Ana');
  assert.equal(getGlobalCharIndex(anaIdxInSpeech), anaIdxInMd);

  const qaIdxInSpeech = speechText.indexOf('QA');
  const qaIdxInMd = tableMd.indexOf('QA');
  assert.equal(getGlobalCharIndex(qaIdxInSpeech), qaIdxInMd);
});

test('prepareTTSContent procesa bloques de código y diagramas mermaid', () => {
  const codeMd = `\`\`\`js
const total = 100;
\`\`\``;

  const { speechText, getGlobalCharIndex } = prepareTTSContent(codeMd, 0, true);

  // No debe incluir las comillas invertidas ``` ni la palabra js como etiqueta suelta
  assert.ok(!speechText.includes('```'));
  assert.ok(speechText.includes('const'));
  assert.ok(speechText.includes('total'));

  const constIdxInSpeech = speechText.indexOf('const');
  const constIdxInMd = codeMd.indexOf('const');
  assert.equal(getGlobalCharIndex(constIdxInSpeech), constIdxInMd);
});

test('prepareTTSContent soporta inicio desde un offset específico', () => {
  const text = 'Primera palabra. Segunda palabra. Tercera palabra.';
  const offset = text.indexOf('Segunda');
  const { speechText, getGlobalCharIndex } = prepareTTSContent(text, offset, false);

  assert.ok(speechText.startsWith('Segunda'));
  assert.equal(getGlobalCharIndex(0), offset);
});
