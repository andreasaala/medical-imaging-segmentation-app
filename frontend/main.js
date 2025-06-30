
// EXPANDIR/COLAPSAR SUBMENÚS
function toggleMenu(id) {
    const submenu = document.getElementById(id);
    submenu.style.display = (submenu.style.display === "block") ? "none" : "block";
}

let imagenCargada; 

// VISUALIZAR LA IMAGEN EN LA INTERFAZ (aceptando dicom, png, jpg, jpeg y tiff)
async function cargarImagen() {
    if (typeof cornerstoneWADOImageLoader === 'undefined') {
        alert('Error: cornerstoneWADOImageLoader no está disponible.');
        return;
    }

    cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
    cornerstoneWADOImageLoader.external.cornerstone = cornerstone;

    const contenedorImagen = document.getElementById('contenedorImagen');
    const img = document.getElementById('imagenPrincipal');

    const inputFile = document.createElement('input');
    inputFile.type = 'file';
    inputFile.accept = 'image/*,.dcm,.dicom,.tif,.tiff';

    inputFile.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        resetTotal(); //Hacer reset antes de cargar una nueva imagen

        const extension = file.name.split('.').pop().toLowerCase();

        if (['png', 'jpg', 'jpeg'].includes(extension)) {
            // Mostrar imágenes comunes (PNG, JPG, JPEG)
            cornerstone.disable(contenedorImagen);
            img.style.display = 'block';
            img.src = URL.createObjectURL(file);
            imagenCargada = file;
            isDicom = false;

            img.onload = () => ajustarCanvas();

        } else if (['tif', 'tiff'].includes(extension)) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const buffer = e.target.result;
                const ifds = UTIF.decode(buffer);     
                UTIF.decodeImages(buffer, ifds);      
                const rgba = UTIF.toRGBA8(ifds[0]);   
        
                // Crear canvas temporal
                const canvasTIFF = document.createElement('canvas');
                canvasTIFF.width = ifds[0].width;
                canvasTIFF.height = ifds[0].height;
        
                const ctx = canvasTIFF.getContext('2d');
                const imgData = ctx.createImageData(canvasTIFF.width, canvasTIFF.height);
                imgData.data.set(rgba);
                ctx.putImageData(imgData, 0, 0);
        
                cornerstone.disable(contenedorImagen);
                img.style.display = 'block';
                img.src = canvasTIFF.toDataURL();
        
                imagenCargada = file;
                isDicom = false;
        
                ajustarCanvas();
            };
            reader.readAsArrayBuffer(file);

        } else if (['dcm', 'dicom'].includes(extension)) {
            cornerstone.enable(contenedorImagen);
            // Mostrar imagen DICOM
            img.style.display = 'none';

            try {
                const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
                const image = await cornerstone.loadImage(imageId);
                cornerstone.displayImage(contenedorImagen, image);

                imagenCargada = file;
                isDicom = true;
                
                ajustarCanvas();
            } catch (error) {
                alert('Error al cargar el archivo DICOM.');
                console.error(error);
            }

        } else {
            alert('Formato no compatible.');
        }
    };

    inputFile.click();
}


// PARA AJUSTAR TAMAÑO CANVAS A LA IMAGEN
function ajustarCanvas() {
    const canvas = document.getElementById('canvasMascara');
    const contenedorImagen = document.getElementById('contenedorImagen');
    
    if (!img || !canvas || !contenedorImagen) return;

    if (isDicom) {
        // Buscar el canvas interno de Cornerstone (el primero que encuentra dentro del contenedor)
        const csCanvas = contenedorImagen.querySelector('canvas.cornerstone-canvas');
        if (!csCanvas) return;

        // Copiamos tamaño visual y real del canvas de Cornerstone
        canvas.style.position = 'absolute';
        canvas.style.top = csCanvas.style.top || '0px';
        canvas.style.left = csCanvas.style.left || '0px';
        canvas.style.width = csCanvas.style.width;
        canvas.style.height = csCanvas.style.height;

        canvas.width = csCanvas.width;
        canvas.height = csCanvas.height;
    } else {
        // Obtener las dimensiones y posición relativas de la imagen dentro del contenedor
        const rect = img.getBoundingClientRect(); // Nos da las coordenadas relativas a la ventana
        const contenedorRect = contenedorImagen.getBoundingClientRect(); // Coordenadas del contenedor
        // Establecer el tamaño del canvas igual al de la imagen
        canvas.width = rect.width;
        canvas.height = rect.height;
        // Colocar el canvas sobre la imagen, tomando en cuenta la posición dentro del contenedor
        canvas.style.position = 'absolute';
        canvas.style.top = rect.top - contenedorRect.top + 'px';
        canvas.style.left = rect.left - contenedorRect.left + 'px';
    }

    //Dibuja la mascara si se ha cargado una en la interfaz
    if (mascaraOriginal!=null){
        dibujarMascara();
    }
}


// AGRUPA LOS BOTONES 
document.addEventListener("DOMContentLoaded", () => {
    const botonDesplazar = document.getElementById("botonDesplazar");
    const botonActivarMedsam = document.getElementById("botonActivarMedsam");
    const botonActivarRG = document.getElementById("botonActivarRG");

    botonDesplazar.addEventListener("click", () => {
        if (!imagenCargada) {
            alert("Primero tienes que cargar una imagen");
            return;
        }
        controlarBotones(isZoomEnabled ? null : 'desplazar');
    });

    botonActivarMedsam.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!imagenCargada) {
            alert("Primero tienes que cargar una imagen");
            return;
        }
        controlarBotones(isBoxEnabled ? null : 'box');
    });

    botonActivarRG.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!imagenCargada) {
            alert("Primero tienes que cargar una imagen");
            return;
        }
        controlarBotones(isRGEnabled ? null : 'rg');
    });

    botonPintar.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!imagenCargada) {
            alert("Primero tienes que cargar una imagen");
            return;
        }
        controlarBotones(isPintarEnabled ? null : 'pintar');
    });
    
    botonBorrar.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!imagenCargada) {
            alert("Primero tienes que cargar una imagen");
            return;
        }
        controlarBotones(isBorrarEnabled ? null : 'borrar');
    });

    // Botones del diálogo de guardado
    const botonGuardarSEG = document.getElementById("botonGuardarSeg");
    const botonGuardarPNG = document.getElementById("botonGuardarPng");

    botonGuardarSEG.addEventListener("click", async () => {
        cerrarDialogo();
        await guardarDICOMSEG();
    });

    botonGuardarPNG.addEventListener("click", async () => {
        cerrarDialogo();
        await guardarMascaraPNG();
    });
});

//hacer que solo quede activo el último botón pulsado
function controlarBotones(tool) {
    const botonDesplazar = document.getElementById("botonDesplazar");
    const botonActivarMedsam = document.getElementById("botonActivarMedsam");
    const botonActivarRG = document.getElementById("botonActivarRG");
    const botonPintar = document.getElementById("botonPintar");
    const botonBorrar = document.getElementById("botonBorrar");

    isZoomEnabled = false;
    isBoxEnabled = false;
    isRGEnabled = false;
    isPintarEnabled = false;
    isBorrarEnabled = false;

    [botonDesplazar, botonActivarMedsam, botonActivarRG, botonPintar, botonBorrar].forEach(b => {
        b.classList.remove("botonActivado");
    });

    contenedor.removeEventListener("mousedown", iniciarDibujo);
    contenedor.removeEventListener("mousemove", dibujarCaja);
    contenedor.removeEventListener("mouseup", finalizarDibujo);
    contenedor.removeEventListener("click", seleccionarPuntoRG);
    contenedor.removeEventListener("mousedown", comenzarEdicionMascara);
    contenedor.removeEventListener("mousemove", editarMascara);
    contenedor.removeEventListener("mouseup", finalizarEdicionMascara);

    switch (tool) {
        case 'desplazar':
            isZoomEnabled = true;
            botonDesplazar.classList.add("botonActivado");
            break;

        case 'box':
            isBoxEnabled = true;
            botonActivarMedsam.classList.add("botonActivado");
            contenedor.addEventListener("mousedown", iniciarDibujo);
            contenedor.addEventListener("mousemove", dibujarCaja);
            contenedor.addEventListener("mouseup", finalizarDibujo);
            break;

        case 'rg':
            isRGEnabled = true;
            botonActivarRG.classList.add("botonActivado");
            contenedor.addEventListener("click", seleccionarPuntoRG);
            break;

        case 'pintar':
            isPintarEnabled = true;
            botonPintar.classList.add("botonActivado");
            break;

        case 'borrar':
            isBorrarEnabled = true;
            botonBorrar.classList.add("botonActivado");
            break;
    }

    if (tool === 'pintar' || tool === 'borrar') {
        contenedor.addEventListener("mousedown", comenzarEdicionMascara);
        contenedor.addEventListener("touchstart", comenzarEdicionMascara, { passive: false });
    }

    // Actualiza textos (pintar y borrar no tendran texto)
    botonDesplazar.textContent = isZoomEnabled ? "Desactivar Desplazamiento" : "Activar Desplazamiento";
    botonActivarMedsam.textContent = isBoxEnabled ? "Desactivar MedSAM" : "Activar MedSAM";
    botonActivarRG.textContent = isRGEnabled ? "Desactivar RG" : "Activar RG";
    // botonPintar.textContent = isPintarEnabled ? "Desactivar pintar" : "Activar pintar";
    // botonBorrar.textContent = isBorrarEnabled ? "Desactivar borrar" : "Activar borrar";
}


// FUNCIONALIDAD DE DESPLAZAMIENTO DE IMAGEN
const img = document.getElementById("imagenPrincipal");
const contenedor = document.getElementById("contenedorImagen");

//Inicializar valores
let zoomLevel = 1;
let isZoomEnabled = false;
let isDragging = false;
let startX = 0;
let startY = 0;
let translateX = 0;
let translateY = 0;
let isDicom = false;

// Zoom con la rueda del mouse y trackpad
contenedor.addEventListener("wheel", (e) => {
    if (!isZoomEnabled) return;

    e.preventDefault();
    zoomLevel += e.deltaY * -0.01;
    zoomLevel = Math.min(Math.max(1, zoomLevel), 3);

    if (isDicom) {
        const viewport = cornerstone.getViewport(contenedor);
        viewport.scale = zoomLevel;
        cornerstone.setViewport(contenedor, viewport);
        dibujarMascara(); 
    } else {
        updateTransform();
    }
});

// Zoom táctil (pinch)
let initialDistance = 0;

contenedor.addEventListener("touchstart", (e) => {
    if (!isZoomEnabled) return;

    if (e.touches.length === 2) {
        initialDistance = getTouchDistance(e);
    } else if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }
});

contenedor.addEventListener("touchmove", (e) => {
    if (!isZoomEnabled) return;

    if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e);
        const scale = currentDistance / initialDistance;
        zoomLevel = Math.min(Math.max(1, zoomLevel * scale), 3);

        if (isDicom) {
            const viewport = cornerstone.getViewport(contenedor);
            viewport.scale = zoomLevel;
            cornerstone.setViewport(contenedor, viewport);
            dibujarMascara(); 
        } else {
            updateTransform();
        }

        initialDistance = currentDistance;
    } else if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        if (isDicom) {
            const viewport = cornerstone.getViewport(contenedor);
            viewport.translation.x += deltaX;
            viewport.translation.y += deltaY;
            cornerstone.setViewport(contenedor, viewport);
            dibujarMascara(); 
        } else {
            translateX += deltaX;
            translateY += deltaY;
            updateTransform();
        }

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }
});

contenedor.addEventListener("touchend", () => {
    isDragging = false;
});

// Desplazamiento con el mouse
contenedor.addEventListener("mousedown", (e) => {
    if (!isZoomEnabled) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
});

function onMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (isDicom) {
        const viewport = cornerstone.getViewport(contenedor);
        viewport.translation.x += deltaX;
        viewport.translation.y += deltaY;
        cornerstone.setViewport(contenedor, viewport);
        dibujarMascara(); 
    } else {
        translateX += deltaX;
        translateY += deltaY;
        updateTransform();
    }

    startX = e.clientX;
    startY = e.clientY;
}

function onMouseUp() {
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
}

// Funciones auxiliares de desplazamiento
function getTouchDistance(e) {
    const [touch1, touch2] = e.touches;
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateTransform() {
    img.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
    ajustarCanvas();
}

//  HACER RESET TOTAL DE UNA IMAGEN CARGADA
function resetTotal() {
    // Reset del zoom y desplazamiento
    zoomLevel = 1;
    translateX = 0;
    translateY = 0;

    if (isDicom) {
        const viewport = cornerstone.getViewport(contenedor);
        viewport.scale = 1;
        viewport.translation.x = 0;
        viewport.translation.y = 0;
        cornerstone.setViewport(contenedor, viewport);
    } else {
        updateTransform();
    }

    //Limpiar canvas de la máscara
    const canvas = document.getElementById('canvasMascara');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    //Eliminar datos de máscara en memoria
    mascaraOriginal = null;
    nombreArchivoMascara = null;

    //Restablecer botones si están activados
    const botonDesplazar = document.getElementById("botonDesplazar");
    const botonActivarMedsam = document.getElementById("botonActivarMedsam");
    const botonActivarRG = document.getElementById("botonActivarRG");

    if (botonDesplazar?.classList.contains("botonActivado")) {
        botonDesplazar.classList.remove("botonActivado");
        botonDesplazar.textContent = "Activar Desplazamiento";
        isZoomEnabled = false;
    }

    if (botonActivarMedsam?.classList.contains("botonActivado")) {
        botonActivarMedsam.classList.remove("botonActivado");
        botonActivarMedsam.textContent = "Activar Box";
        isBoxEnabled = false;
    }

    if (botonActivarRG?.classList.contains("botonActivado")) {
        botonActivarRG.classList.remove("botonActivado");
        botonActivarRG.textContent = "Activar RG";
        isRGEnabled = false;
    }

    //Eliminar valores de la caja si hay
    CoordenadasCaja = null; 

    //Inicializar IoU y GroundTruth
    document.getElementById("iou").textContent = "";
    groundTruthCargada = null;

    console.log("Reset total realizado");
}



// DIBUJAR CAJAS SOBRE LAS IMÁGENES
let isDrawing = false;
let startBoxX = 0;
let startBoxY = 0;
let cajaActual = null; //Dibuja la caja en la posición correcta en la interfaz
let isBoxEnabled = false;
let CoordenadasCaja = null;  //Coordenadas reales de la caja respecto con la imagen real
let isRGEnabled = false;
let CoordenadasSemilla = null;


function ajustarCoordenadas(e) {
    const contenedorImagen = document.querySelector('.contenedorImagen');
    const contenedorRect = contenedorImagen.getBoundingClientRect();
    const offsetX = e.clientX - contenedorRect.left;
    const offsetY = e.clientY - contenedorRect.top;
    return { offsetX, offsetY };
}

function iniciarDibujo(e) {
    if (isZoomEnabled || !isBoxEnabled) return;  // Solo dibuja si el zoom está desactivado y box activado
    e.preventDefault();
    isDrawing = true;

    // Coordenadas ajustadas considerando el desplazamiento y zoom
    const { offsetX, offsetY } = ajustarCoordenadas(e);
    startBoxX = offsetX;
    startBoxY = offsetY;

    cajaActual = document.createElement('div');
    cajaActual.className = 'caja';
    cajaActual.style.left = `${startBoxX}px`;
    cajaActual.style.top = `${startBoxY}px`;
    cajaActual.addEventListener('dragstart', (e) => e.preventDefault());
    contenedor.appendChild(cajaActual);
}

function dibujarCaja(e) {
    if (!isDrawing || !isBoxEnabled) return;
    e.preventDefault();

    const { offsetX, offsetY } = ajustarCoordenadas(e);
    const width = offsetX - startBoxX;
    const height = offsetY - startBoxY;

    cajaActual.style.width = `${Math.abs(width)}px`;
    cajaActual.style.height = `${Math.abs(height)}px`;

    // Ajustar la posición si el usuario arrastra hacia arriba o la izquierda
    cajaActual.style.left = `${width < 0 ? startBoxX + width : startBoxX}px`;
    cajaActual.style.top = `${height < 0 ? startBoxY + height : startBoxY}px`;
}


// ENVIAR LA INFO DE LA CAJA Y LA IMAGEN PARA SEGMENTARLA EN EL BACKEND
function finalizarDibujo(e) {
    e.preventDefault();
    if (isDrawing) {
        isDrawing = false;

        // Obtener las coordenadas de la caja dibujada
        const { left, top, width, height } = cajaActual.getBoundingClientRect();
        const imagen = document.querySelector('img');
        const contenedor = document.getElementById('contenedorImagen');

        // Posición de la imagen en el contenedor
        const { left: imgLeft, top: imgTop } = imagen.getBoundingClientRect();
        const esquinaInferiorDerechaX = left + width;
        const esquinaInferiorDerechaY = top + height;

        if (isDicom) {
            // Para DICOM usamos cornerstone para convertir coordenadas del canvas al espacio de imagen
            const esquinaSuperiorIzq = cornerstone.pageToPixel(contenedor, left - imgLeft, top - imgTop);
            const esquinaInferiorDer = cornerstone.pageToPixel(contenedor, esquinaInferiorDerechaX - imgLeft, esquinaInferiorDerechaY - imgTop);

            CoordenadasCaja = [
                Math.round(esquinaSuperiorIzq.x),
                Math.round(esquinaSuperiorIzq.y),
                Math.round(esquinaInferiorDer.x),
                Math.round(esquinaInferiorDer.y)
            ];
        } else {
            // Para imágenes normales, escalamos (tiene en cuenta si la imagen es escalada x defecto por el navegador)
            const escalaX = img.naturalWidth / img.getBoundingClientRect().width;
            const escalaY = img.naturalHeight / img.getBoundingClientRect().height;

            CoordenadasCaja = [
                Math.round((left - imgLeft) * escalaX),
                Math.round((top - imgTop) * escalaY),
                Math.round((esquinaInferiorDerechaX - imgLeft) * escalaX),
                Math.round((esquinaInferiorDerechaY - imgTop) * escalaY)
            ];

        }

        console.log("Caja detectada backend: ", CoordenadasCaja);
        enviarDatosAlServidor();
    }
}

//REGION GROWING COGIENDO SEMILLAS 
function seleccionarPuntoRG(e) {
    if (!isRGEnabled || isZoomEnabled) return;

    const imagen = document.querySelector('img');
    const contenedor = document.getElementById('contenedorImagen');

    const { left: imgLeft, top: imgTop } = imagen.getBoundingClientRect();
    const clickX = e.clientX - imgLeft;
    const clickY = e.clientY - imgTop;

    if (isDicom) {
        const coords = cornerstone.pageToPixel(contenedor, clickX, clickY);
        CoordenadasSemilla = [Math.round(coords.x), Math.round(coords.y)];
    } else {
        //Coordenadas reales con la imagen real, las q se pasan al backend
        const escalaX = img.naturalWidth / img.getBoundingClientRect().width;
        const escalaY = img.naturalHeight / img.getBoundingClientRect().height;

        CoordenadasSemilla = [
            Math.round(clickX * escalaX),
            Math.round(clickY * escalaY)
        ];

    }

    // Igual que en caja, relativo a la interfaz, para que se vea el punto en el lugar correspondiente
    const {offsetX, offsetY} = ajustarCoordenadas(e);
    dibujarSemilla(offsetX, offsetY); 

    console.log("Punto semilla backend:", CoordenadasSemilla);
    console.log("Punto semilla frontend:", offsetX, offsetY);
}

function dibujarSemilla(x, y) {
    const punto = document.createElement('div');
    punto.className = 'puntoSemilla';
    punto.style.left = `${x}px`; 
    punto.style.top = `${y}px`;

    contenedor.appendChild(punto);

    // Esperar 5 segundos antes de llamar al servidor, PARA HACER PRUEBAS Y CAPTURAS DE LOS PUNTOS
    // setTimeout(() => {
    //     enviarDatosAlServidorRG();
    // }, 5000);

    enviarDatosAlServidorRG()
}


//ENVIAR DATOS AL BACKEND
async function enviarDatosAlServidor() {
    try {
        const formData = new FormData();
        formData.append("imagen", imagenCargada);
        formData.append("box", JSON.stringify(CoordenadasCaja));
        
        console.log("Enviando solicitud al backend...");
        const response = await fetch("http://127.0.0.1:5000/segmentar_medsam", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (!data.mascara) throw new Error("No se recibió una máscara.");

        nombreArchivoMascara = data.nombreArchivo;
        console.log(nombreArchivoMascara)
        document.querySelector('.caja')?.remove(); //Elimina de la interfaz q se vea la caja
        superponerMascara(data.mascara);
    } catch (error) {
        console.error("Error en la solicitud:", error);
        alert(`Error en la solicitud: ${error}`);
    }
}

// Ver si la mezclo con la de arriba
async function enviarDatosAlServidorRG() {
    try {
        const formData = new FormData();
        formData.append("imagen", imagenCargada);
        formData.append("semilla", JSON.stringify(CoordenadasSemilla));

        // Valor por defecto de 10 si no se especifica
        const tolerancia = document.getElementById("tolerancia").value || 10;
        console.log(tolerancia)
        formData.append("tolerancia", tolerancia);

        console.log("Enviando solicitud al backend...");
        const response = await fetch("http://127.0.0.1:5000/segmentar_region_growing", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (!data.mascara) throw new Error("No se recibió una máscara.");

        nombreArchivoMascara = data.nombreArchivo;
        console.log(nombreArchivoMascara)

        document.querySelector('.puntoSemilla')?.remove();
        superponerMascara(data.mascara);
    } catch (error) {
        console.error("Error en la solicitud:", error);
        alert(`Error en la solicitud: ${error}`);
    }
}

// SUPERPONE LA MASCARA ENCIMA DE LA IMAGEN CUANDO SE CREA
// Esta función debe ser llamada con el array de numpy que representa la máscara
let mascaraOriginal =null;
let nombreArchivoMascara; 
function superponerMascara(mascara) {  
    console.log("Superponiendo máscara");
    const canvas = document.getElementById("canvasMascara");
    const imgOriginal = document.getElementById("imagenPrincipal");

    if (!canvas || !imgOriginal) { // Asegurarse de que están presentes en el documento
        console.error("Canvas o imagen original no encontrados.");
        return;
    }

    // Guardamos la máscara original (para redibujar si se reajusta el canvas)
    mascaraOriginal = mascara;

    // Ajustar el canvas al tamaño actual de la imagen en pantalla
    ajustarCanvas();
}

//DIBUJA LA MASCARA SOBRE EL CANVAS
//Dibujar mascara que se adapta mejor al cornerstone
function dibujarMascara() {
    const canvas = document.getElementById('canvasMascara');
    if (!canvas || !mascaraOriginal) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isDicom) {
        const maskHeight = mascaraOriginal.length; // ESTO SE REPITE PARA NO DICOM (optimizar luego)
        const maskWidth = mascaraOriginal[0].length;

        for (let y = 0; y < maskHeight; y++) {
            for (let x = 0; x < maskWidth; x++) {
                if (mascaraOriginal[y][x] > 0) {
                    // Convertimos la posición de la máscara al canvas de Cornerstone
                    const canvasCoords = cornerstone.pixelToCanvas(contenedor, { x, y });

                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                    ctx.fillRect(canvasCoords.x, canvasCoords.y, 1, 1); // dibuja píxel por píxel
                }
            }
        }

    } else {
        // Imágenes normales (JPG, PNG...)
        const tempCanvas = document.createElement('canvas');
        const maskHeight = mascaraOriginal.length;
        const maskWidth = mascaraOriginal[0].length;

        tempCanvas.width = maskWidth;
        tempCanvas.height = maskHeight;
        const tempCtx = tempCanvas.getContext('2d');

        const imageData = tempCtx.createImageData(maskWidth, maskHeight);
        for (let i = 0; i < maskHeight; i++) {
            for (let j = 0; j < maskWidth; j++) {
                const index = (i * maskWidth + j) * 4;
                const valor = mascaraOriginal[i][j] > 0 ? 255 : 0;
                imageData.data[index] = 255;      // R
                imageData.data[index + 1] = 0;    // G
                imageData.data[index + 2] = 0;    // B
                imageData.data[index + 3] = valor * 0.5;
            }
        }
        tempCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    }
}

//BOTÓN GUARDAR MÁSCARA (opcionalidad si es Dicom)
function guardarMascara() {
    if (!mascaraOriginal) {
        alert("No hay ninguna máscara cargada.");
        return;
    }

    if (isDicom) {
        // Abre el diálogo para elegir tipo de descarga cnd es dicom
        mostrarDialogo();
    } else{
        guardarMascaraPNG();
    } 
}

//GUARDA LA MASCARA COMO DICOM SEG
async function guardarDICOMSEG() {
    try {
        const formData = new FormData();
        formData.append("nombre_imagen", imagenCargada.name);

        const segmentLabel = prompt("Nombre del segmento (ej: Tumor derecho, fractura fémur):", "Segmento generado");
        if (!segmentLabel) {
            alert("Segmentación cancelada.");
            return;
        }
        formData.append("segment_label", segmentLabel);

        const mascaraBlob = new Blob([JSON.stringify(mascaraOriginal)], { type: "application/json" });
        formData.append("mascara_archivo", mascaraBlob, "mascara.json");

        const response = await fetch("http://127.0.0.1:5000/guardar_dicom_seg", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Error al generar el SEG en el servidor");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = imagenCargada.name.replace(/\.[^/.]+$/, "") + "_final_seg.dcm";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);
        alert("No se pudo descargar el archivo DICOM SEG.");
    }
}

//GUARDA LA MASCARA COMO PNG 
//se adapta a cada navegador, Chrome y Edge permite elegir dnd guardar archivo. Safari y Firefox no
async function guardarMascaraPNG() { //guardarMascaraPNG()
    const h = mascaraOriginal.length;
    const w = mascaraOriginal[0].length;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);

    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            const valor = mascaraOriginal[i][j] > 0 ? 255 : 0;
            const index = (i * w + j) * 4;
            imgData.data.set([valor, valor, valor, 255], index);
        }
    }

    ctx.putImageData(imgData, 0, 0);

    const nombre = nombreArchivoMascara || 'mascara_segmentada.png';

    // Convertimos el canvas a blob PNG
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    // Detectar si el navegador soporta showSaveFilePicker
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: nombre,
                types: [{
                    description: 'Imagen PNG',
                    accept: { 'image/png': ['.png'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            alert("Máscara guardada correctamente.");
            return;
        } catch (err) {
            console.warn("Guardado cancelado o error:", err);
            return;
        }
    }

    // Fallback si el navegador no soporta File System Access API
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// DIALOGO PARA GUARDAR LA MASCARA 
function mostrarDialogo() {
    const dialog = document.getElementById("dialogoGuardar");
    dialog.showModal(); // Muestra el diálogo modal accesible
}

function cerrarDialogo() {
    const dialog = document.getElementById("dialogoGuardar");
    dialog.close();
}


//FUNCIÓN EDITAR LA MASCARA
let editando = false;
let radioPincel = 5;

const radioPincelInput = document.getElementById('radioPincelInput');
const previewPincel = document.getElementById('previewPincel');

radioPincelInput.addEventListener('input', function () {
    radioPincel = parseInt(this.value);
    if (!isNaN(radioPincel)) {
        previewPincel.style.width = `${radioPincel * 2}px`; // diámetro
        previewPincel.style.height = `${radioPincel * 2}px`;
    }
});

function comenzarEdicionMascara(e) {
    if (!mascaraOriginal || (!isPintarEnabled && !isBorrarEnabled)) return;

    editando = true;

    // Activar listeners globales para arrastre continuo
    document.addEventListener("mousemove", editarMascara);
    document.addEventListener("mouseup", finalizarEdicionMascara);
    document.addEventListener("touchmove", editarMascara, { passive: false });
    document.addEventListener("touchend", finalizarEdicionMascara);

    editarMascara(e); // Dibuja en el primer clic/touch
}

function editarMascara(e) {
    if (!editando) return;    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        e.preventDefault();
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    let xReal, yReal;
    if (isDicom) {
        // Lo mismo que se hace en seleccionarPuntoRG (optimizar luego)
        const imagen = document.querySelector('img');
        const contenedor = document.getElementById('contenedorImagen');
        const { left: imgLeft, top: imgTop } = imagen.getBoundingClientRect();
        const clickX = e.clientX - imgLeft;
        const clickY = e.clientY - imgTop;
        const coords = cornerstone.pageToPixel(contenedor, clickX, clickY);
        
        xReal = Math.round(Math.round(coords.x));
        yReal = Math.round(Math.round(coords.y));
    } else {
        const imgRect = img.getBoundingClientRect();

        const escalaX = img.naturalWidth / imgRect.width;
        const escalaY = img.naturalHeight / imgRect.height;

        xReal = Math.round((clientX - imgRect.left) * escalaX);
        yReal = Math.round((clientY - imgRect.top) * escalaY);
    }

    for (let dy = -radioPincel; dy <= radioPincel; dy++) {
        for (let dx = -radioPincel; dx <= radioPincel; dx++) {
            const x = xReal + dx;
            const y = yReal + dy;
            if (x >= 0 && y >= 0 && y < mascaraOriginal.length && x < mascaraOriginal[0].length) {
                const distancia = Math.sqrt(dx * dx + dy * dy);
                if (distancia <= radioPincel) {
                    if (isPintarEnabled) {
                        console.log("Pintando en", x, y);
                        mascaraOriginal[y][x] = 1;
                    } else if (isBorrarEnabled) {
                        console.log("Borrando en", x, y);
                        mascaraOriginal[y][x] = 0;
                    }
                }
            }
        }
    }

    dibujarMascara();
}

function finalizarEdicionMascara() {
    editando = false;
    document.removeEventListener("mousemove", editarMascara);
    document.removeEventListener("mouseup", finalizarEdicionMascara);
    document.removeEventListener("touchmove", editarMascara);
    document.removeEventListener("touchend", finalizarEdicionMascara);
}


// CÁLCULO DEL IOU
let groundTruthCargada = null; // archivo tipo File (PNG, JPG, TIFF)

function cargarGroundTruth() {
    const inputFile = document.createElement("input");
    inputFile.type = "file";
    inputFile.accept = "image/*,.tif,.tiff";

    inputFile.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Guardamos el archivo en variable global
        groundTruthCargada = file;
        alert("Ground Truth cargada correctamente: " + file.name);
    };

    inputFile.click();
}


async function calcularIoU() {
    if (!imagenCargada || !mascaraOriginal || !groundTruthCargada) {
        alert("Faltan datos: asegúrate de haber cargado una imagen, segmentado, y cargado la ground truth.");
        return;
    }

    const metodo = prompt("Indique el método usado: MedSAM (M), Region Growing (R): ", "R");
    const metodoMayuscula = metodo?.toUpperCase();

    if (!["M", "R"].includes(metodoMayuscula)) {
        alert("Método no reconocido. Introduce M o R.");
        return;
    }

    const formData = new FormData();
    formData.append("imagen", imagenCargada);
    formData.append("mascara", new Blob([JSON.stringify(mascaraOriginal)], { type: "application/json" }));
    formData.append("ground_truth", groundTruthCargada);
    formData.append("metodo", metodoMayuscula);

    if (metodoMayuscula === "M" && CoordenadasCaja) {
        formData.append("box", JSON.stringify(CoordenadasCaja));
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/calcular_iou", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (data.iou !== undefined) {
            document.getElementById("iou").textContent = data.iou.toFixed(4);
        } else {
            alert("Error al calcular IoU: " + (data.error || "Respuesta inválida del servidor."));
        }
    } catch (error) {
        console.error("Error al calcular IoU:", error);
        alert("Error al calcular IoU: " + error.message);
    }
}

