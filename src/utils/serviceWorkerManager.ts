// Gerenciador do Service Worker

let isServiceWorkerRegistered = false;

// Registrar o Service Worker
export async function registerServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker não é suportado neste navegador');
    return false;
  }

  if (isServiceWorkerRegistered) {
    return true;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('Service Worker registrado com sucesso:', registration);
    
    // Aguardar o Service Worker estar ativo
    await waitForServiceWorkerActive(registration);
    
    isServiceWorkerRegistered = true;
    return true;
  } catch (error) {
    console.error('Erro ao registrar Service Worker:', error);
    return false;
  }
}

// Aguardar o Service Worker estar ativo
function waitForServiceWorkerActive(registration: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve) => {
    if (registration.active) {
      resolve();
      return;
    }

    const worker = registration.installing || registration.waiting;
    if (worker) {
      worker.addEventListener('statechange', function checkState() {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', checkState);
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

// Verificar se o Service Worker está ativo
export function isServiceWorkerActive(): boolean {
  return isServiceWorkerRegistered && 
         navigator.serviceWorker.controller !== null;
}