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
    './assets/favicon.svg',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/fonts/bootstrap-icons.woff2?24e473f62243f721c0e3532402120e79',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/fonts/bootstrap-icons.woff?24e473f62243f721c0e3532402120e79',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Para requisições do Firebase Auth/Firestore, não interceptamos para deixar o SDK cuidar da persistência
    if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('identitytoolkit.googleapis.com')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request).then(fetchRes => {
                // Opcionalmente: Cachear dinamicamente novos assets (como fontes do gstatic)
                if (e.request.url.includes('fonts.gstatic.com')) {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(e.request.url, fetchRes.clone());
                        return fetchRes;
                    });
                }
                return fetchRes;
            });
        })
    );
});