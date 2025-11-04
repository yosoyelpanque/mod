import elements from './elements.js';
import { photoDB, deleteDB } from './db.js'; // Asumiremos que deleteDB está en db.js

// Definimos la estructura inicial del estado de la aplicación
let state = {
    loggedIn: false,
    currentUser: null,
    inventory: [],
    additionalItems: [],
    resguardantes: [],
    activeResguardante: null,
    locations: {},
    areas: [],
    areaNames: {},
    lastAutosave: null,
    sessionStartTime: null,
    additionalPhotos: {},
    locationPhotos: {},
    notes: {},
    photos: {},
    theme: 'light',
    inventoryFinished: false,
    areaDirectory: {},
    closedAreas: {},
    completedAreas: {}, // Para rastrear áreas 100% completadas
    persistentAreas: [],
    serialNumberCache: new Set(),
    cameraStream: null,
    readOnlyMode: false,
    activityLog: [],
    institutionalReportCheckboxes: {},
    actionCheckboxes: {
        labels: {},
        notes: {},
        additional: {},
        mismatched: {},
        personal: {}
    },
    reportCheckboxes: {
        notes: {},
        mismatched: {}
    },
    mapLayout: { 'page1': {} },
    currentLayoutPage: 'page1',
    layoutPageNames: { 'page1': 'Página 1' },
    layoutImages: {},
    layoutPageColors: { 'page1': '#ffffff' },
    layoutItemColors: {}
};

// Variable interna para el intervalo de autoguardado
let autosaveIntervalId;

/**
 * Carga el estado de la aplicación desde localStorage.
 * @returns {boolean} - True si el estado se cargó, False si no.
 */
export function loadState() {
    try {
        const storedState = localStorage.getItem('inventarioProState');
        if (storedState) {
            const loaded = JSON.parse(storedState);
            // Sobrescribimos el estado por defecto con el estado cargado
            Object.assign(state, loaded); 
            
            // Re-hidratamos el Set que no se guarda en JSON
            updateSerialNumberCache(); 
            return true;
        }
    } catch (e) { 
        console.error('Error al cargar el estado:', e);
        localStorage.removeItem('inventarioProState');
    }
    return false;
}

/**
 * Guarda el estado actual de la aplicación en localStorage.
 */
export function saveState() {
    if (state.readOnlyMode) return;

    try {
        // Creamos una copia para guardar, excluyendo datos no serializables
        const stateToSave = { ...state };
        delete stateToSave.serialNumberCache; // No se puede guardar un Set en JSON
        delete stateToSave.cameraStream;      // No se puede guardar un Stream
        
        localStorage.setItem('inventarioProState', JSON.stringify(stateToSave));
    } catch (e) {
        console.error('Error Crítico al guardar el estado:', e);
        
        state.readOnlyMode = true;
        checkReadOnlyMode(); // Mostramos el banner de solo lectura

        // (Dependencia: showConfirmationModal debe estar disponible globalmente o importada)
        // Por ahora, usamos un alert simple.
        alert('¡ALERTA! Almacenamiento Lleno. No se puede guardar más progreso. La aplicación está en Modo de Sólo Lectura.');

        if (autosaveIntervalId) clearInterval(autosaveIntervalId);
    }
}

/**
 * Inicia el intervalo de autoguardado.
 */
export function startAutosave() {
    const interval = (parseInt(elements.settings.autosaveInterval.value) || 30) * 1000;
    if (autosaveIntervalId) clearInterval(autosaveIntervalId);
    
    autosaveIntervalId = setInterval(() => { 
        if (!state.readOnlyMode) {
            saveState(); 
            // (Dependencia: showToast debe importarse)
            console.log('Progreso guardado automáticamente.'); 
            // logActivity('Autoguardado', '...'); // (Dependencia)
        }
    }, interval);
}

/**
 * Actualiza el banner de Modo Solo Lectura basado en el estado.
 */
export function checkReadOnlyMode() {
    if (state.readOnlyMode) {
        elements.readOnlyOverlay.classList.remove('hidden');
        // Deshabilitar todos los botones (esta lógica debería moverse a un módulo UI)
        document.querySelectorAll('button, input, select, textarea').forEach(el => {
            if (!el.closest('.read-only-banner')) { // No deshabilitar el banner mismo
                el.disabled = true;
            }
        });
    } else {
        elements.readOnlyOverlay.classList.add('hidden');
        // Rehabilitar botones (lógica más compleja, mejor manejarla al inicializar)
    }
}

/**
 * Reinicia el estado de la aplicación a sus valores por defecto,
 * manteniendo el usuario actual y el tema.
 */
export async function resetInventoryState() {
    const currentUser = state.currentUser;
    const theme = state.theme;

    // Guardamos el estado base
    const baseState = {
        loggedIn: true, currentUser, theme,
        sessionStartTime: new Date().toISOString(),
        serialNumberCache: new Set(),
        readOnlyMode: false,
        activityLog: [],
        // Restaurar todos los demás campos a sus valores iniciales
        inventory: [], additionalItems: [], resguardantes: [], activeResguardante: null,
        locations: {}, areas: [], areaNames: {}, lastAutosave: null, additionalPhotos: {},
        locationPhotos: {}, notes: {}, photos: {}, inventoryFinished: false,
        areaDirectory: {}, closedAreas: {}, completedAreas: {}, persistentAreas: [],
        cameraStream: null, institutionalReportCheckboxes: {},
        actionCheckboxes: { labels: {}, notes: {}, additional: {}, mismatched: {}, personal: {} },
        reportCheckboxes: { notes: {}, mismatched: {} },
        mapLayout: { 'page1': {} }, currentLayoutPage: 'page1',
        layoutPageNames: { 'page1': 'Página 1' }, layoutImages: {},
        layoutPageColors: { 'page1': '#ffffff' }, layoutItemColors: {}
    };

    // Reemplazamos el estado actual
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, baseState);
    
    try {
        // Limpiamos la base de datos de fotos
        await deleteDB('InventarioProPhotosDB');
        await photoDB.init(); 
        
        // (Dependencia: showToast)
        console.log('Se ha iniciado un nuevo inventario.');
        // logActivity('Sesión reiniciada', ...); // (Dependencia)
        saveState();
        // (Dependencia: showMainApp)
        // showMainApp(); 
    } catch (error) {
        console.error("Error al reiniciar la base de datos de fotos:", error);
        // (Dependencia: showToast)
        console.error('No se pudo reiniciar la base de datos. Intenta recargar la página.');
    }
}

/**
 * Re-calcula el caché de números de serie desde el estado.
 */
export function updateSerialNumberCache() {
    state.serialNumberCache.clear();
    state.inventory.forEach(item => {
        if (item.SERIE) state.serialNumberCache.add(String(item.SERIE).trim().toLowerCase());
        if (item['CLAVE UNICA']) state.serialNumberCache.add(String(item['CLAVE UNICA']).trim().toLowerCase());
    });
    state.additionalItems.forEach(item => {
        if (item.serie) state.serialNumberCache.add(String(item.serie).trim().toLowerCase());
        if (item.clave) state.serialNumberCache.add(String(item.clave).trim().toLowerCase());
    });
}

// Exportamos el estado como la exportación por defecto
export default state;