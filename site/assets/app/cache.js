var params = new URLSearchParams(window.location.search);

window.onload = async () => {
    let filesResponse = { files: [] };
    try {
        const filesRequest = await fetch('cache/files');
        if (filesRequest.ok) filesResponse = await filesRequest.json();
    } catch (e) {
        // Brak endpointu lokalnie — kontynuuj z domyślną listą
    }

    const files = ['https://unpkg.com/html5-qrcode'];
    const pages = ['card', 'document', 'documents', 'home', 'id', 'more', 'pesel', 'qr', 'scan', 'services', 'shortcuts', 'show'];

    pages.forEach((page) => {
        files.push(page + '.html?' + params);
    });

    filesResponse.files.forEach((file) => {
        files.push(file);
    });

    const cacheName = 'fobywatel';
    const cache = await caches.open(cacheName);
    try {
        await cache.addAll(files);
    } catch (e) {
        // addAll może zawieść lokalnie — ignoruj
    }

    const cachedRequests = await cache.keys();

    cachedRequests.forEach((request) => {
        checkElement(request, cache);
    });

    try {
        // Zarejestruj service workera tylko jeśli istnieje (serwer HTTP)
        const head = await fetch('worker.js', { method: 'HEAD' });
        if (head.ok && navigator.serviceWorker) {
            navigator.serviceWorker.register('worker.js');
        }
    } catch (e) {
        // Brak worker.js lub fetch nieudany — pomiń rejestrację
    }
};

async function checkElement(request, cache) {
    const cachedResponse = await cache.match(request);
    const url = new URL(request.url);
    const modifiedUrl = new URL(url);

    modifiedUrl.searchParams.append('date', new Date());

    const networkResponse = await fetch(modifiedUrl);

    const cachedText = await cachedResponse.clone().text();
    const networkText = await networkResponse.clone().text();

    if (cachedText !== networkText){
        cache.put(url, networkResponse);
    }
}
