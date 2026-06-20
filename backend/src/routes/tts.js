const express = require('express');
const googleTTS = require('google-tts-api');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.post('/generate', async (req, res, next) => {
  try {
    const { text, lang = 'es', speed = 1 } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'El texto no puede estar vacío.' });
    }

    const results = await googleTTS.getAllAudioBase64(text, {
      lang: lang,
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.?',
    });

    const buffers = results.map(r => Buffer.from(r.base64, 'base64'));
    const finalBuffer = Buffer.concat(buffers);

    const sendAudio = (buffer) => {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="audio_generado.mp3"',
      });
      res.send(buffer);
    };

    if (speed === 1) {
      return sendAudio(finalBuffer);
    }

    // Convert speeds using FFmpeg Atempo filter chain
    const speedFloat = parseFloat(speed);
    
    // FFmpeg atempo only accepts between 0.5 and 2.0. Chain them if outside bounds.
    let filterString = '';
    let remainingSpeed = speedFloat;

    while (remainingSpeed > 2.0) {
      filterString += 'atempo=2.0,';
      remainingSpeed = remainingSpeed / 2.0;
    }
    while (remainingSpeed < 0.5) {
      filterString += 'atempo=0.5,';
      remainingSpeed = remainingSpeed / 0.5;
    }
    filterString += `atempo=${remainingSpeed.toFixed(2)}`;

    // Manejo de archvos temporales para FFmpeg
    const tempDir = path.resolve(process.env.TEMP_DIR || './src/temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const fileId = uuidv4();
    const inputPath = path.join(tempDir, `in_${fileId}.mp3`);
    const outputPath = path.join(tempDir, `out_${fileId}.mp3`);

    fs.writeFileSync(inputPath, finalBuffer);

    ffmpeg(inputPath)
      .audioFilters(filterString)
      .on('end', () => {
        const outBuffer = fs.readFileSync(outputPath);
        sendAudio(outBuffer);
        // Limpiamos los archivos temporales
        try { fs.unlinkSync(inputPath); fs.unlinkSync(outputPath); } catch (e) {}
      })
      .on('error', (err) => {
        console.error('Error FFmpeg Atempo:', err);
        try { fs.unlinkSync(inputPath); } catch (e) {}
        next(err);
      })
      .save(outputPath);

  } catch (err) {
    console.error('[TTS Router] Error details:', err);
    next(err);
  }
});

// Nueva ruta para ElevenLabs
router.post('/elevenlabs', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'El texto no puede estar vacío.' });
    }

    const apiKey = req.headers['x-elevenlabs-api-key'] || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: 'No se ha proporcionado una API Key de ElevenLabs y el servidor no tiene una predeterminada.' });
    }

    // Usar node-fetch nativo disponible en Node >= 18, o requerir 'node-fetch'
    // Whisper backend usa node-fetch según el package.json (versión 3.x)
    // Pero en Node 18+ global fetch está disponible. Lo usaremos.
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJcg', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Error al comunicarse con ElevenLabs',
        details: errorData
      });
    }

    const buffer = await response.arrayBuffer();
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'attachment; filename="audio_elevenlabs.mp3"',
    });
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('[TTS Router ElevenLabs] Error:', err);
    next(err);
  }
});

module.exports = router;
