const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Analiza una URL de YouTube (video o playlist)
 */
export const analyzeYouTubeUrl = async (url, forceType = null) => {
  const body = { url };
  if (forceType) body.forceType = forceType;

  const response = await fetch(`${API_BASE}/youtube/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al analizar la URL.');
  }

  return await response.json();
};

/**
 * Genera la URL de descarga directa para un video/audio de YouTube
 */
export const getDownloadUrl = (url, formatType, itag = 'default') => {
  const params = new URLSearchParams({
    url,
    format: formatType, // 'audio' o 'video'
    itag
  });
  return `${API_BASE}/youtube/download?${params.toString()}`;
};

/**
 * Descarga el archivo abriendo la URL en una nueva pestaña
 */
export const triggerDownload = (url, formatType, itag = 'default') => {
  const downloadUrl = getDownloadUrl(url, formatType, itag);
  window.open(downloadUrl, '_blank');
};
