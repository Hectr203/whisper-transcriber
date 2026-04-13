const googleTTS = require('google-tts-api');
const url = googleTTS.getAudioUrl('Hello World', { lang: 'en', slow: false, host: 'https://translate.google.com' });
console.log(url);
