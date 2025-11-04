// --- 1. IMPORTACIÓN DE MÓDULOS ---

// Núcleo: Estado, Elementos, DB, Constantes
import state, { loadState, saveState, resetInventoryState, updateSerialNumberCache, checkReadOnlyMode, startAutosave } from './state.js';
import elements from './elements.js';
import { photoDB } from './db.js';
import { verifiers } from './constants.js';

// Utilidades y Logger
import { logActivity } from './logger.js';
import { debounce, showToast, showConfirmationModal, showUndoToast, generateUUID } from './utils.js';

// Navegación y Renderizado de UI
import { changeTab, showMainApp } from './ui-navigation.js';
import { 
    renderDashboard, 
    updateActiveUserBanner, 
    renderUserList,
    renderAdicionalesList,
    renderLoadedLists,
    renderDirectory,
    populateAreaSelects,
    populateAdicionalesFilters,
    populateReportFilters,
    updateTheme
} from './ui-render.js';

// Lógica de UI - Inventario
import { 
    filterAndRenderInventory, 
    handleInventoryActions, 
    changeInventoryPage, 
    clearInventorySearch
} from './ui-inventory.js';

// Lógica de UI - Modales (Core)
import {
    showNotesModal,
    showQrModal,
    showEditUserModal,
    showEditAdicionalModal,
    showFormatoEntradaModal,
    showReassignModal,
    showPreprintModal
} from './ui-modals-core.js';

// Lógica de UI - Modales (Media)
import {
    stopCamera,
    showPhotoModal,
    startQrScanner,
    stopQrScanner
} from './ui-modals-media.js';

// Lógica de UI - Modales (Vistas)
import {
    showItemDetailView,
    showUserDetailView,
    showAdicionalDetailView,
    renderReportTable,
    showLogModal
} from './ui-modals-view.js';

// Lógica de UI - Editor de Croquis
import { initializeLayoutEditor } from './ui-layout-editor.js';

// Lógica de Negocio - Reportes
import * as reports from './reports.js';

// Lógica de Negocio - Manejo de Archivos
import * as fileHandlers from './file-handlers.js';


// --- 2. FUNCIONES ORQUESTADORAS (Lógica "Glue") ---

/**
 * Revisa si un área está 100% completada y actualiza el estado.
 * @param {string} areaId - El ID del área a revisar.
 */
function checkAreaCompletion(areaId) {
    if (!areaId || state.closedAreas[areaId]) {
        return; 
    }

    const areaItems = state.inventory.filter(item => item.areaOriginal === areaId);
    const isAreaComplete = areaItems.length > 0 && areaItems.every(item => item.UBICADO === 'SI');
    const wasPreviouslyComplete = !!state.completedAreas[areaId];

    if (isAreaComplete && !wasPreviouslyComplete) {
        state.completedAreas[areaId] = true;
        logActivity('Área completada', `Todos los bienes del área ${areaId} han sido ubicados.`);
        showToast(`¡Área ${state.areaNames[areaId] || areaId} completada!`);
        saveState();
        renderLoadedLists(); // Actualizar la vista en Ajustes
    } else if (!isAreaComplete && wasPreviouslyComplete) {
        delete state.completedAreas[areaId];
        logActivity('Área ya no completada', `El área ${areaId} ahora tiene bienes pendientes.`);
        saveState();
        renderLoadedLists();
    }
}

/**
 * Revisa si todo el inventario está 100% completado.
 */
function checkInventoryCompletion() {
    if (state.inventoryFinished || state.inventory.length === 0) return;

    const allLocated = state.inventory.every(item => item.UBICADO === 'SI');
    if (allLocated) {
        state.inventoryFinished = true;
        logActivity('Inventario completado', 'Todos los bienes han sido ubicados.');
        showConfirmationModal(
            '¡Inventario Completado!',
            '¡Felicidades! Has ubicado todos los bienes. ¿Deseas generar el Resumen de Sesión?',
            () => { 
                showPreprintModal('session_summary', {}, reportCallbacks);
            }
        );
        saveState();
    }
}

/**
 * Elimina un bien adicional del estado y actualiza la UI.
 * @param {string} itemId - El ID del bien adicional.
 * @param {boolean} transferredPhoto - True si la foto fue transferida (para no borrarla).
 */
function deleteAdditionalItem(itemId, transferredPhoto = false) {
    const item = state.additionalItems.find(i => i.id === itemId);
    if (!item) return;

    state.additionalItems = state.additionalItems.filter(i => i.id !== itemId);
    
    if (!transferredPhoto) {
        photoDB.deleteItem('photos', `additional-${itemId}`);
    }
    delete state.additionalPhotos[itemId];
    
    renderAdicionalesList(); 
    renderDashboard(); 
    saveState(); 
    updateSerialNumberCache();
    logActivity('Bien adicional eliminado', `Descripción: ${item.descripcion}`);
    showToast('Bien adicional eliminado.');
}

/**
 * Elimina un listado de inventario y refresca toda la UI.
 * @param {number} listId - El ID del listado (basado en Date.now()).
 */
function deleteListAndRefresh(listId) {
    const listToDelete = state.inventory.find(i => i.listId === listId);
    if (!listToDelete) return;

    logActivity('Listado eliminado', `Archivo: ${listToDelete.fileName}, Área: ${listToDelete.areaOriginal}`);
    state.inventory = state.inventory.filter(item => item.listId !== listId);
    showToast(`Listado "${listToDelete.fileName}" eliminado.`);
    
    updateSerialNumberCache();
    saveState();
    renderDashboard();
    populateAreaSelects();
    populateReportFilters();
    filterAndRenderInventory({ showItemDetailView });
    renderLoadedLists();
}

/**
 * Lógica de login del empleado.
 */
function handleEmployeeLogin() {
    const employeeNumber = elements.employeeNumberInput.value;
    const employeeName = verifiers[employeeNumber];
    
    if (employeeName) {
        const newCurrentUser = { number: employeeNumber, name: employeeName };

        if (state.loggedIn && state.currentUser.number !== newCurrentUser.number) {
             showConfirmationModal(
                'Cambio de Usuario',
                `Actualmente hay un inventario en progreso. ¿Deseas continuar como ${employeeName} o iniciar uno nuevo?`,
                () => {
                    logActivity('Cambio de usuario', `Sesión continuada por ${employeeName}.`);
                    state.currentUser = newCurrentUser;
                    showToast(`Bienvenido de nuevo, ${employeeName}.`);
                    saveState();
                    showMainApp();
                },
                { 
                    confirmText: 'Continuar', 
                    cancelText: 'Iniciar Nuevo',
                    onCancel: async () => {
                         state.currentUser = newCurrentUser;
                         await resetInventoryState(); // Espera a que se reinicie
                         showMainApp(); // Luego muestra la app
                    }
                }
            );
        } else {
            state.loggedIn = true;
            state.currentUser = newCurrentUser;
            if (!state.sessionStartTime) {
                state.sessionStartTime = new Date().toISOString();
                logActivity('Inicio de sesión', `Usuario ${employeeName} ha iniciado sesión.`);
            } else {
                logActivity('Reanudación de sesión', `Usuario ${employeeName} ha reanudado la sesión.`);
            }
            showToast(`Bienvenido, ${employeeName}`);
            saveState();
            showMainApp();
        }

    } else {
        showToast('Número de empleado no autorizado.', 'error');
    }
    elements.employeeNumberInput.value = '';
}

/**
 * Crea un nuevo usuario resguardante.
 */
function createUser() {
    if (state.readOnlyMode) return;
    const name = elements.userForm.name.value.trim();
    const area = elements.userForm.areaSelect.value;
    const locationType = elements.userForm.locationSelect.value;
    const locationManual = elements.userForm.locationManual.value.trim();
    
    if (!name || !area || (locationType === 'OTRA' && !locationManual)) {
        return showToast('Todos los campos son obligatorios', 'error');
    }

    const createUserAction = () => {
        const locationBase = locationType === 'OTRA' ? locationManual : locationType;
        state.locations[locationBase] = (state.locations[locationBase] || 0) + 1;
        const locationId = String(state.locations[locationBase]).padStart(2, '0');
        const locationWithId = `${locationBase} ${locationId}`;

        const newUser = { name, area, location: locationBase, locationWithId, id: generateUUID() };
        state.resguardantes.push(newUser);
        state.activeResguardante = newUser;
        
        logActivity('Usuario creado', `Nombre: ${name}, Área: ${area}, Ubicación: ${locationWithId}`);

        renderUserList();
        populateAreaSelects();
        populateReportFilters();
        saveState();
        showToast(`Usuario ${name} creado y activado.`);
        updateActiveUserBanner();
        
        // Limpiar formulario
        elements.userForm.name.value = '';
        elements.userForm.locationManual.value = '';
        elements.userForm.locationSelect.value = 'OFICINA';
        elements.userForm.locationManual.classList.add('hidden');
    };

    const existingUser = state.resguardantes.find(u => u.name.trim().toLowerCase() === name.toLowerCase());
    if (existingUser) {
        showConfirmationModal('Usuario Existente', `El usuario "${name}" ya existe. ¿Registrarlo en esta nueva ubicación?`, createUserAction);
    } else {
        createUserAction();
    }
}

/**
 * Añade un nuevo bien adicional.
 */
function addAdicionalItem() {
    if (state.readOnlyMode) return;
    if (!state.activeResguardante) return showToast('Debe activar un usuario para registrar bienes.', 'error');
    
    const formData = new FormData(elements.adicionales.form);
    const newItem = Object.fromEntries(formData.entries());
    if (!newItem.descripcion) return showToast('La descripción es obligatoria.', 'error');
    
    const newSerie = newItem.serie.trim();
    if (newSerie && state.serialNumberCache.has(newSerie.toLowerCase())) {
        return showToast('Advertencia: Esa serie/clave ya existe en el inventario.', 'warning');
    }

    newItem.usuario = state.activeResguardante.name;
    newItem.id = generateUUID();
    newItem.fechaRegistro = new Date().toISOString();

    const finalizeItemAddition = (item) => {
        state.additionalItems.push(item);
        logActivity('Bien adicional registrado', `Descripción: ${item.descripcion}, Usuario: ${item.usuario}`);
        showToast('Bien adicional registrado.');
        elements.adicionales.form.reset();
        document.getElementById('ad-clave').value = ''; // Reset explícito
        document.querySelector('#adicional-form input[name="personal"][value="No"]').checked = true;
        renderAdicionalesList(); 
        saveState(); 
        renderDashboard(); 
        updateSerialNumberCache();
        document.getElementById('ad-clave').focus();
    };

    if (newItem.personal === 'Si') {
        showFormatoEntradaModal((tieneFormato) => {
            newItem.tieneFormatoEntrada = tieneFormato;
            finalizeItemAddition(newItem);
        });
    } else {
        finalizeItemAddition(newItem);
    }
}

/**
 * Guarda la edición de un bien adicional desde su modal.
 */
function saveAdicionalEdit() {
    const id = elements.editAdicionalModal.saveBtn.dataset.id;
    const itemIndex = state.additionalItems.findIndex(i => i.id === id);
    if (itemIndex === -1) return;
    
    const formData = new FormData(elements.editAdicionalModal.form);
    const updatedData = Object.fromEntries(formData.entries());
    state.additionalItems[itemIndex] = { ...state.additionalItems[itemIndex], ...updatedData };
    
    elements.editAdicionalModal.modal.classList.remove('show');
    renderAdicionalesList(); 
    updateSerialNumberCache(); 
    saveState();
    logActivity('Bien adicional editado', `ID: ${id}`);
    showToast('Bien adicional actualizado.');
}

/**
 * Guarda la edición de un usuario desde su modal.
 */
function saveUserEdit() {
    const index = elements.editUserSaveBtn.dataset.userIndex;
    const oldName = state.resguardantes[index].name;
    const newName = document.getElementById('edit-user-name').value.trim();
    if (!newName) return showToast('El nombre no puede estar vacío.', 'error');
    
    state.resguardantes[index].name = newName;
    state.resguardantes[index].locationWithId = document.getElementById('edit-user-location').value;
    const locationBase = document.getElementById('edit-user-location').value.replace(/\s\d+$/, '');
    state.resguardantes[index].location = locationBase;
    state.resguardantes[index].area = elements.editUserAreaSelect.value;
    
    // Actualizar nombre en inventario y adicionales si cambió
    if (oldName !== newName) {
        state.inventory.forEach(i => { if(i['NOMBRE DE USUARIO'] === oldName) i['NOMBRE DE USUARIO'] = newName; });
        state.additionalItems.forEach(i => { if(i.usuario === oldName) i.usuario = newName; });
    }

    if (state.activeResguardante && state.activeResguardante.id === state.resguardantes[index].id) {
        state.activeResguardante = state.resguardantes[index];
    }
    
    // recalcular contadores de ubicación (no implementado en esta modularización, pero aquí iría)
    // recalculateLocationCounts();

    elements.editUserModal.classList.remove('show');
    renderUserList(); 
    populateReportFilters();
    saveState(); 
    logActivity('Usuario editado', `Nombre anterior: ${oldName}, Nombre nuevo: ${newName}`);
    showToast('Usuario actualizado.');
}

/**
 * Guarda una nota desde el modal de notas.
 */
function saveNote() {
    if (state.readOnlyMode) return;
    const claves = JSON.parse(elements.noteSaveBtn.dataset.claves);
    const noteText = elements.noteTextarea.value.trim();
    
    claves.forEach(clave => {
        if (noteText) {
            state.notes[clave] = noteText;
        } else {
            delete state.notes[clave]; // Borrar nota si está vacía
        }
    });
    
    logActivity('Nota guardada', `Nota para clave(s): ${claves.join(', ')}`);
    showToast('Nota(s) guardada(s).');
    elements.notesModal.classList.remove('show');
    filterAndRenderInventory({ showItemDetailView }); // Refrescar para mostrar/quitar indicador
    saveState();
}

/**
 * Captura una foto desde el stream de la cámara.
 * @param {object} callbacks - Objeto de callbacks de actualización.
 */
function capturePhoto(callbacks) {
    const { cameraStream, photoCanvas, input } = elements.photo;
    const context = photoCanvas.getContext('2d');
    photoCanvas.width = cameraStream.videoWidth;
    photoCanvas.height = cameraStream.videoHeight;
    context.drawImage(cameraStream, 0, 0, photoCanvas.width, photoCanvas.height);
    
    photoCanvas.toBlob(blob => {
        if (blob) {
            const type = input.dataset.type;
            const id = input.dataset.id;
            if (blob.size > 2 * 1024 * 1024) return showToast('La imagen es demasiado grande (máx 2MB).', 'error');

            photoDB.setItem('photos', `${type}-${id}`, blob).then(() => {
                if (callbacks[type]) callbacks[type](id, true); // Informar que la foto existe
                logActivity('Foto capturada', `Tipo: ${type}, ID: ${id}`);
                showToast(`Foto adjuntada.`);
                elements.photo.modal.classList.remove('show');
                stopCamera(); 
                saveState();
            }).catch(err => showToast('Error al guardar la foto.', 'error'));
        }
    }, 'image/jpeg', 0.9);
}

/**
 * Sube un archivo de foto desde el input.
 * @param {File} file - El archivo de imagen.
 * @param {object} callbacks - Objeto de callbacks de actualización.
 */
function uploadPhoto(file, callbacks) {
    const { input } = elements.photo;
    const type = input.dataset.type;
    const id = input.dataset.id;
    
    if (file && type && id) {
        if (file.size > 2 * 1024 * 1024) return showToast('La imagen es demasiado grande (máx 2MB).', 'error');
        
        photoDB.setItem('photos', `${type}-${id}`, file).then(() => {
            if (callbacks[type]) callbacks[type](id, true); // Informar que la foto existe
            logActivity('Foto subida', `Tipo: ${type}, ID: ${id}`);
            showToast(`Foto adjuntada.`);
            stopCamera();
            elements.photo.modal.classList.remove('show'); 
            saveState();
        }).catch(err => showToast('Error al guardar la foto.', 'error'));
    }
}

/**
 * Elimina una foto.
 * @param {object} callbacks - Objeto de callbacks de actualización.
 */
function deletePhoto(callbacks) {
    const type = elements.photo.deleteBtn.dataset.type;
    const id = elements.photo.deleteBtn.dataset.id;
    
    showConfirmationModal('Eliminar Foto', `¿Seguro que quieres eliminar la foto?`, () => {
        photoDB.deleteItem('photos', `${type}-${id}`).then(() => {
            if (callbacks[type]) callbacks[type](id, false); // Informar que la foto ya no existe
            logActivity('Foto eliminada', `Tipo: ${type}, ID: ${id}`);
            showToast(`Foto eliminada.`);
            stopCamera();
            elements.photo.modal.classList.remove('show'); 
            saveState();
        }).catch(err => showToast('Error al eliminar la foto.', 'error'));
    });
}


// --- 3. DEFINICIÓN DE CALLBACKS DE ORQUESTACIÓN ---

// Callbacks para los botones de acción del inventario
const inventoryActionCallbacks = {
    checkAreaCompletion,
    checkInventoryCompletion,
    renderDashboard
};

// Callbacks para los botones del modal de Vista de Detalles
const detailViewCallbacks = {
    onUbicar: (clave) => {
        const checkbox = document.querySelector(`tr[data-clave="${clave}"] .inventory-item-checkbox`);
        if(checkbox) checkbox.checked = true;
        handleInventoryActions('ubicar', inventoryActionCallbacks);
        if(checkbox) checkbox.checked = false;
    },
    onReetiquetar: (clave) => {
        const checkbox = document.querySelector(`tr[data-clave="${clave}"] .inventory-item-checkbox`);
        if(checkbox) checkbox.checked = true;
        handleInventoryActions('re-etiquetar', inventoryActionCallbacks);
        if(checkbox) checkbox.checked = false;
    },
    onNota: (clave) => showNotesModal([clave]),
    onFoto: (clave) => showPhotoModal('inventory', clave, photoUpdateCallbacks)
};

// Callbacks para cuando se actualiza una foto (subir/borrar)
const photoUpdateCallbacks = {
    inventory: (id, exists) => {
        state.photos[id] = exists;
        filterAndRenderInventory({ showItemDetailView });
    },
    additional: (id, exists) => {
        state.additionalPhotos[id] = exists;
        renderAdicionalesList();
    },
    location: (id, exists) => {
        state.locationPhotos[id] = exists;
        renderUserList();
    }
};

// Objeto de callbacks para el modal de pre-impresión
const reportCallbacks = {
    'session_summary': reports.generateSessionSummary,
    'area_closure': (options) => {
        if(reports.generateAreaClosureReport(options)) {
            renderLoadedLists(); // Actualizar UI si el acta se cierra
        }
    },
    'simple_pending': reports.generateSimplePendingReport,
    'individual_resguardo': (options) => {
         const selectedUser = elements.reports.userFilter.value;
         if (!selectedUser || selectedUser === 'all') return showToast('Selecciona un usuario para generar un resguardo individual.', 'error');
         const userItems = state.inventory.filter(item => item['NOMBRE DE USUARIO'] === selectedUser);
         reports.generatePrintableResguardo('Resguardo de Bienes Individual', options.recibe, userItems, false, options);
    },
    'adicionales_informe': (options) => {
        let itemsToPrint = state.additionalItems;
        const reportSelectedArea = elements.reports.areaFilter.value;
        const reportSelectedUser = elements.reports.userFilter.value;

        if (reportSelectedArea !== 'all') {
            const usersInArea = state.resguardantes.filter(u => u.area === reportSelectedArea).map(u => u.name);
            itemsToPrint = itemsToPrint.filter(item => usersInArea.includes(item.usuario));
        }
        if (reportSelectedUser !== 'all') {
            itemsToPrint = itemsToPrint.filter(item => item.usuario === reportSelectedUser);
        } 
        
        reports.generatePrintableResguardo('Informe de Bienes Adicionales', options.recibe, itemsToPrint, true, options);
    }
};


// --- 4. FUNCIÓN DE INICIALIZACIÓN Y REGISTRO DE EVENTOS ---

function initialize() {
    // Inicializar la base de datos de fotos primero
    photoDB.init().then(() => {
        // Cargar estado
        if (loadState()) {
            if (state.loggedIn) {
                showMainApp();
            }
        }
        // Si no hay estado o no está logueado, la UI de login se muestra por defecto
    }).catch(err => {
        console.error('No se pudo iniciar la base de datos de fotos. La app no puede continuar.', err);
        alert('Error fatal: No se pudo iniciar la base de datos local. La aplicación no funcionará.');
    });

    // --- Listeners de Login y Globales ---
    elements.employeeLoginBtn.addEventListener('click', handleEmployeeLogin);
    elements.employeeNumberInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') e.preventDefault(); handleEmployeeLogin();
    });

    elements.dashboard.toggleBtn.addEventListener('click', () => {
        elements.dashboard.headerAndDashboard.classList.toggle('hidden');
    });

    let logoClickCount = 0;
    elements.logo.title.addEventListener('click', () => {
        logoClickCount++;
        if (logoClickCount >= 5) {
            // Lógica de descarga de log
            logoClickCount = 0;
        }
    });

    elements.clearSessionLink.addEventListener('click', (e) => {
        e.preventDefault();
        showConfirmationModal('Limpiar Sesión Completa', 'Esto borrará TODO el progreso. ¿Estás seguro?', async () => {
            localStorage.removeItem('inventarioProState');
            await fileHandlers.deleteDB('InventarioProPhotosDB');
            window.location.reload();
        });
    });

    elements.logoutBtn.addEventListener('click', () => {
         logActivity('Cierre de sesión', `Usuario ${state.currentUser.name} ha salido.`);
         saveState();
         elements.mainApp.classList.add('hidden');
         elements.loginPage.classList.remove('hidden');
         window.location.reload(); // Forzar recarga para limpiar estado
    });

    elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
        [...e.target.files].forEach(file => fileHandlers.processFile(file));
        e.target.value = '';
    });

    elements.tabsContainer.addEventListener('click', e => {
        const tabBtn = e.target.closest('.tab-btn');
        if(tabBtn && tabBtn.dataset.tab) changeTab(tabBtn.dataset.tab);
    });
    
    // --- Listeners Pestaña Inventario ---
    const debouncedSearch = debounce(() => {
        filterAndRenderInventory({ showItemDetailView });
    }, 300);
    elements.inventory.searchInput.addEventListener('input', debouncedSearch);

    elements.inventory.tableBody.addEventListener('click', (e) => {
        const target = e.target;
        const row = target.closest('tr');
        const clave = row?.dataset.clave;
        if (!clave) return;

        if (target.closest('.note-icon')) {
            showNotesModal([clave]);
        } else if (target.closest('.camera-icon')) {
            showPhotoModal('inventory', clave, photoUpdateCallbacks);
        } else if (target.closest('.view-qr-btn')) {
            showQrModal(clave);
        } else if (target.closest('.view-details-btn')) {
            // showItemDetailsModal(clave); // Esta función ya no existe, usamos la nueva
            showItemDetailView(clave, detailViewCallbacks);
        } else if (!target.classList.contains('inventory-item-checkbox')) { 
             showItemDetailView(clave, detailViewCallbacks);
        }
    });

    elements.inventory.statusFilter.addEventListener('change', () => filterAndRenderInventory({ showItemDetailView }));
    elements.inventory.areaFilter.addEventListener('change', () => filterAndRenderInventory({ showItemDetailView }));
    elements.inventory.bookTypeFilter.addEventListener('change', () => filterAndRenderInventory({ showItemDetailView }));

    elements.inventory.selectAllCheckbox.addEventListener('change', e =>
        document.querySelectorAll('.inventory-item-checkbox').forEach(cb => cb.checked = e.target.checked));
    
    elements.inventory.ubicadoBtn.addEventListener('click', () => handleInventoryActions('ubicar', inventoryActionCallbacks));
    elements.inventory.reEtiquetarBtn.addEventListener('click', () => handleInventoryActions('re-etiquetar', inventoryActionCallbacks));
    elements.inventory.desubicarBtn.addEventListener('click', () => handleInventoryActions('desubicar', inventoryActionCallbacks));
    
    elements.inventory.addNoteBtn.addEventListener('click', () => {
        const selectedClaves = Array.from(document.querySelectorAll('.inventory-item-checkbox:checked')).map(cb => cb.closest('tr').dataset.clave);
        showNotesModal(selectedClaves);
    });
    
    elements.inventory.qrScanBtn.addEventListener('click', () => {
        startQrScanner((decodedText) => {
            elements.inventory.searchInput.value = decodedText;
            filterAndRenderInventory({ showItemDetailView });
            showToast(`Bien ${decodedText} encontrado.`);
            logActivity('Escaneo QR', `Clave: ${decodedText}.`);
            changeTab('inventory');
        });
    });

    elements.inventory.clearSearchBtn.addEventListener('click', clearInventorySearch);
    elements.inventory.prevPageBtn.addEventListener('click', () => changeInventoryPage('prev'));
    elements.inventory.nextPageBtn.addEventListener('click', () => changeInventoryPage('next'));

    // --- Listeners Pestaña Usuarios ---
    elements.userForm.createBtn.addEventListener('click', createUser);
    elements.userForm.locationSelect.addEventListener('change', e => 
        elements.userForm.locationManual.classList.toggle('hidden', e.target.value !== 'OTRA'));
    
    document.getElementById('user-search-input')?.addEventListener('input', renderUserList);

    elements.userForm.list.addEventListener('click', e => {
        const button = e.target.closest('button');
        const icon = e.target.closest('i.location-photo-btn');
        const userInfoClick = e.target.closest('.user-info-clickable');

        if (userInfoClick && !button && !icon) {
            if (userInfoClick.dataset.userId) showUserDetailView(userInfoClick.dataset.userId);
            return;
        }

        if(icon) {
            if (icon.dataset.locationId) showPhotoModal('location', icon.dataset.locationId, photoUpdateCallbacks);
            return;
        }

        if (!button || state.readOnlyMode) return;
        const index = parseInt(button.dataset.index, 10);
        
        if (button.classList.contains('activate-user-btn')) {
            const user = state.resguardantes[index];
            state.activeResguardante = user;
            logActivity('Usuario activado', `Usuario: ${user.name}`);
            showToast(`Usuario ${user.name} activado.`);
            renderUserList();
            updateActiveUserBanner();
        } else if (button.classList.contains('edit-user-btn')) {
            showEditUserModal(index);
        } else if (button.classList.contains('delete-user-btn')) {
            const user = state.resguardantes[index];
            const assignedItemsCount = state.inventory.filter(item => item['NOMBRE DE USUARIO'] === user.name).length;
            let text = `¿Eliminar a ${user.name}?`;
            if (assignedItemsCount > 0) text += ` Tiene ${assignedItemsCount} bien(es) asignado(s).`;

            showConfirmationModal('¿Eliminar Usuario?', text, () => {
                const recentlyDeleted = { item: user, originalIndex: index };
                state.resguardantes.splice(index, 1);
                if (state.activeResguardante?.id === user.id) state.activeResguardante = null;

                renderUserList();
                populateReportFilters();
                logActivity('Usuario eliminado', `Nombre: ${user.name}`);
                
                showUndoToast('Usuario eliminado.', () => {
                    state.resguardantes.splice(recentlyDeleted.originalIndex, 0, recentlyDeleted.item);
                    renderUserList(); 
                    saveState(); 
                    showToast('Acción deshecha.');
                    logActivity('Acción deshecha', `Restaurado ${user.name}`);
                });
                saveState();
            });
        }
    });
    
    elements.activeUserBanner.deactivateBtn.addEventListener('click', () => {
        if (state.activeResguardante) {
            logActivity('Usuario desactivado', `Usuario: ${state.activeResguardante.name}`);
            showToast(`Usuario ${state.activeResguardante.name} desactivado.`);
            state.activeResguardante = null;
            updateActiveUserBanner();
            renderUserList();
        }
    });

    // --- Listeners Pestaña Adicionales ---
    elements.adicionales.form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Lógica para saltar al siguiente input
        }
    });
    elements.adicionales.addBtn.addEventListener('click', addAdicionalItem);
    
    elements.adicionales.areaFilter.addEventListener('change', () => {
        populateAdicionalesFilters();
        renderAdicionalesList();
    });
    elements.adicionales.userFilter.addEventListener('change', renderAdicionalesList);

    elements.adicionales.list.addEventListener('click', e => {
        const itemClickable = e.target.closest('.adicional-item-clickable');
        const isButton = e.target.closest('button');

        if (itemClickable && !isButton) {
            if (itemClickable.dataset.id) showAdicionalDetailView(itemClickable.dataset.id);
            return;
        }
        if (state.readOnlyMode) return;

        const editBtn = e.target.closest('.edit-adicional-btn');
        const deleteBtn = e.target.closest('.delete-adicional-btn');
        const photoBtn = e.target.closest('.adicional-photo-btn');
        const id = editBtn?.dataset.id || deleteBtn?.dataset.id || photoBtn?.dataset.id;
        if (!id) return;
        
        const item = state.additionalItems.find(i => i.id === id);
        if (!item) return;

        if (editBtn) showEditAdicionalModal(id);
        if (photoBtn) showPhotoModal('additional', id, photoUpdateCallbacks);
        if (deleteBtn) {
            if (state.additionalPhotos[id]) {
                showTransferPhotoModal(item, deleteAdditionalItem);
            } else {
                showConfirmationModal('Eliminar Bien Adicional', `¿Eliminar "${item.descripcion}"?`, () => {
                    deleteAdditionalItem(item.id, false);
                });
            }
        }
    });

    elements.adicionales.printResguardoBtn.addEventListener('click', () => {
        const data = {
            isForArea: elements.adicionales.areaFilter.value !== 'all' && elements.adicionales.userFilter.value === 'all',
            isForUser: elements.adicionales.userFilter.value !== 'all'
        };
        // Sobrescribir filtros de reporte temporalmente
        elements.reports.areaFilter.value = elements.adicionales.areaFilter.value;
        elements.reports.userFilter.value = elements.adicionales.userFilter.value;
        showPreprintModal('adicionales_informe', data, reportCallbacks);
    });

    // --- Listeners Pestaña Reportes ---
    elements.reports.exportXlsxBtn.addEventListener('click', reports.exportInventoryToXLSX);
    elements.reports.exportLabelsXlsxBtn.addEventListener('click', reports.exportLabelsToXLSX);
    elements.reports.areaFilter.addEventListener('change', populateReportFilters);

    elements.reports.reportButtons.forEach(button => {
        button.addEventListener('click', () => {
            const reportType = button.dataset.reportType;
            if (!reportType) return;
            
            const data = {};
            if (reportType === 'adicionales_informe') {
                data.isForArea = elements.reports.areaFilter.value !== 'all' && elements.reports.userFilter.value === 'all';
                data.isForUser = elements.reports.userFilter.value !== 'all';
            }
            
            const preprintReports = ['session_summary', 'area_closure', 'simple_pending', 'individual_resguardo', 'adicionales_informe'];
            
            if (preprintReports.includes(reportType)) {
                showPreprintModal(reportType, data, reportCallbacks);
            } else if (reportType === 'tasks_report') {
                reports.generateTasksReport();
            } else if (reportType === 'inventory') {
                reports.generateInventoryReport();
            } else if (reportType === 'institutional_adicionales') {
                reports.generateInstitutionalAdicionalesReport();
            } else {
                // Lógica para reportes en modal (labels, pending, notes, mismatched)
                let items, title, options;
                const selectedUser = elements.reports.userFilter.value;
                const selectedArea = elements.reports.areaFilter.value;
                
                let filteredItems = state.inventory;
                if (selectedArea !== 'all') filteredItems = filteredItems.filter(item => item.areaOriginal === selectedArea);
                if (selectedUser !== 'all') filteredItems = filteredItems.filter(item => item['NOMBRE DE USUARIO'] === selectedUser);

                switch(reportType) {
                    case 'labels':
                        items = filteredItems.filter(item => item['IMPRIMIR ETIQUETA'] === 'SI');
                        title = 'Reporte de Etiquetas';
                        options = { reportType: 'labels', headers: ['Acción', 'Clave Única', 'Descripción', 'Usuario'] };
                        break;
                    case 'pending':
                        items = filteredItems.filter(item => item.UBICADO !== 'SI');
                        title = 'Reporte de Bienes Pendientes';
                        options = { headers: ['Clave Única', 'Descripción', 'Serie', 'Área Original'] };
                        break;
                    case 'notes':
                        items = filteredItems.filter(item => state.notes[item['CLAVE UNICA']]);
                        title = 'Reporte de Notas';
                        options = { reportType: 'notes', headers: ['Acción', 'Clave Única', 'Descripción', 'Nota'] };
                        break;
                    case 'mismatched':
                        items = filteredItems.filter(item => item.areaIncorrecta);
                        title = 'Reporte de Bienes Fuera de Área';
                        options = { reportType: 'mismatched', headers: ['Acción', 'Clave Única', 'Descripción', 'Área Original', 'Usuario/Área Actual'] };
                        break;
                }
                if(items) renderReportTable(items, title, options);
            }
        });
    });

    elements.reports.reportViewModal.modal.addEventListener('click', (e) => {
        if(state.readOnlyMode) return;
        const saveBtn = e.target.closest('.save-new-clave-btn');
        const doneBtn = e.target.closest('.report-label-done-btn');
        
        if (doneBtn) {
            const clave = doneBtn.dataset.clave;
            const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
            if (item) {
                item['IMPRIMIR ETIQUETA'] = 'NO';
                logActivity('Etiqueta marcada como HECHA', `Clave: ${clave}`);
                showToast(`Se quitó la marca de etiqueta para ${clave}.`);
                saveState();
                doneBtn.closest('tr').remove(); // Quitar de la vista
            }
            return;
        }
        
        if (saveBtn) {
            const itemId = saveBtn.dataset.id;
            const input = saveBtn.closest('tr').querySelector('.new-clave-input');
            const newClave = input.value.trim();

            if (newClave && state.serialNumberCache.has(newClave.toLowerCase())) {
                return showToast('Error: Esa clave/serie ya existe.', 'error');
            }

            const itemIndex = state.additionalItems.findIndex(i => i.id === itemId);
            if (itemIndex !== -1) {
                state.additionalItems[itemIndex].claveAsignada = newClave;
                updateSerialNumberCache();
                saveState();
                logActivity('Clave Asignada a Bien Adicional', `ID: ${itemId}, Clave: ${newClave}`);
                showToast('Clave actualizada.');
            }
        }
    });

    elements.reports.reportViewModal.modal.addEventListener('change', (e) => {
        const checkbox = e.target;
        if (checkbox.classList.contains('report-item-checkbox')) {
            // (Lógica de checkboxes de reporte)
        } else if (checkbox.classList.contains('institutional-report-checkbox')) {
            // (Lógica de checkboxes institucionales)
        }
    });

    // --- Listeners Pestaña Ajustes ---
    elements.settings.themes.forEach(btn => btn.addEventListener('click', () => updateTheme(btn.dataset.theme)));
    elements.settings.exportSessionBtn.addEventListener('click', () => fileHandlers.exportSession(false));
    elements.settings.finalizeInventoryBtn.addEventListener('click', () => {
        showConfirmationModal('Finalizar Inventario', 'Esto creará un respaldo final de solo lectura. No podrás hacer más cambios. ¿Continuar?', () => {
            fileHandlers.exportSession(true);
        });
    });
    
    elements.settings.importSessionBtn.addEventListener('click', () => elements.settings.importFileInput.click());
    elements.settings.importFileInput.addEventListener('change', (e) => {
        if(e.target.files[0]) fileHandlers.importSessionZip(e.target.files[0]);
        e.target.value = '';
    });

    elements.settings.loadedListsContainer.addEventListener('click', (e) => {
        if (state.readOnlyMode) return;
        const deleteBtn = e.target.closest('.delete-list-btn');
        const generateBtn = e.target.closest('.generate-area-report-btn');
        const reprintBtn = e.target.closest('.reprint-area-report-btn');

        if (deleteBtn) {
            const listId = Number(deleteBtn.dataset.listId);
            const listToDelete = state.inventory.find(i => i.listId === listId);
            if (!listToDelete) return;
            // ... (Lógica de showReassignModal o deleteListAndRefresh) ...
            showConfirmationModal('Eliminar Listado', `¿Eliminar "${listToDelete.fileName}"?`, () => {
                deleteListAndRefresh(listId);
            });
        }
        
        if (generateBtn || reprintBtn) {
            const areaId = generateBtn?.dataset.areaId || reprintBtn?.dataset.areaId;
            let data = { areaId };
            if (reprintBtn) {
                 const closedInfo = state.closedAreas[areaId];
                 if (closedInfo) data = { ...data, ...closedInfo };
            }
            showPreprintModal('area_closure', data, reportCallbacks);
        }
    });
    
    let aboutClickCount = 0;
    elements.settings.aboutHeader.addEventListener('click', () => {
        aboutClickCount++;
        if (aboutClickCount >= 5) elements.settings.aboutContent.classList.remove('hidden');
    });
    
    elements.log.showBtn.addEventListener('click', showLogModal);
    elements.log.closeBtn.addEventListener('click', () => elements.log.modal.classList.remove('show'));

    elements.settings.importPhotosBtn.addEventListener('click', () => elements.settings.importPhotosInput.click());
    elements.settings.importPhotosInput.addEventListener('change', (e) => {
        if(e.target.files.length) fileHandlers.importPhotos(e.target.files);
        e.target.value = '';
    });

    elements.settings.restorePhotosBtn.addEventListener('click', () => elements.settings.restorePhotosInput.click());
    elements.settings.restorePhotosInput.addEventListener('change', (e) => {
        if(e.target.files[0]) fileHandlers.restorePhotosZip(e.target.files[0]);
        e.target.value = '';
    });

    // --- Listeners de Modales (Genéricos) ---
    // Botones de cancelar/cerrar
    [
        elements.notesModal, elements.photo.modal, elements.editUserModal, 
        elements.editAdicionalModal.modal, elements.qrDisplayModal.modal, 
        elements.itemDetailsModal.modal, elements.preprintModal.modal, 
        elements.layoutEditor.modal, elements.transferPhotoModal.modal,
        elements.detailView.modal, elements.userDetailView.modal,
        elements.adicionalDetailView.modal, elements.reports.reportViewModal.modal,
        elements.log.modal
    ].forEach(modal => {
        modal.addEventListener('click', e => {
            const closeBtn = e.target.closest('.modal-cancel, #note-cancel-btn, #photo-close-btn, #edit-user-cancel-btn, #edit-adicional-cancel-btn, #qr-display-close-btn, #item-details-close-btn, #preprint-cancel-btn, #layout-close-btn, #transfer-photo-cancel-btn, #detail-view-close-btn, #user-detail-view-close-btn, #user-detail-view-close-footer-btn, #adicional-detail-view-close-btn, #adicional-detail-view-close-footer-btn, #report-view-close-btn, #report-view-close-footer-btn, #log-close-btn');
            if (closeBtn) {
                modal.classList.remove('show');
                stopCamera(); // Detener cámara si estaba activa
            }
        });
    });

    // Handlers de guardado de modales
    elements.noteSaveBtn.addEventListener('click', saveNote);
    elements.editAdicionalModal.saveBtn.addEventListener('click', saveAdicionalEdit);
    elements.editUserSaveBtn.addEventListener('click', saveUserEdit);

    // Handlers de modal de fotos
    elements.photo.useCameraBtn.addEventListener('click', startCamera);
    elements.photo.switchToUploadBtn.addEventListener('click', () => {
        stopCamera();
        elements.photo.cameraViewContainer.classList.add('hidden');
        elements.photo.uploadContainer.classList.remove('hidden');
    });
    elements.photo.captureBtn.addEventListener('click', () => capturePhoto(photoUpdateCallbacks));
    elements.photo.input.addEventListener('change', (e) => {
        if(e.target.files[0]) uploadPhoto(e.target.files[0], photoUpdateCallbacks);
    });
    elements.photo.deleteBtn.addEventListener('click', () => deletePhoto(photoUpdateCallbacks));

    // Handler del scanner QR
    elements.qrScannerCloseBtn.addEventListener('click', stopQrScanner);
    
    // --- Listeners del Editor de Croquis ---
    initializeLayoutEditor();

    // --- Listener Global de Salida ---
    window.addEventListener('beforeunload', (event) => {
        if (state.loggedIn && !state.readOnlyMode) {
            saveState(); // Un último guardado por si acaso
            event.preventDefault();
            event.returnValue = '';
        }
    });
}

// --- 5. INICIAR LA APLICACIÓN ---
initialize();