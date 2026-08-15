// Service worker mínimo: solo cachea los archivos estáticos de la app
// (CSS/JS/manifest/iconos) para que la app instalada cargue rápido y cumpla
// el requisito de Chrome para poder "instalarse" desde el navegador. Los
// documentos HTML (index.html decide la ruta secreta en tiempo de carga) y
// cualquier llamada a Firestore van siempre a la red: aquí no se cachea nada
// que dependa de la ruta ni de datos en vivo, así que no interfiere con
// RUTA_SECRETA/rutaValida() ni sirve nunca datos desactualizados del torneo.
const CACHE = 'volea-static-v4';
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
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
