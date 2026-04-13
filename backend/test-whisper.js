require('dotenv').config({ path: './.env' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function run() {
  fs.writeFileSync('test.txt', 'This is a test');
  
  try {
    console.log('Sending with Axios...');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream('test.txt'));
    formData.append('model', 'whisper-large-v3');

    const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      // You can define a custom httpsAgent if needed, e.g. for connection keep-alive
      // httpsAgent: new require('https').Agent({ keepAlive: true }),
    });

    console.log('Response:', response.data);
  } catch (err) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Network Error:', err.message, err.code);
    }
  }
}

run();
