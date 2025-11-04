import elements from './elements.js';
import state from './state.js'; // Necesario para getAreaColor y saveState

/**
 * Genera un UUID v4 (Identificador Único Universal).
 * @returns {string} Un string de UUID.
 */
export function generateUUID() {
    if (crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback para entornos más antiguos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Crea una función "debounced" que retrasa la invocación de `func`
 * hasta que `delay` milisegundos hayan pasado desde la última vez que fue invocada.
 * @param {Function} func - La función a ejecutar (debounce).
 * @param {number} delay - El tiempo de espera en milisegundos.
 * @returns {Function} La nueva función "debounced".
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Muestra una notificación "toast" en la esquina de la pantalla.
 * @param {string} message - El mensaje a mostrar.
 * @param {'info' | 'success' | 'warning' | 'error'} type - El tipo de toast.
 */
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500' : (type === 'warning' ? 'bg-yellow-500' : (type === 'success' ? 'bg-green-500' : 'bg-slate-700'));
    
    toast.className = `toast-notification show rounded-lg p-4 text-white shadow-lg transition-all duration-300 transform translate-y-2 opacity-0 ${bgColor}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => { 
        toast.classList.remove('translate-y-2', 'opacity-0'); 
    }, 10);
    
    // Animar salida
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

/**
 * Muestra un "toast" con un botón de "Deshacer".
 * @param {string} message - El mensaje a mostrar.
 * @param {Function} onUndo - El callback a ejecutar si se presiona "Deshacer".
 */
export function showUndoToast(message, onUndo) {
    const toast = document.createElement('div');
    let timeoutId;

    const closeToast = () => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
        clearTimeout(timeoutId);
    };

    toast.className = 'toast-notification flex items-center justify-between show rounded-lg p-4 text-white shadow-lg transition-all duration-300 transform opacity-0 bg-slate-700';
    toast.innerHTML = `<span>${message}</span>`;

    const undoButton = document.createElement('button');
    undoButton.className = 'ml-4 font-bold underline';
    undoButton.textContent = 'Deshacer';
    undoButton.onclick = () => {
        onUndo();
        closeToast();
    };
    
    toast.appendChild(undoButton);
    elements.toastContainer.appendChild(toast);

    setTimeout(() => { toast.classList.remove('opacity-0'); }, 10);
    timeoutId = setTimeout(closeToast, 5000);
}

/**
 * Maneja la navegación por teclado (Tab, Escape, Enter) dentro de un modal.
 * @param {HTMLElement} modalElement - El elemento del modal.
 * @returns {Function} Una función "cleanup" para remover los event listeners.
 */
export function handleModalNavigation(modalElement) {
    const focusableElements = modalElement.querySelectorAll('button, [href], input, select, textarea');
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    firstElement.focus();

    const keydownHandler = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        } else if (e.key === 'Enter') {
            // Intenta hacer clic en el botón de confirmación principal
            const confirmBtn = modalElement.querySelector('#modal-confirm, #note-save-btn, #edit-adicional-save-btn, #edit-user-save-btn, #preprint-confirm-btn');
            if (confirmBtn && document.activeElement !== confirmBtn) {
                e.preventDefault();
                confirmBtn.click();
            }
        } else if (e.key === 'Escape') {
            // Intenta hacer clic en el botón de cancelar
            const cancelBtn = modalElement.querySelector('#modal-cancel, #note-cancel-btn, #photo-close-btn, #edit-adicional-cancel-btn, #edit-user-cancel-btn, #log-close-btn, #preprint-cancel-btn, #layout-close-btn');
            if (cancelBtn) cancelBtn.click();
        }
    };

    modalElement.addEventListener('keydown', keydownHandler);
    
    // Devuelve una función para limpiar el listener
    return () => modalElement.removeEventListener('keydown', keydownHandler);
}

/**
 * Muestra un modal de confirmación genérico.
 * @param {string} title - El título del modal.
 * @param {string} text - El texto de pregunta del modal.
 * @param {Function} onConfirm - Callback a ejecutar al confirmar.
 * @param {object} options - Opciones adicionales (confirmText, cancelText, onCancel).
 */
export function showConfirmationModal(title, text, onConfirm, options = {}) {
    const { confirmText = 'Confirmar', cancelText = 'Cancelar', onCancel = () => {} } = options;
    
    elements.modalCancelBtn.style.display = ''; // Asegurarse que esté visible
    elements.modalTitle.textContent = title;
    elements.modalText.textContent = text;
    elements.modalConfirmBtn.textContent = confirmText;
    elements.modalCancelBtn.textContent = cancelText;
    elements.confirmationModal.classList.add('show');
    
    const cleanup = handleModalNavigation(elements.confirmationModal);

    const confirmHandler = () => {
        onConfirm();
        closeModal();
    };

    const cancelHandler = () => {
        onCancel();
        closeModal();
    };
    
    const closeModal = () => {
        elements.confirmationModal.classList.remove('show');
        elements.modalConfirmBtn.removeEventListener('click', confirmHandler);
        elements.modalCancelBtn.removeEventListener('click', cancelHandler);
        cleanup();
    };

    elements.modalConfirmBtn.addEventListener('click', confirmHandler, { once: true });
    elements.modalCancelBtn.addEventListener('click', cancelHandler, { once: true });
}

/**
 * Resalta un término de búsqueda dentro de un texto.
 * @param {string} text - El texto original.
 * @param {string} searchTerm - El término a resaltar.
 * @returns {string} - El texto con HTML para resaltar (o el original).
 */
export function highlightText(text, searchTerm) {
    if (!searchTerm.trim() || !text) {
        return text;
    }
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return String(text).replace(regex, `<mark class="bg-yellow-300 rounded-sm px-1">$1</mark>`);
}

/**
 * Prepara la vista de impresión activando la plantilla correcta y llamando a window.print().
 * @param {string} activeTemplateId - El ID de la plantilla a imprimir (ej. 'print-resguardo').
 */
export function preparePrint(activeTemplateId) {
    // Ocultar todas las páginas de impresión
    document.querySelectorAll('.print-page').forEach(page => {
        page.classList.remove('active');
    });

    // Mostrar solo la plantilla solicitada
    const activeTemplate = document.getElementById(activeTemplateId);
    if (activeTemplate) {
        activeTemplate.classList.add('active');
        
        // Si es el layout, nos aseguramos que todas sus páginas clonadas también estén activas
        if (activeTemplateId === 'print-layout-view') {
            document.querySelectorAll('.print-page.layout-clone').forEach(clone => {
                clone.classList.add('active');
            });
        }
        
        window.print();
    } else {
        showToast('Error: No se encontró la plantilla de impresión.', 'error');
    }
}

/**
 * Obtiene (o genera) un color HSL único y consistente para un ID de área.
 * @param {string} areaId - El ID del área.
 * @returns {string} - Un color HSL (ej. 'hsl(120, 80%, 60%)').
 */
export function getAreaColor(areaId) {
    if (!state.layoutItemColors[areaId]) {
        // Generar un color HSL único y consistente basado en el ID del área
        let hash = 0;
        for (let i = 0; i < String(areaId).length; i++) {
            hash = String(areaId).charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360; // Hue (0-360)
        const s = 70 + (hash % 20); // Saturation (70-90)
        const l = 55 + (hash % 10); // Lightness (55-65)
        state.layoutItemColors[areaId] = `hsl(${h}, ${s}%, ${l}%)`;
        // saveState(); // No es crítico guardar el estado solo por esto
    }
    return state.layoutItemColors[areaId];
}

/**
 * Devuelve una clase de icono de FontAwesome basada en el nombre de la ubicación.
 * @param {string} locationBase - El nombre base de la ubicación (ej. "OFICINA").
 * @returns {string} - La clase de FontAwesome.
 */
export function getLocationIcon(locationBase) {
    if (!locationBase) return 'fa-solid fa-location-dot';
    const base = String(locationBase).toUpperCase();
    if (base.includes('OFICINA')) return 'fa-solid fa-building';
    if (base.includes('CUBICULO') || base.includes('CUBÍCULO')) return 'fa-solid fa-user';
    if (base.includes('BODEGA')) return 'fa-solid fa-box-archive';
    if (base.includes('PASILLO')) return 'fa-solid fa-road';
    if (base.includes('SALA DE JUNTAS')) return 'fa-solid fa-users';
    if (base.includes('SECRETARIAL')) return 'fa-solid fa-keyboard';
    if (base.includes('FOTOCOPIADO')) return 'fa-solid fa-print';
    return 'fa-solid fa-location-dot'; // Icono por defecto
}

/**
 * Convierte un Blob de imagen a una cadena Base64.
 * @param {Blob} blob - El blob de la imagen.
 * @returns {Promise<string>} - Una promesa que resuelve a la cadena Data URL (Base64).
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Listener de movimiento para interact.js (usado por la sidebar del croquis).
 * @param {Event} event - El evento de drag de interact.js.
 */
export function dragMoveListener(event) {
    var target = event.target;
    var x = (parseFloat(target.dataset.x) || 0) + event.dx;
    var y = (parseFloat(target.dataset.y) || 0) + event.dy;
    var rotation = (parseFloat(target.dataset.rotation) || 0);
    
    target.style.transform = 'translate(' + x + 'px, ' + y + 'px) rotate(' + rotation + 'deg)';
    target.dataset.x = x;
    target.dataset.y = y;
}