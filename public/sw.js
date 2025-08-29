// Service Worker com validações de segurança para interceptar requisições de imagens geradas
const DB_NAME = 'ImageConverterDB';
const DB_VERSION = 1;
const STORE_NAME = 'generatedImages';
const IMAGE_PATH_PREFIX = '/imagens-geradas/';

// Cache dos blobs para melhor performance
const blobCache = new Map();

// Security constants
const ALLOWED_BLOB_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/gif'];

// Função para abrir o IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'filename' });
      }
    };
  });
}

// Validate blob security
function validateBlob(blob) {
  if (!blob || blob.size === 0) return false;
  if (blob.size > 50 * 1024 * 1024) return false; // 50MB limit
  if (!ALLOWED_BLOB_TYPES.includes(blob.type)) return false;
  return true;
}

// Validate request origin and path
function validateRequest(request, pathname) {
  // Check if request is from same origin
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  // Validate pathname format
  const filename = pathname.replace(IMAGE_PATH_PREFIX, '');
  if (!filename || filename.includes('..') || filename.includes('/') || filename.length > 255) {
    return false;
  }

  // Check for dangerous characters
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
  if (dangerousChars.test(filename)) {
    return false;
  }

  return true;
}

// Função para buscar uma imagem no IndexedDB com validação de segurança
async function getImageFromDB(filename) {
  // Sanitize filename
  const sanitizedFilename = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 255);
  if (!sanitizedFilename || sanitizedFilename !== filename) {
    return null;
  }

  // Verifica o cache primeiro
  if (blobCache.has(sanitizedFilename)) {
    const blob = blobCache.get(sanitizedFilename);
    return validateBlob(blob) ? blob : null;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(sanitizedFilename);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob && validateBlob(result.blob)) {
          // Adiciona ao cache
          blobCache.set(sanitizedFilename, result.blob);
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Erro ao buscar imagem no IndexedDB:', error);
    return null;
  }
}

// Interceptar requisições com validações de segurança
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Verifica se é uma requisição para uma imagem gerada
  if (url.pathname.startsWith(IMAGE_PATH_PREFIX)) {
    // Validate request security
    if (!validateRequest(event.request, url.pathname)) {
      event.respondWith(new Response('Bad Request', {
        status: 400,
        statusText: 'Bad Request'
      }));
      return;
    }

    const filename = url.pathname.replace(IMAGE_PATH_PREFIX, '');
    
    event.respondWith(
      getImageFromDB(filename).then(blob => {
        if (blob) {
          // Retorna a imagem como resposta com headers de segurança
          return new Response(blob, {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': blob.type || 'image/webp',
              'Content-Length': blob.size,
              'Cache-Control': 'public, max-age=31536000', // Cache por 1 ano
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY'
            }
          });
        } else {
          // Imagem não encontrada
          return new Response('Imagem não encontrada', {
            status: 404,
            statusText: 'Not Found'
          });
        }
      }).catch(error => {
        console.error('Erro no Service Worker:', error);
        return new Response('Erro interno', {
          status: 500,
          statusText: 'Internal Server Error'
        });
      })
    );
  }
});

// Instalar o Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  self.skipWaiting(); // Força a ativação imediata
});

// Ativar o Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado');
  event.waitUntil(self.clients.claim()); // Toma controle de todas as páginas
});