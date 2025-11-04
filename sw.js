// VERSIÓN CORREGIDA DE sw.js

const CACHE_NAME = 'inventario-pro-cache-v2'; // v2 para forzar la actualización

// Lista de archivos que componen el "Application Shell"
// Ahora incluye TODOS los módulos JS y usa rutas relativas
const APP_SHELL_URLS = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'logo.png',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  
  // Todos los 16 módulos JS
  'main.js',
  'constants.js',
  'db.js',
  'elements.js',
  'file-handlers.js',
  'logger.js',
  'reports.js',
  'state.js',
  'ui-inventory.js',
  'ui-layout-editor.js',
  'ui-modals-core.js',
  'ui-modals-media.js',
  'ui-modals-view.js',
  'ui-navigation.js',
  'ui-render.js',
  'utils.js'
];

// Lista de librerías CDN (sin cambios)
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js'
];

// --- Evento de Instalación ---
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker v2...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Guardando en caché el App Shell...');
      await cache.addAll(APP_SHELL_URLS).catch(err => {
          console.error('[SW] Error al cachear App Shell:', err);
          // Si falla un solo archivo, la instalación se detendrá.
          // Es importante que todos los archivos en APP_SHELL_URLS existan.
      });

      console.log('[SW] Guardando en caché CDNs...');
      // Cachear CDNs de forma no bloqueante
      Promise.all(
        CDN_URLS.map(url => 
          fetch(url, { mode: 'no-cors' })
            .then(response => cache.put(url, response))
            .catch(err => console.warn(`[SW] No se pudo cachear CDN: ${url}`, err))
        )
      );
    })
  );
});

// --- Evento de Activación ---
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Limpiando caché antiguo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- Evento de Fetch ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Estrategia: Cache First (para nuestro App Shell)
  // Usamos 'some()' para verificar si la URL *termina* con una de nuestras rutas relativas
  const isAppShellUrl = APP_SHELL_URLS.some(appUrl => 
      url.pathname.endsWith(appUrl.replace('./', ''))
  );

  if (isAppShellUrl) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
    return;
  }

  // Estrategia: Network First, falling back to Cache (para CDNs y otros)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la red funciona, la guardamos en caché
        return caches.open(CACHE_NAME).then((cache) => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // Si la red falla (offline), buscamos en el caché
        return caches.match(event.request);
      })
  );
});