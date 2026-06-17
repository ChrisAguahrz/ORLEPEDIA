const CACHE_NAME = 'orlepedia-v4';         // Changed v3 to v4
const IMAGE_CACHE_NAME = 'orlepedia-images-v3';  // Changed v2 to v3

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

    // Optimized Image Handling in sw.js
// AGGRESSIVE INSTANT IMAGE CACHE
if (isImage) {
    event.respondWith(
        caches.open(IMAGE_CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                
                // 1. If it's cached, show it INSTANTLY. Zero network delay.
                if (cachedResponse) {
                    // Secretly check the network in the background to update it for next time
                    fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            cache.put(event.request, networkResponse);
                        }
                    }).catch(() => {/* Silent fail if offline */});
                    
                    return cachedResponse;
                }
                
                // 2. If it's NOT cached, pull it from the internet and save it forever
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
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
