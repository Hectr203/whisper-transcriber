const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function test() {
  const form = new FormData();
  form.append('audio', fs.createReadStream('test.mp3'));

  try {
    const res = await axios.post('http://localhost:3031/api/transcription/upload', form, {
      headers: form.getHeaders(),
      responseType: 'stream'
    });
    
    res.data.on('data', chunk => {
      console.log(chunk.toString());
    });
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
