// Service Worker para interceptar requisições de imagens geradas
const DB_NAME = 'ImageConverterDB';
const DB_VERSION = 1;
const STORE_NAME = 'generatedImages';
const IMAGE_PATH_PREFIX = '/imagens-geradas/';

// Cache dos blobs para melhor performance
const blobCache = new Map();

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

// Função para buscar uma imagem no IndexedDB
async function getImageFromDB(filename) {
  // Verifica o cache primeiro
  if (blobCache.has(filename)) {
    return blobCache.get(filename);
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(filename);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          // Adiciona ao cache
          blobCache.set(filename, result.blob);
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

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Verifica se é uma requisição para uma imagem gerada
  if (url.pathname.startsWith(IMAGE_PATH_PREFIX)) {
    const filename = url.pathname.replace(IMAGE_PATH_PREFIX, '');
    
    event.respondWith(
      getImageFromDB(filename).then(blob => {
        if (blob) {
          // Retorna a imagem como resposta
          return new Response(blob, {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': 'image/webp',
              'Content-Length': blob.size,
              'Cache-Control': 'public, max-age=31536000', // Cache por 1 ano
              'Access-Control-Allow-Origin': '*'
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