const CACHE_NAME = 'favu-app-v141-gastos-mobile-fixo';
// CORREÇÃO DE PERFORMANCE: esta lista tinha 'style.css' e 'script.js', que
// não existem em nenhum lugar do projeto (são sobras de uma versão antiga do
// site). O método cache.addAll() é "tudo ou nada": se UM único arquivo da
// lista der 404, a promise inteira é rejeitada e NENHUM arquivo é
// pré-cacheado, nem os que existem e são válidos. Isso não gerava erro visível
// (o catch abaixo só registra um aviso no console), mas na prática o
// Service Worker nunca tinha nada em cache pra usar como fallback rápido,
// o que contribuía para o app demorar a carregar, especialmente em
// conexões de internet mais lentas.
const urlsToCache = [
  './',
  './index.html',
  './cardapio.html',
  './style-cardapio.css',
  './script-cardapio.js',
  './admin.js',
  './manifest.json',
  './images/favu.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // CORREÇÃO DE PERFORMANCE: em vez de cache.addAll() (tudo ou nada),
      // cacheamos cada arquivo individualmente com Promise.allSettled. Assim,
      // se algum arquivo da lista não existir ou falhar (por exemplo, se
      // 'style-cardapio.css' não estiver publicado nesse caminho), os demais
      // arquivos válidos ainda são pré-cacheados normalmente, em vez de o
      // Service Worker ficar sem nenhum arquivo em cache.
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url).catch(err => {
          console.warn(`Falha ao pré-cachear "${url}":`, err);
        }))
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Rede primeiro, mas sem interceptar uploads/APIs Firebase.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = req.url;

  // Nunca intercepte upload, POST, PUT, PATCH, DELETE etc.
  if (req.method !== 'GET') return;

  // Nunca intercepte Firebase/Google APIs. Isso evita conflito com Auth, Firestore e Storage.
  if (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('www.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
