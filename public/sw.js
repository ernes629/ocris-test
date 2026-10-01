const CACHE_NAME = "ocris-cache-v1";

// Archivos básicos que siempre deben funcionar sin internet
const urlsToCache = [
    "/",
    "/index.html",
    "/mantenimiento.html",
    "/estructuras.html",
    "/mapa.html",
    "/confiabilidad.html",
    "/librerias/chart.js",
    "/librerias/xlsx.full.min.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener("fetch", event => {
    // Si la petición es para buscar la lista de equipos (/api/estructuras), la guardamos en caché
    if (event.request.url.includes("/api/estructuras")) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                    return response;
                })
                .catch(() => caches.match(event.request)) // Si no hay internet, saca los equipos de la caché
        );
    } else {
        // Para lo demás, intenta buscar en internet, si falla, busca en caché
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});