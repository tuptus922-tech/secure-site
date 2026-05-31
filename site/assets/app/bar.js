var params = new URLSearchParams(window.location.search);

var bar = document.querySelectorAll(".bottom_element_grid");

var top = localStorage.getItem('top');
var bottom;

if (localStorage.getItem('bottom')){
    bottom = localStorage.getItem('bottom');

    bar.forEach((element) => {
        var image = element.querySelector('.bottom_element_image');
        var text = element.querySelector('.bottom_element_text');

        var send = element.getAttribute('send');
        if (send === bottom){
            image.classList.add(bottom + "_open");
            text.classList.add("open");
        }else{
            image.classList.remove(send + "_open");
            image.classList.add(send);
            text.classList.remove("open");
        }
    })
}

function sendTo(url, top, bottom){
    if (top) {
        localStorage.setItem('top', top)
    }
    if (bottom){
        localStorage.setItem('bottom', bottom)
    }
    var query = params ? params.toString() : '';
    var target = url;
    if (!/\.html$/i.test(target)) target = target + '.html';
    location.href = target + (query ? ('?' + query) : '');
}

var options = { year: 'numeric', month: '2-digit', day: '2-digit' };
var optionsTime = { second: '2-digit', minute: '2-digit', hour: '2-digit' };

bar.forEach((element) => {
    element.addEventListener('click', () => {
        localStorage.removeItem('top');
        localStorage.removeItem('bottom');

        sendTo(element.getAttribute("send"))
    })
})

function getRandom(min, max) {
    return parseInt(Math.random() * (max - min) + min);
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function gotNewData(data){

    var seriesAndNumber = localStorage.getItem('seriesAndNumber');
    if (!seriesAndNumber){
        seriesAndNumber = "";
        var chars = "ABCDEFGHIJKLMNOPQRSTUWXYZ".split("");
        for (var i = 0; i < 4; i++){
            seriesAndNumber += chars[getRandom(0, chars.length)];
        }
        seriesAndNumber += " ";
        for (var i = 0; i < 5; i++){
            seriesAndNumber += getRandom(0, 9);
        }
        localStorage.setItem('seriesAndNumber', seriesAndNumber);
    }

    var day = data['day'];
    var month = data['month'];
    var year = data['year'];

    var birthdayDate = new Date();
    birthdayDate.setDate(day);
    birthdayDate.setMonth(month-1);
    birthdayDate.setFullYear(year);

    localStorage.setItem('birthDay', birthdayDate.toLocaleDateString("pl-PL", options));

    var givenDate = birthdayDate;
    givenDate.setFullYear(givenDate.getFullYear() + 18);
    localStorage.setItem('givenDate', givenDate.toLocaleDateString("pl-PL", options));

    var expiryDate = givenDate;
    expiryDate.setFullYear(expiryDate.getFullYear() + 5);
    localStorage.setItem('expiryDate', expiryDate.toLocaleDateString("pl-PL", options));

    var sex = data['sex'];
    
    if (parseInt(year) >= 2000){
        month = 20 + parseInt(month);
    }
    
    var later;
    
    if (sex === "m"){
        later = "0295"
    }else{
        later = "0382"
    }
    
    if (day < 10){
        day = "0" + day
    }
    
    if (month < 10){
        month = "0" + month
    }
    
    var pesel = year.toString().substring(2) + month + day + later + "7";
    localStorage.setItem('pesel', pesel);

    var dataEvent = window['dataReloadEvent'];
    if (dataEvent){
        dataEvent(data);
    }
}

// ============================================================
// Funkcje do zapisu/odczytu danych z serwera
// ============================================================

async function saveDataToServer(data, imageUrl) {
    try {
        await fetch('/api/userdata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: data, image_url: imageUrl || null })
        });
    } catch(e) {
        // Ignoruj błąd sieciowy - dane są też w IndexedDB
    }
}

async function saveImageToServer(imageUrl) {
    try {
        await fetch('/api/userdata/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: imageUrl })
        });
    } catch(e) {
        // Ignoruj błąd sieciowy
    }
}

async function loadDataFromServer() {
    try {
        const res = await fetch('/api/userdata');
        if (res.ok) {
            const result = await res.json();
            return result;
        }
    } catch(e) {
        // Ignoruj błąd sieciowy
    }
    return null;
}

// ============================================================
// Ładowanie danych
// ============================================================

loadData();
async function loadData() {
    var db = await getDb();
    var data = await getData(db, 'data');

    // Sprawdź czy są parametry URL
    var hasUrlParams = false;
    var urlData = {};
    
    if (params.has('name')) {
        hasUrlParams = true;
        urlData = {
            name: params.get('name'),
            surname: params.get('surname'),
            nationality: params.get('nationality'),
            familyName: params.get('familyName'),
            fathersName: params.get('fathersName') || '',
            mothersName: params.get('mothersName') || '',
            fathersFamilyName: params.get('fathersFamilyName'),
            mothersFamilyName: params.get('mothersFamilyName'),
            birthPlace: params.get('birthPlace'),
            countryOfBirth: params.get('countryOfBirth'),
            address1: params.get('adress1'),
            address2: params.get('adress2'),
            city: params.get('city'),
            sex: params.get('sex'),
        };
        
        var birthdayStr = params.get('birthday');
        if (birthdayStr) {
            var parts = birthdayStr.split('.');
            urlData.day = parseInt(parts[0]);
            urlData.month = parseInt(parts[1]);
            urlData.year = parseInt(parts[2]);
        }
    }

    if (hasUrlParams) {
        urlData['data'] = 'data';
        gotNewData(urlData);
        saveData(db, urlData);
        // Zapisz też na serwer
        var imageUrl = params.get('image') || null;
        saveDataToServer(urlData, imageUrl);
    } else if (data) {
        gotNewData(data);
    } else {
        // Brak danych lokalnie - spróbuj pobrać z serwera
        var serverData = await loadDataFromServer();
        if (serverData && serverData.data) {
            var d = serverData.data;
            d['data'] = 'data';
            gotNewData(d);
            saveData(db, d);
        }
    }
}

loadImage();
async function loadImage() {
    var db = await getDb();
    var image = await getData(db, 'image');

    var imageEvent = window['imageReloadEvent'];

    // Sprawdź czy jest obraz w URL
    var imageUrl = params.get('image');
    
    if (imageUrl) {
        // Nowy URL z kreatora - zapisz wszędzie
        localStorage.setItem('savedImageUrl', imageUrl);
        if (imageEvent) {
            imageEvent(imageUrl);
        }
        var imageData = {
            data: 'image',
            image: imageUrl
        };
        saveData(db, imageData);
        saveImageToServer(imageUrl);
    } else if (image && imageEvent) {
        // Jest w IndexedDB
        imageEvent(image.image);
    } else if (localStorage.getItem('savedImageUrl')) {
        // Jest w localStorage
        var savedUrl = localStorage.getItem('savedImageUrl');
        if (imageEvent) imageEvent(savedUrl);
    } else {
        // Brak lokalnie - spróbuj pobrać z serwera
        var serverData = await loadDataFromServer();
        if (serverData && serverData.image_url) {
            var url = serverData.image_url;
            localStorage.setItem('savedImageUrl', url);
            if (imageEvent) imageEvent(url);
            var imageData2 = { data: 'image', image: url };
            saveData(db, imageData2);
        }
    }
}

// ============================================================
// IndexedDB helpers
// ============================================================

function getDb(){
    return new Promise((resolve, reject) => {
        var request = window.indexedDB.open('fobywatel', 1);

        request.onerror = (event) => {
            reject(event.target.error)
        }

        var name = 'data';

        request.onupgradeneeded = (event) => {
            var db = event.target.result;

            if (!db.objectStoreNames.contains(name)){
                db.createObjectStore(name, {
                    keyPath: name
                })
            }
        }

        request.onsuccess = (event) => {
            var db = event.target.result;
            resolve(db);
        }
    })
}

function getData(db, name){
    return new Promise((resolve, reject) => {
        var store = getStore(db);

        var request = store.get(name);
    
        request.onsuccess = () => {
            var result = request.result;
            if (result){
                resolve(result);
            }else{
                resolve(null);
            }
        }

        request.onerror = (event) => {
            reject(event.target.error)
        }
    });
}

function getStore(db){
    var name = 'data';
    var transaction = db.transaction(name, 'readwrite');
    return transaction.objectStore(name);
}

function saveData(db, data){
    return new Promise((resolve, reject) => {
        var store = getStore(db);

        var request = store.put(data);

        request.onsuccess = () => {
            resolve();
        }

        request.onerror = (event) => {
            reject(event.target.error)
        }
    });
}

function deleteData(db, key){
    return new Promise((resolve, reject) => {
        var store = getStore(db);

        var request = store.delete(key);

        request.onsuccess = () => {
            resolve();
        }

        request.onerror = (event) => {
            reject(event.target.error)
        }
    });
}