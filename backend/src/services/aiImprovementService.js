const axios = require('axios');

const PROMPT_MEJORAR_TEXTO = `Actúa como corrector profesional de redacción en español. Tu tarea es mejorar el texto que te proporcionaré, corrigiendo errores de sintaxis, ortografía, puntuación, redacción y claridad. Debes conservar siempre el sentido original del contenido, sin interpretar, agregar ideas nuevas ni modificar la intención del mensaje.
Requisitos:
1. Corrige errores gramaticales, ortográficos y de puntuación.
2. Mejora la claridad y fluidez del texto.
3. Elimina redundancias o repeticiones innecesarias.
4. Organiza mejor las ideas cuando sea necesario.
5. Mantén intacto el significado original.
6. No inventes información ni cambies el propósito del texto.
7. Redacta el resultado en español claro, formal y estructurado.

Texto a mejorar:`;

const PROMPT_MEJORAR_PROMPT = `Actúa como ingeniero de prompts experto. Tu tarea será tomar el texto que te proporcione y transformarlo en un prompt altamente efectivo y estructurado para modelos de lenguaje.
Requisitos:
1. Extrae la intención principal y los objetivos clave del texto original.
2. Estructura el prompt con instrucciones claras, contexto, formato deseado y restricciones.
3. Utiliza un tono directivo y preciso.
4. No respondas al prompt, solo devuelve el prompt mejorado listo para ser usado.

Texto original:`;

async function callGroq(prompt, text, clientKey) {
  // Use AI_API_KEY as the default fallback for Groq since that's what was in the user's .env previously
  const apiKey = clientKey || process.env.AI_API_KEY || process.env.GROQ_API_KEY; 
  if (!apiKey) throw new Error('MISSING_API_KEY: No hay API key configurada para Groq');
  
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant', 
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.choices[0].message.content;
}

async function callOpenAI(prompt, text, clientKey) {
  const apiKey = clientKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('MISSING_API_KEY: No hay API key configurada para ChatGPT');
  
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.choices[0].message.content;
}

async function callOllama(prompt, text) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';
  
  const response = await axios.post(
    `${baseUrl}/api/generate`,
    {
      model: model,
      system: prompt,
      prompt: text,
      stream: false,
      temperature: 0.3
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.response;
}

async function improveContent(text, operation, provider = 'groq', clientKeys = {}) {
  const prompt = operation === 'mejorar_prompt' ? PROMPT_MEJORAR_PROMPT : PROMPT_MEJORAR_TEXTO;
  
  try {
    switch (provider) {
      case 'chatgpt':
        try {
          return await callOpenAI(prompt, text, clientKeys.chatgpt);
        } catch (err) {
          if (err.message && err.message.includes('MISSING_API_KEY')) throw err;
          console.warn('Error con ChatGPT, intentando fallback con Groq...', err.message);
          if (err.response && err.response.data) {
            console.warn('Detalle error OpenAI:', JSON.stringify(err.response.data));
          }
          return await callGroq(prompt, text, clientKeys.groq);
        }
      case 'ollama':
        try {
          return await callOllama(prompt, text);
        } catch (err) {
          console.warn('Error con Ollama, intentando fallback con Groq...', err.message);
          return await callGroq(prompt, text, clientKeys.groq);
        }
      case 'groq':
      default:
        return await callGroq(prompt, text, clientKeys.groq);
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: Status ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      throw error;
    }
  }
}

module.exports = {
  improveContent
};
