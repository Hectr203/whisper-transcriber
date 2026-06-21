const ytpl = require('ytpl');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const os = require('os');

class YouTubeService {
  async analyzeUrl(url, forceType) {
    console.log(`\n[YouTubeService] Analizando URL: ${url} (forceType: ${forceType})`);
    
    // Si se forza cargar como playlist
    if (forceType === 'playlist') {
      if (!ytpl.validateID(url)) {
        throw new Error('Esta lista de reproducción no se puede analizar porque es privada, personal (como "Ver más tarde") o es inaccesible.');
      }
      console.log(`[YouTubeService] Forzando análisis completo de PLAYLIST.`);
      return await this.analyzePlaylist(url);
    }

    // Detectamos si la URL tiene un parámetro 'v=' (es decir, apunta a un video específico)
    let hasVideo = false;
    try {
      const urlParams = new URL(url).searchParams;
      hasVideo = urlParams.has('v');
    } catch (e) {
      console.log(`[YouTubeService] La URL no tiene formato estándar (posiblemente youtu.be)`);
    }
    
    hasVideo = hasVideo || url.includes('youtu.be/');

    if (hasVideo) {
      console.log(`[YouTubeService] Detectado como VIDEO específico.`);
      return await this.analyzeVideo(url);
    } else if (ytpl.validateID(url)) {
      console.log(`[YouTubeService] Detectado como PLAYLIST.`);
      return await this.analyzePlaylist(url);
    } else {
      console.log(`[YouTubeService] URL inválida.`);
      throw new Error('La URL proporcionada no es un enlace válido de YouTube.');
    }
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
   * Transmite el audio o video directamente al cliente usando youtube-dl-exec (yt-dlp)
   */
  async streamDownload(url, formatType, itag, res) {
    console.log(`\n[YouTubeService] Solicitud de DESCARGA en STREAMING iniciada.`);
    console.log(`[YouTubeService] Formato: ${formatType}, Calidad itag: ${itag}`);
    let title = 'video';
    try {
      const info = await youtubedl(url, { dumpJson: true, noPlaylist: true, noCheckCertificates: true, noWarnings: true });
      title = info.title.replace(/[^\w\s-]/gi, '');
      console.log(`[YouTubeService] Título obtenido para archivo: ${title}`);
    } catch (e) {
      console.log('[YouTubeService] No se pudo obtener título rápido, usando nombre genérico');
    }

    let extension = formatType === 'audio' ? 'mp3' : 'mp4';
    let formatStr = '';

    if (itag && itag !== 'default') {
      formatStr = `${itag}`;
      if (formatType === 'audio') extension = 'm4a';
    } else {
      formatStr = formatType === 'audio' ? 'bestaudio' : 'best';
    }

    res.setHeader('Content-Disposition', `attachment; filename="youtube_${title}.${extension}"`);
    if (formatType === 'audio') {
       res.setHeader('Content-Type', 'audio/mpeg');
    } else {
       res.setHeader('Content-Type', `video/${extension}`);
    }

    console.log(`[YouTubeService] Iniciando subprocess yt-dlp para transmitir (pipe) hacia cliente...`);
    const subprocess = youtubedl.exec(url, {
      o: '-',
      f: formatStr,
      noPlaylist: true,
      noCheckCertificates: true,
      noWarnings: true
    }, { stdio: ['ignore', 'pipe', 'ignore'] });

    subprocess.stdout.pipe(res);
    
    subprocess.on('close', () => console.log(`[YouTubeService] Streaming completado exitosamente.`));

    subprocess.on('error', (err) => {
      console.error('[YouTubeService] Error en proceso de streaming yt-dlp:', err);
      if (!res.headersSent) {
        res.status(500).send('Error durante la descarga.');
      } else {
        res.end();
      }
    });
  }

  /**
   * Descarga el audio a un archivo local temporalmente y devuelve su ruta.
   */
  async downloadAudioToLocal(url, jobId) {
    console.log(`\n[YouTubeService] Preparando descarga local de audio para transcripción (Job: ${jobId})`);
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
