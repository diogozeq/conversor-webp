// Utilitários para gerenciar o IndexedDB das imagens geradas

const DB_NAME = 'ImageConverterDB';
const DB_VERSION = 1;
const STORE_NAME = 'generatedImages';

export interface StoredImage {
  filename: string;
  blob: Blob;
  timestamp: number;
  originalName?: string;
}

// Função para abrir o IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'filename' });
        // Criar índice por timestamp para limpeza automática
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Gerar um nome único para o arquivo
export function generateUniqueFilename(prefix: string = 'img'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}.webp`;
}

// Salvar uma imagem no IndexedDB
export async function saveImageToDB(blob: Blob, filename?: string, originalName?: string): Promise<string> {
  const finalFilename = filename || generateUniqueFilename();
  
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const imageData: StoredImage = {
      filename: finalFilename,
      blob,
      timestamp: Date.now(),
      originalName
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(imageData);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(finalFilename);
    });
  } catch (error) {
    console.error('Erro ao salvar imagem no IndexedDB:', error);
    throw error;
  }
}

// Buscar uma imagem do IndexedDB
export async function getImageFromDB(filename: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(filename);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.blob : null);
      };
    });
  } catch (error) {
    console.error('Erro ao buscar imagem no IndexedDB:', error);
    return null;
  }
}

// Limpar imagens antigas (mais de 24 horas)
export async function cleanupOldImages(): Promise<number> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(oneDayAgo);
    
    return new Promise((resolve, reject) => {
      let deletedCount = 0;
      const request = index.openCursor(range);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
    });
  } catch (error) {
    console.error('Erro ao limpar imagens antigas:', error);
    return 0;
  }
}

// Gerar URL "falsa" para a imagem
export function generateImageURL(filename: string): string {
  return `/imagens-geradas/${filename}`;
}