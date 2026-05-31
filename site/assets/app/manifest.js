let webManifest = {
    "name": "mObywatel",
    "short_name": "mObywatel",
    "theme_color": "#101317",
    "background_color": "#101317",
    "display": "standalone",
    "start_url": "./",
    "icons": [
        {
            "src": "assets/app/images/ikonka.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        },
        {
            "src": "assets/app/images/ikonka.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "assets/app/images/ikonka.png",
            "sizes": "144x144",
            "type": "image/png"
        }
    ]
};

let manifestElem = document.createElement('link');
manifestElem.setAttribute('rel', 'manifest');
manifestElem.setAttribute('href', 'data:application/manifest+json;base64,' + btoa(JSON.stringify(webManifest)));
document.head.prepend(manifestElem);