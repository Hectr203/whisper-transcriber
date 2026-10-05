const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let audioUrl = null;
  page.on('response', response => {
    const url = response.url();
    if (url.includes('.mp3') || url.includes('.m4a') || url.includes('.wav') || url.includes('audio')) {
      console.log('Intercepted:', url);
      if (response.headers()['content-type'] && response.headers()['content-type'].includes('audio')) {
        audioUrl = url;
      }
    }
  });

  await page.goto('https://suno.com/s/4ZdDm5VXM9iIe5Of', { waitUntil: 'networkidle' });
  console.log('Final URL:', audioUrl);
  await browser.close();
})();
