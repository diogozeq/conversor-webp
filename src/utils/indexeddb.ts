// Utilitários para gerenciar o IndexedDB das imagens geradas com validações de segurança

const DB_NAME = 'ImageConverterDB';
const DB_VERSION = 1;
const STORE_NAME = 'generatedImages';

// Security constants
const MAX_STORED_IMAGES = 100;
const MAX_BLOB_SIZE = 50 * 1024 * 1024; // 50MB per image
const ALLOWED_BLOB_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/gif'];

export interface StoredImage {
  filename: string;
  blob: Blob;
  timestamp: number;
  originalName?: string;
  checksum?: string; // For integrity validation
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

// Validate blob security
function validateBlob(blob: Blob): boolean {
  if (!blob || blob.size === 0) return false;
  if (blob.size > MAX_BLOB_SIZE) return false;
  if (!ALLOWED_BLOB_TYPES.includes(blob.type)) return false;
  return true;
}

// Generate checksum for integrity validation
async function generateChecksum(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sanitize filename for security
function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 255);
}

// Salvar uma imagem no IndexedDB com validações de segurança
export async function saveImageToDB(blob: Blob, filename?: string, originalName?: string): Promise<string> {
  try {
    // Validate blob security
    if (!validateBlob(blob)) {
      throw new Error('Invalid blob: security validation failed');
    }

    // Generate or sanitize filename
    const finalFilename = filename ? sanitizeFilename(filename) : generateUniqueFilename();
    if (!finalFilename) {
      throw new Error('Invalid filename after sanitization');
    }

    const db = await openDB();
    
    // Check storage limits
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const count = await new Promise<number>((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count images'));
    });

    if (count >= MAX_STORED_IMAGES) {
      throw new Error('Storage limit reached');
    }

    // Generate checksum for integrity
    const checksum = await generateChecksum(blob);

    const imageData: StoredImage = {
      filename: finalFilename,
      blob,
      timestamp: Date.now(),
      originalName: originalName ? sanitizeFilename(originalName) : undefined,
      checksum
    };

    return new Promise((resolve, reject) => {
      const request = store.put(imageData);
      request.onerror = () => reject(new Error('Failed to save image'));
      request.onsuccess = () => resolve(finalFilename);
    });
  } catch (error) {
    console.error('Erro ao salvar imagem no IndexedDB:', error);
    throw new Error('Failed to save image: ' + (error instanceof Error ? error.message : 'unknown error'));
  }
}

// Buscar uma imagem do IndexedDB com validações de segurança
export async function getImageFromDB(filename: string): Promise<Blob | null> {
  try {
    // Sanitize filename input
    const sanitizedFilename = sanitizeFilename(filename);
    if (!sanitizedFilename || sanitizedFilename !== filename) {
      console.warn('Invalid filename provided:', filename);
      return null;
    }

    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const result = await new Promise<StoredImage | null>((resolve, reject) => {
      const request = store.get(sanitizedFilename);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });

    if (!result) return null;

    // Validate blob integrity if checksum exists
    if (result.checksum) {
      try {
        const currentChecksum = await generateChecksum(result.blob);
        if (currentChecksum !== result.checksum) {
          console.error('Blob integrity check failed for:', sanitizedFilename);
          return null;
        }
      } catch (error) {
        console.error('Error validating blob integrity:', error);
        return null;
      }
    }

    // Validate blob security
    if (!validateBlob(result.blob)) {
      console.error('Blob security validation failed for:', sanitizedFilename);
      return null;
    }

    return result.blob;
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