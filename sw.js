// Service worker mínimo: cachea los archivos estáticos de la app
// (CSS/JS/manifest/iconos) solo como fallback para uso offline y para cumplir
// el requisito de Chrome para "instalarse" como PWA. La estrategia es
// network-first: si hay red, siempre servimos la versión fresca y refrescamos
// el caché en el proceso; si no hay red, caemos al caché. Así un deploy nuevo
// llega al navegador en la siguiente carga sin depender de subir la versión
// del CACHE ni de que el SW se reinstale. Los documentos HTML y las llamadas
// a Firestore no se interceptan aquí, así que no interfiere con
// RUTA_SECRETA/rutaValida() ni sirve datos desactualizados del torneo.
const CACHE = 'volea-static-v9';
const ASSETS = [
  'styles.css',
  'js/core.js',
  'js/torneos-calculo.js',
  'js/torneos-crear.js',
  'js/torneos-editar.js',
  'js/torneos-resultados.js',
  'js/listas.js',
  'js/render-listas.js',
  'js/render-torneos-modales.js',
  'js/render-torneos-vista.js',
  'js/render.js',
  'js/main.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname.replace(/^\//, '');
  if (url.origin !== self.location.origin || !ASSETS.includes(path)) return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
