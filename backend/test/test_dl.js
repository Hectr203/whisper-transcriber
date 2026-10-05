const axios = require('axios');
const fs = require('fs');

async function download() {
  const url = 'https://d2lwuy8qc234o3.cloudfront.net/1/clip/30f1cbca-3018-4142-bbcb-4cd76b20adef.m4a';
  const response = await axios({ method: 'GET', url, responseType: 'stream' });
  const writer = fs.createWriteStream('/tmp/test.m4a');
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
download().then(() => {
  const stats = fs.statSync('/tmp/test.m4a');
  console.log('File size:', stats.size);
}).catch(console.error);
