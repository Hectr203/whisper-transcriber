export const dbName = 'whisper-transcriber-db';
export const storeName = 'history-store';
export const ttsStoreName = 'tts-cache-store';

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ttsStoreName)) {
        db.createObjectStore(ttsStoreName, { keyPath: 'hashKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveHistoryItem = async (item) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getHistoryItems = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort by date descending
      const items = request.result || [];
      items.sort((a, b) => b.timestamp - a.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getHistoryItem = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteHistoryItem = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearHistoryItems = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const generateHash = async (text) => {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const saveTTSAudio = async (hashKey, audioBlob) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ttsStoreName, 'readwrite');
    const store = tx.objectStore(ttsStoreName);
    const request = store.put({ hashKey, audioBlob, timestamp: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getTTSAudio = async (hashKey) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ttsStoreName, 'readonly');
    const store = tx.objectStore(ttsStoreName);
    const request = store.get(hashKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
