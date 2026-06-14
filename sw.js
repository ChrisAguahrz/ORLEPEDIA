const CACHE_NAME = 'orlepedia-v3';
const IMAGE_CACHE_NAME = 'orlepedia-images-v2';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing and precaching app shell...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating and cleaning old caches...');
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) return caches.delete(key);
            })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Always network for Supabase API data (NOT images)
    if (url.hostname.includes('supabase.co') && !event.request.url.includes('/storage/v1/object/public/')) {
        return;
    }

    // 2. Aggressive Image Cache (Cache-First)
    const isImage = event.request.destination === 'image' || 
                    url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ||
                    event.request.url.includes('supabase.co/storage/v1/object/public/');

    if (isImage) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        // console.log('[SW] Serving Image from Cache:', url.pathname);
                        return cachedResponse;
                    }
                    
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            console.log('[SW] Caching New Image:', url.pathname);
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // If offline and not in cache, you could return a placeholder here
                    });
                });
            })
        );
        return;
    }

    // 3. App Shell (Cache-First)
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
