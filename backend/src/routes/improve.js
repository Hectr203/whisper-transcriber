const express = require('express');
const router = express.Router();
const { improveContent } = require('../services/aiImprovementService');

router.post('/', async (req, res) => {
  try {
    const { text, operation, provider } = req.body;
    
    // Extraer llaves pasadas desde el frontend si existen
    const clientKeys = {
      groq: req.headers['x-groq-api-key'],
      nvidia: req.headers['x-nvidia-api-key'] || req.headers['x-openai-api-key']
    };

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'El texto es obligatorio y no puede estar vacío' });
    }

    if (!['mejorar_texto', 'mejorar_prompt'].includes(operation)) {
      return res.status(400).json({ error: 'Operación no soportada' });
    }

    if (text.length > 25000) {
      return res.status(413).json({ error: 'El texto es demasiado largo para ser procesado' });
    }

    const finalProvider = provider === 'chatgpt' ? 'nvidia' : provider;
    const improvedText = await improveContent(text, operation, finalProvider, clientKeys);

    res.json({
      success: true,
      originalLength: text.length,
      improvedLength: improvedText.length,
      result: improvedText
    });
  } catch (error) {
    console.error('[Route] Error en improve:', error.message);
    res.status(500).json({
      error: 'Error al procesar el texto con IA',
      message: error.message
    });
  }
});

module.exports = router;
