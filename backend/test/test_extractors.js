const axios = require('axios');

async function testSuno(url) {
    try {
        const initialRes = await axios.get(url, { maxRedirects: 5 });
        const html = initialRes.data;
        
        let audioUrl = null;
        let imageUrl = null;
        let title = 'Suno Audio';
        
        // Match m4a or mp3 url in cloudfront
        const audioMatch = html.match(/(https:\/\/[a-zA-Z0-9.-]+\.cloudfront\.net\/[^"\\]+\.(?:m4a|mp3))/);
        if (audioMatch) audioUrl = audioMatch[1];
        
        const titleMatch = html.match(/\\?title\\?["']?\s*:\s*\\?["']([^"\\]+)\\?["']/);
        if (titleMatch) title = titleMatch[1];
        
        const imgMatch = html.match(/(https:\/\/cdn\d\.suno\.ai\/image_large_[^"\\]+\.jpeg)/);
        if (imgMatch) imageUrl = imgMatch[1];
        
        console.log('Suno Results:', { audioUrl, imageUrl, title });
    } catch (e) {
        console.error('Suno Error:', e.message);
    }
}
testSuno('https://suno.com/s/4ZdDm5VXM9iIe5Of');
