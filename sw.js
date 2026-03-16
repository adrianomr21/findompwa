const CACHE_NAME = 'fin-v2';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/auth-service.js',
    './js/cart-service.js',
    './js/firebase-config.js',
    './js/import-service.js',
    './js/settings-service.js',
    './js/utils.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});