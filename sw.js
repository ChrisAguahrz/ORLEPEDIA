const CACHE_NAME = 'orlepedia-v1';

// Files to cache immediately on install
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

// Fetch: Serve from cache first, then network
self.addEventListener('fetch', (event) => {
    // Skip Supabase API calls - let them go to network
    if (event.request.url.includes('supabase.co')) {
        return; // Don't cache API data
    }
    
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached version if available
            if (cachedResponse) {
                return cachedResponse;
            }
            // Otherwise fetch from network
            return fetch(event.request);
        })
    );
});
