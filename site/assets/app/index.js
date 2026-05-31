function scaleAndConvertToGrayscale(imageElement, maxWidth, maxHeight) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let width = imageElement.naturalWidth || imageElement.width;
    let height = imageElement.naturalHeight || imageElement.height;
    
    if (!width || !height || width <= 0 || height <= 0) {
        throw new Error('Invalid image dimensions');
    }
    
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.drawImage(imageElement, 0, 0, width, height);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to convert canvas to blob'));
            }, 'image/jpeg', quality || 0.9);
        } catch (error) {
            reject(error);
        }
    });
}

var selector = document.querySelector(".selector_box");
selector.addEventListener('click', () => {
    selector.classList.toggle("selector_open");
});

document.querySelectorAll(".date_input").forEach(el => {
    el.addEventListener('click', () => document.querySelector(".date").classList.remove("error_shown"));
});

var sex = "m";
document.querySelectorAll(".selector_option").forEach(option => {
    option.addEventListener('click', () => {
        sex = option.id;
        document.querySelector(".selected_text").innerHTML = option.innerHTML;
        selector.classList.remove("selector_open");
    });
});

var upload = document.querySelector(".upload");
var imageInput = document.createElement("input");
imageInput.type = "file";
imageInput.accept = "image/*";

document.querySelectorAll(".input_holder").forEach(element => {
    var input = element.querySelector(".input");
    input.addEventListener('click', () => element.classList.remove("error_shown"));
});

upload.addEventListener('click', () => {
    imageInput.click();
    upload.classList.remove("error_shown");
});

imageInput.addEventListener('change', (event) => {
    upload.classList.remove("upload_loaded");
    upload.classList.add("upload_loading");
    upload.removeAttribute("selected");

    var file = imageInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onerror = function() {
        upload.classList.remove("upload_loading");
        upload.classList.add("error_shown");
        upload.querySelector(".error").textContent = "Błąd odczytu pliku.";
    };
    reader.onload = function(e) {
        var img = new Image();
        img.onerror = function() {
            upload.classList.remove("upload_loading");
            upload.classList.add("error_shown");
            upload.querySelector(".error").textContent = "Nieprawidłowy format obrazu.";
        };
        img.onload = function() {
            try {
                var canvas = scaleAndConvertToGrayscale(img, 1920, 1080);
                canvasToBlob(canvas, 0.9).then(blob => {
                    if (!blob) throw new Error('Failed to create blob from canvas');

                    // 📤 Właściwy Upload do Cloudinary
                    var formData = new FormData();
                    formData.append("file", blob);
                    formData.append("upload_preset", "foteczkiiii"); 

                    const cloudinaryEndpoint = "https://api.cloudinary.com/v1_1/dtut5qu0j/image/upload";

                    fetch(cloudinaryEndpoint, {
                        method: "POST",
                        body: formData
                    })
                    .then(res => res.ok ? res.json() : res.json().then(err => { throw err; }))
                    .then(response => {
                        var url = response.secure_url;
                        console.log("Udało się! Gotowy link:", url);
                        
                        // Zaktualizuj UI po udanym uploadzie
                        if (url) {
                            var uploadedImg = upload.querySelector(".upload_uploaded");
                            if (uploadedImg) {
                                uploadedImg.src = url;
                                uploadedImg.style.display = 'block';
                            }
                            upload.classList.remove("error_shown");
                            upload.setAttribute("selected", url); // Ustawiamy URL obrazka dla przycisku "GO"
                            upload.classList.add("upload_loaded");
                            upload.classList.remove("upload_loading");
                        } else {
                            throw new Error('Błąd odpowiedzi z Cloudinary: brak linku');
                        }
                    })
                    .catch(err => {
                        upload.classList.remove("upload_loading");
                        upload.classList.add("error_shown");
                        upload.querySelector(".error").textContent = "Nie udało się przesłać zdjęcia do Cloudinary. Spróbuj ponownie.";
                        console.error("Cloudinary error:", err);
                    });
                }).catch(err => {
                    upload.classList.remove("upload_loading");
                    upload.classList.add("error_shown");
                    upload.querySelector(".error").textContent = "Błąd przetwarzania zdjęcia na blob.";
                    console.error("Canvas to blob error:", err);
                });
            } catch (err) {
                upload.classList.remove("upload_loading");
                upload.classList.add("error_shown");
                upload.querySelector(".error").textContent = "Błąd modyfikacji zdjęcia.";
                console.error("Image processing error:", err);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

document.querySelector(".go").addEventListener('click', () => {
    var empty = [];
    var params = new URLSearchParams();

    params.set("sex", sex);

    if (!upload.hasAttribute("selected")) {
        empty.push(upload);
        upload.classList.add("error_shown");
    } else {
        var imageUrl = upload.getAttribute("selected");
        if (imageUrl && !imageUrl.startsWith('data:')) {
            params.set("image", imageUrl);
        } else {
            empty.push(upload);
            upload.classList.add("error_shown");
            upload.querySelector(".error").textContent = "Zdjęcie musi być przesłane do Cloudinary. Spróbuj ponownie.";
        }
    }

    var birthday = "";
    var dateEmpty = false;
    document.querySelectorAll(".date_input").forEach(el => {
        birthday += "." + el.value;
        if (/^\s*$/.test(el.value)) dateEmpty = true;
    });
    birthday = birthday.substring(1);

    if (dateEmpty) {
        var dateEl = document.querySelector(".date");
        dateEl.classList.add("error_shown");
        empty.push(dateEl);
    } else {
        params.set("birthday", birthday);
    }

    document.querySelectorAll(".input_holder").forEach(el => {
        var input = el.querySelector(".input");
        if (/^\s*$/.test(input.value)) {
            empty.push(el);
            el.classList.add("error_shown");
        } else {
            params.set(input.id, input.value);
        }
    });

    if (empty.length) empty[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    else forwardToLogin(params);
});

function forwardToLogin(params) {
    localStorage.setItem('hasUserData', 'true');
    location.href = "id.html?" + params.toString();
}

var guide = document.querySelector(".guide_holder");
if(guide) {
    guide.addEventListener('click', () => guide.classList.toggle("unfolded"));
}
