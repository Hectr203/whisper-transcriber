const ytpl = require('ytpl');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

class YouTubeService {
  async analyzeUrl(url, forceType) {
    console.log(`\n[YouTubeService] Analizando URL: ${url} (forceType: ${forceType})`);
    
    if (url.includes('tiktok.com')) {
      console.log(`[YouTubeService] Detectado como TikTok.`);
      return await this.analyzeTikTok(url);
    }
    
    if (url.includes('suno.com')) {
      console.log(`[YouTubeService] Detectado como Suno.`);
      return await this.analyzeSuno(url);
    }
    
    // Si se forza cargar como playlist
    if (forceType === 'playlist' && ytpl.validateID(url)) {
      console.log(`[YouTubeService] Forzando análisis completo de PLAYLIST.`);
      return await this.analyzePlaylist(url);
    }

    let isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    let hasVideo = false;
    try {
      const urlParams = new URL(url).searchParams;
      hasVideo = urlParams.has('v');
    } catch (e) {
      console.log(`[YouTubeService] La URL no tiene formato estándar.`);
    }
    hasVideo = hasVideo || url.includes('youtu.be/');

    if (isYouTube && ytpl.validateID(url) && !hasVideo) {
      console.log(`[YouTubeService] Detectado como PLAYLIST.`);
      return await this.analyzePlaylist(url);
    } else {
      console.log(`[YouTubeService] Intentando analizar como video individual con yt-dlp...`);
      return await this.analyzeVideo(url);
    }
  }

  async analyzeTikTok(url) {
    try {
      const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const data = res.data.data;
      if (!data) throw new Error('No se encontraron datos en TikTok (TikWM).');
      return {
        type: 'video',
        platform: 'tiktok',
        videoId: data.id,
        title: data.title || 'TikTok Video',
        author: data.author?.nickname || 'TikTok User',
        thumbnail: data.cover,
        durationSec: data.duration,
        durationText: this.formatDuration(data.duration),
        isPlaylistContent: false,
        estimatedVideoMB: 'Desconocido',
        estimatedAudioMB: 'Desconocido',
        directPlayUrl: data.play,
        directAudioUrl: data.music,
        formats: {
          video: [{ itag: 'direct', qualityLabel: 'Original (Sin Marca)', container: 'mp4' }],
          video_only: [{ itag: 'direct', qualityLabel: 'Original (Sin Marca)', container: 'mp4' }],
          audio: [{ itag: 'direct', audioBitrate: 128, container: 'mp3' }]
        }
      };
    } catch (e) {
      console.error('[YouTubeService] Error analizando TikTok:', e.message);
      throw new Error('No se pudo analizar el video de TikTok. Verifica que la URL sea válida.');
    }
  }

  async analyzeSuno(url) {
    console.log(`[YouTubeService] Intento de análisis de Suno: ${url}`);
    throw new Error('Suno ha actualizado sus sistemas con encriptación (DRM) bloqueando las descargas de terceros. Actualmente no es posible descargarlos.');
  }

  async analyzeVideo(url) {
    console.log(`[YouTubeService] Iniciando extracción de datos de video mediante yt-dlp...`);
    try {
      const info = await youtubedl(url, { 
        dumpJson: true, 
        noPlaylist: true,
        noCheckCertificates: true, 
        noWarnings: true 
      });

      console.log(`[YouTubeService] Video analizado exitosamente: "${info.title}"`);

      if (!info) {
        throw new Error('No se pudo obtener información del video.');
      }

      // Filtrar formatos (simplificado para youtube-dl-exec)
      const formats = info.formats || [];
      const videoFormats = formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none');
      const audioFormats = formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
      const videoOnlyFormats = formats.filter(f => f.vcodec !== 'none' && f.acodec === 'none');

      return {
        type: 'video',
        videoId: info.id,
        title: info.title,
        author: info.uploader,
        thumbnail: info.thumbnail,
        durationSec: info.duration,
        durationText: this.formatDuration(info.duration),
        isPlaylistContent: url.includes('list='),
        estimatedVideoMB: 'Desconocido', // Es difícil predecir con exactitud sin descargar
        estimatedAudioMB: 'Desconocido',
        formats: {
          video: videoFormats.map(f => ({ itag: f.format_id, qualityLabel: f.format_note || f.resolution, container: f.ext })),
          video_only: videoOnlyFormats.map(f => ({ itag: f.format_id, qualityLabel: f.format_note || f.resolution, container: f.ext })),
          audio: audioFormats.map(f => ({ itag: f.format_id, audioBitrate: f.abr, container: f.ext }))
        }
      };
    } catch (error) {
      console.error('[YouTubeService] Error analizando video con yt-dlp:', error.message);
      throw new Error('No se pudo analizar el video. Puede que sea privado, inválido o esté restringido.');
    }
  }

  async analyzePlaylist(url) {
    console.log(`[YouTubeService] Analizando playlist con ytpl...`);
    try {
      const isMix = url.includes('list=RD');
      const limit = isMix ? 10 : 100;
      console.log(`[YouTubeService] Límite de ítems a extraer: ${limit} (Es Mix: ${isMix})`);
      
      const playlist = await ytpl(url, { limit });
      console.log(`[YouTubeService] Playlist obtenida: "${playlist.title}" con ${playlist.items.length} items`);
      return {
        type: 'playlist',
        title: playlist.title,
        author: playlist.author.name,
        totalItems: playlist.estimatedItemCount,
        items: playlist.items.map(item => ({
          id: item.id,
          title: item.title,
          url: item.shortUrl,
          thumbnail: item.bestThumbnail?.url,
          durationSec: item.durationSec,
          durationText: item.duration,
          author: item.author.name,
        }))
      };
    } catch (error) {
      console.error('[YouTubeService] Error analizando playlist:', error.message);
      throw new Error('No se pudo analizar la playlist. Verifica que no sea dinámica (como "Mix") o privada.');
    }
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Transmite el audio o video directamente al cliente usando youtube-dl-exec (yt-dlp) o descargas directas
   */
  async streamDownload(url, formatType, itag, res) {
    console.log(`\n[YouTubeService] Solicitud de DESCARGA en STREAMING iniciada para: ${url}`);
    console.log(`[YouTubeService] Formato: ${formatType}, Calidad itag: ${itag}`);

    if (url.includes('tiktok.com') || url.includes('suno.com')) {
       console.log(`[YouTubeService] Ejecutando descarga directa (TikTok/Suno)...`);
       let directUrl = '';
       let extension = formatType === 'audio' ? 'mp3' : 'mp4';
       let title = 'media';
       
       if (url.includes('tiktok.com')) {
          const tData = await this.analyzeTikTok(url);
          directUrl = formatType === 'audio' ? tData.directAudioUrl : tData.directPlayUrl;
          title = tData.title.substring(0,30).replace(/[^\w\s-]/gi, '');
       } else {
          const sData = await this.analyzeSuno(url);
          directUrl = sData.directAudioUrl;
          extension = 'm4a';
          title = sData.title.substring(0,30).replace(/[^\w\s-]/gi, '');
       }
       
       res.setHeader('Content-Disposition', `attachment; filename="${title}.${extension}"`);
       res.setHeader('Content-Type', extension === 'mp4' ? 'video/mp4' : (extension === 'm4a' ? 'audio/mp4' : 'audio/mpeg'));
       
       try {
         const response = await axios({ method: 'GET', url: directUrl, responseType: 'stream' });
         response.data.pipe(res);
       } catch (err) {
         console.error('[YouTubeService] Error de streaming directo:', err.message);
         if (!res.headersSent) res.status(500).send('Error durante la descarga directa.');
       }
       return;
    }

    let title = 'video';
    try {
      const info = await youtubedl(url, { dumpJson: true, noPlaylist: true, noCheckCertificates: true, noWarnings: true });
      title = info.title.replace(/[^\w\s-]/gi, '');
      console.log(`[YouTubeService] Título obtenido para archivo: ${title}`);
    } catch (e) {
      console.log('[YouTubeService] No se pudo obtener título rápido, usando nombre genérico');
    }

    let extension = formatType === 'audio' ? 'm4a' : 'mp4';
    let formatStr = '';

    if (itag && itag !== 'default') {
      if (formatType === 'audio') {
        formatStr = `${itag}`;
        extension = 'm4a';
      } else if (formatType === 'video_only') {
        formatStr = `${itag}`;
        extension = 'mp4';
      } else {
        formatStr = `${itag}+bestaudio/best`;
        extension = 'mp4';
      }
    } else {
      if (formatType === 'audio') {
        formatStr = 'bestaudio[ext=m4a]/bestaudio';
      } else if (formatType === 'video_only') {
        formatStr = 'bestvideo[ext=mp4]/bestvideo';
      } else {
        // Preferir m4a para audio, para video combinar el mejor video mp4 con el mejor audio
        formatStr = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best';
      }
    }

    res.setHeader('Content-Disposition', `attachment; filename="youtube_${title}.${extension}"`);
    if (formatType === 'audio') {
       res.setHeader('Content-Type', extension === 'm4a' ? 'audio/mp4' : 'audio/mpeg');
    } else {
       res.setHeader('Content-Type', `video/mp4`);
    }

    if (formatType === 'video') {
      console.log(`[YouTubeService] Iniciando descarga local temporal para fusionar video y audio...`);
      const tempDir = path.join(os.tmpdir(), `whisper_transcriber_yt_vid`);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const localFilePath = path.join(tempDir, `vid_${Date.now()}.mp4`);

      try {
        await youtubedl(url, {
          o: localFilePath,
          f: formatStr,
          mergeOutputFormat: 'mp4',
          noPlaylist: true,
          noCheckCertificates: true,
          noWarnings: true
        });
        
        console.log(`[YouTubeService] Descarga y fusión completada. Enviando al cliente...`);
        const readStream = fs.createReadStream(localFilePath);
        readStream.pipe(res);
        readStream.on('end', () => {
           console.log(`[YouTubeService] Envío completado. Eliminando temporal...`);
           fs.unlink(localFilePath, () => {});
        });
        readStream.on('error', (err) => {
           console.error('[YouTubeService] Error leyendo archivo temporal:', err);
           res.end();
           fs.unlink(localFilePath, () => {});
        });
      } catch (err) {
        console.error('[YouTubeService] Error en proceso de descarga yt-dlp:', err.message);
        if (!res.headersSent) res.status(500).send('Error durante la descarga.');
        else res.end();
      }
    } else {
      console.log(`[YouTubeService] Iniciando subprocess yt-dlp para transmitir (pipe) audio o video puro hacia cliente...`);
      const subprocess = youtubedl.exec(url, {
        o: '-',
        f: formatStr,
        noPlaylist: true,
        noCheckCertificates: true,
        noWarnings: true
      }, { stdio: ['ignore', 'pipe', 'ignore'] });

      subprocess.stdout.pipe(res);
      
      subprocess.on('close', () => console.log(`[YouTubeService] Streaming completado exitosamente.`));

      // Prevenir crash si el cliente cancela la descarga o falla yt-dlp
      subprocess.catch((err) => {
        console.log(`[YouTubeService] Proceso yt-dlp finalizó (cliente desconectado o error): ${err.message}`);
      });

      subprocess.on('error', (err) => {
        console.error('[YouTubeService] Error en proceso de streaming yt-dlp:', err);
        if (!res.headersSent) res.status(500).send('Error durante la descarga.');
        else res.end();
      });
    }
  }

  /**
   * Descarga el audio a un archivo local temporalmente y devuelve su ruta.
   */
  async downloadAudioToLocal(url, jobId) {
    console.log(`\n[YouTubeService] Preparando descarga local de audio para transcripción (Job: ${jobId})`);
    
    if (url.includes('tiktok.com') || url.includes('suno.com')) {
       console.log(`[YouTubeService] Ejecutando descarga directa de audio (TikTok/Suno) a local...`);
       let directUrl = '';
       let extension = url.includes('tiktok.com') ? 'mp3' : 'm4a';
       if (url.includes('tiktok.com')) {
          const tData = await this.analyzeTikTok(url);
          directUrl = tData.directAudioUrl;
       } else {
          const sData = await this.analyzeSuno(url);
          directUrl = sData.directAudioUrl;
       }
       
       const tempDir = path.join(os.tmpdir(), `whisper_transcriber_yt`);
       if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
       const localFilePath = path.join(tempDir, `media_${jobId}.${extension}`);
       
       try {
         const response = await axios({ method: 'GET', url: directUrl, responseType: 'stream' });
         const writer = fs.createWriteStream(localFilePath);
         response.data.pipe(writer);
         return new Promise((resolve, reject) => {
           writer.on('finish', () => resolve(localFilePath));
           writer.on('error', reject);
         });
       } catch (err) {
         throw new Error('Error al descargar el audio directamente: ' + err.message);
       }
    }

    const tempDir = path.join(os.tmpdir(), `whisper_transcriber_yt`);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const localFilePath = path.join(tempDir, `yt_${jobId}.mp3`);
    
    try {
      console.log(`[YouTubeService] Ejecutando yt-dlp con extracción a MP3...`);
      await youtubedl(url, {
        o: localFilePath,
        f: 'bestaudio',
        extractAudio: true,
        audioFormat: 'mp3',
        noPlaylist: true,
        noCheckCertificates: true,
        noWarnings: true
      });
      console.log(`[YouTubeService] Descarga local finalizada correctamente: ${localFilePath}`);
      return localFilePath;
    } catch (error) {
      console.error('[YouTubeService] Error descargando audio con yt-dlp:', error.message);
      if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
      throw new Error('Error al descargar el audio del video de YouTube.');
    }
  }
}

module.exports = new YouTubeService();
