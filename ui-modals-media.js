import elements from './elements.js';
import state, { saveState } from './state.js';
import { photoDB } from './db.js';
import { logActivity } from './logger.js';
import { showToast, showConfirmationModal, handleModalNavigation } from './utils.js';

// (Dependencias como 'filterAndRenderInventory' se inyectarán como callbacks si es necesario)

// Variable local del módulo para el scanner QR
let html5QrCode;

/**
 * Detiene cualquier stream de cámara (foto o QR) que esté activo.
 */
export function stopCamera() {
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
    }
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => {
            console.warn("Error al detener el scanner QR (puede ignorarse):", err);
        });
        html5QrCode = null;
    }
}

/**
 * Inicia la cámara para tomar una foto.
 */
async function startCamera() {
    if (state.readOnlyMode) return;
    const { cameraStream, uploadContainer, cameraViewContainer } = elements.photo;
    
    stopCamera(); // Detener cualquier stream anterior

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const constraints = {
                video: { 
                    facingMode: "environment" // Priorizar cámara trasera
                }
            };
            state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraStream.srcObject = state.cameraStream;
            uploadContainer.classList.add('hidden');
            cameraViewContainer.classList.remove('hidden');
        } catch (err) {
            showToast('No se pudo acceder a la cámara. Revisa los permisos.', 'error');
            console.error("Error al acceder a la cámara: ", err);
        }
    } else {
        showToast('Tu navegador no soporta el acceso a la cámara.', 'error');
    }
}

/**
 * Muestra el modal de gestión de fotos (ver, subir, capturar).
 * @param {'inventory' | 'additional' | 'location'} type - El tipo de entidad.
 * @param {string} id - El ID o Clave de la entidad.
 * @param {object} callbacks - Objeto con callbacks (ej. onPhotoUpdate).
 * @param {Function} callbacks.onPhotoUpdate - Función a llamar cuando una foto se actualiza.
 */
export function showPhotoModal(type, id, callbacks = {}) {
    const { modal, title, input, deleteBtn, viewContainer, uploadContainer, cameraViewContainer, img } = elements.photo;
    
    let modalTitle = 'Foto del Bien';
    if (type === 'location') modalTitle = `Foto de la Ubicación: ${id}`;
    if (type === 'additional') modalTitle = `Foto del Bien Adicional`;
    title.textContent = modalTitle;

    // Asignar datos a los elementos para los handlers
    input.dataset.type = type;
    input.dataset.id = id;
    deleteBtn.dataset.type = type;
    deleteBtn.dataset.id = id;
    
    let photoExists = false;
    if (type === 'inventory') photoExists = state.photos[id];
    else if (type === 'additional') photoExists = state.additionalPhotos[id];
    else if (type === 'location') photoExists = state.locationPhotos[id];
    
    // Resetear vistas del modal
    viewContainer.classList.add('hidden');
    uploadContainer.classList.add('hidden');
    cameraViewContainer.classList.add('hidden');
    stopCamera(); // Asegurarse que la cámara esté apagada

    if (photoExists) {
        // --- VISTA DE FOTO EXISTENTE ---
        viewContainer.classList.remove('hidden');
        img.src = ''; // Limpiar src anterior
        photoDB.getItem('photos', `${type}-${id}`).then(imageBlob => {
            if (imageBlob) {
                const objectURL = URL.createObjectURL(imageBlob);
                img.src = objectURL;
                img.onload = () => URL.revokeObjectURL(objectURL);
            } else {
                img.alt = 'Error al cargar la imagen desde la base de datos.';
            }
        }).catch(() => {
            img.alt = 'Error al cargar la imagen.';
        });
    } else {
        // --- VISTA DE SUBIR/CAPTURAR ---
        if (!state.readOnlyMode) {
            uploadContainer.classList.remove('hidden');
        }
    }
    
    // Inyectar callbacks en los botones del modal (se manejarán en main.js)
    if (callbacks.onPhotoUpdate) {
        // Estos elementos son parte del modal, así que los handlers
        // se deben registrar en el módulo principal (main.js)
        // Aquí solo pasamos los datos necesarios
    }
    
    modal.classList.add('show');
    handleModalNavigation(modal);
}

/**
 * Inicia el escáner de código QR.
 * @param {Function} onScanSuccess - Callback que se ejecuta con el texto decodificado.
 */
export async function startQrScanner(onScanSuccess) {
    if (state.readOnlyMode) return;
    elements.qrScannerModal.classList.add('show');
    
    stopCamera(); // Detener cualquier stream de foto

    try {
        // Asumiendo que Html5Qrcode (html5-qrcode.js) está en el scope global
        html5QrCode = new Html5Qrcode("qr-reader");

        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            stopQrScanner();
            onScanSuccess(decodedText);
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        await html5QrCode.start(
            { facingMode: "environment" }, // Solicitar cámara trasera
            config,
            qrCodeSuccessCallback
        );
    } catch (err) {
        showToast('Error al iniciar la cámara. Revisa los permisos.', 'error');
        console.error("Error al iniciar el escaner QR: ", err);
        stopQrScanner();
    }
}

/**
 * Detiene el escáner QR y cierra su modal.
 */
export function stopQrScanner() {
    stopCamera(); // La función stopCamera ahora también maneja html5QrCode
    elements.qrScannerModal.classList.remove('show');
}