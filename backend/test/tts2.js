const googleTTS = require('google-tts-api');
googleTTS.getAllAudioBase64('Hola mundo, esta es una prueba de texto largo para ver como se dividen los audios y luego podemos unirlos todos.', { lang: 'es', slow: false }).then(console.log);
