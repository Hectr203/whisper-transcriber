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

module.exports = router;
