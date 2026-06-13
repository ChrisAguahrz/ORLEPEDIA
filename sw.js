const CACHE_NAME = 'orlepedia-v2'; // Incrementing version for new image caching logic
const IMAGE_CACHE_NAME = 'orlepedia-images-v1';

// Files to cache immediately on install (App Shell)
const PRECACHE_URLS = [
    '/',
    '/index.html',
    'https://unpkg.com/lucide@latest'
];

// Install: Cache the app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        })
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch: Strategy based on resource type
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Skip Supabase API calls - let them go to network
    if (url.hostname.includes('supabase.co') && !event.request.url.includes('/storage/v1/object/public/')) {
        return; 
    }

    // 2. Image Caching Strategy (Cache-First, then Network + Update Cache)
    if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse; // Return from cache immediately
                    }
                    
                    // Not in cache, fetch from network
                    return fetch(event.request).then((networkResponse) => {
                        // Cache the new image for next time
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 3. Default App Shell Strategy (Cache-First)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});
