const axios = require('axios');
axios({ method: 'GET', url: 'https://d2lwuy8qc234o3.cloudfront.net/1/clip/30f1cbca-3018-4142-bbcb-4cd76b20adef.m4a', responseType: 'stream' })
  .then(res => console.log('Success, status:', res.status))
  .catch(err => console.error('Error:', err.message));
