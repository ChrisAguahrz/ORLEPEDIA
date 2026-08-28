const CACHE_NAME = 'orlePedia-v6';
const IMAGE_CACHE_NAME = 'orlePedia-images-v3';


const PRECACHE_URLS = [
    '/',
    '/index.html',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing and precaching app shell...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .catch((err) => console.warn('[SW] Precache partially failed:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating and cleaning old caches...');
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) return caches.delete(key);
                return undefined;
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Always use the network for Supabase API data, excluding public storage images.
    if (url.hostname.includes('supabase.co') && !url.pathname.includes('/storage/v1/object/public/')) {
        return;
    }

    const isImage = event.request.destination === 'image' ||
        url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ||
        event.request.url.includes('supabase.co/storage/v1/object/public/');

    if (isImage) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        fetch(event.request).then((networkResponse) => {
                            if (networkResponse && networkResponse.ok) {
                                cache.put(event.request, networkResponse);
                            }
                        }).catch(() => {});
                        return cachedResponse;
                    }

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

    const isHtmlNavigation = event.request.mode === 'navigate' ||
        (event.request.headers.get('accept') || '').includes('text/html');
    const isMainPage = url.pathname === '/' || url.pathname.endsWith('/index.html');

    if (isHtmlNavigation && isMainPage) {
        // The main page is always available immediately; update it quietly for the next visit.
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => cache.match('/index.html').then((cachedResponse) => {
                const update = fetch(event.request, { cache: 'no-store' }).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        cache.put('/index.html', networkResponse.clone());
                        cache.put('/', networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => null);
                return cachedResponse || update.then((response) => response || caches.match('/index.html'));
            }))
        );
        return;
    }

    if (isHtmlNavigation) {
        // Other article URLs remain network-first, with the main page as an offline fallback.
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request).then((cachedResponse) => {
                    return cachedResponse || caches.match('/index.html');
                }))
        );
        return;
    }

    // Keep cache-first behavior for non-navigation app-shell assets.
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

