/**
 * db.js
 * Contiene el wrapper para IndexedDB (photoDB) y la función deleteDB.
 * Esto maneja todo el almacenamiento de blobs (fotos, imágenes de croquis).
 */

/**
 * Wrapper de IndexedDB para manejar el almacenamiento de fotos y blobs.
 */
export const photoDB = {
    db: null,

    /**
     * Inicializa la conexión con IndexedDB.
     */
    init: function() {
        return new Promise((resolve, reject) => {
            // Versión 2 para incluir 'layoutImages'
            const request = indexedDB.open('InventarioProPhotosDB', 2); 
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('photos')) {
                    db.createObjectStore('photos');
                }
                if (!db.objectStoreNames.contains('layoutImages')) {
                    db.createObjectStore('layoutImages');
                }
            };
            
            request.onsuccess = (event) => { 
                this.db = event.target.result; 
                console.log("IndexedDB (photoDB) inicializada.");
                resolve(); 
            };
            
            request.onerror = (event) => { 
                console.error('Error con IndexedDB:', event.target.errorCode); 
                reject(event.target.errorCode); 
            };
        });
    },

    /**
     * Guarda o actualiza un item en un object store.
     * @param {string} storeName - El nombre del store ('photos' o 'layoutImages').
     * @param {string} key - La clave del item.
     * @param {*} value - El valor a guardar (ej. un Blob).
     */
    setItem: function(storeName, key, value) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(value, key);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    /**
     * Obtiene un item de un object store.
     * @param {string} storeName - El nombre del store.
     * @param {string} key - La clave del item.
     */
    getItem: function(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    /**
     * Elimina un item de un object store.
     * @param {string} storeName - El nombre del store.
     * @param {string} key - La clave del item a eliminar.
     */
    deleteItem: function(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    /**
     * Obtiene todos los items de un object store.
     * @param {string} storeName - El nombre del store.
     * @returns {Promise<Array<{key: string, value: *}>>} - Un array de objetos {key, value}.
     */
    getAllItems: function(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const keysRequest = store.getAllKeys();
                const valuesRequest = store.getAll();

                Promise.all([
                    new Promise((res, rej) => { keysRequest.onsuccess = () => res(keysRequest.result); keysRequest.onerror = (e) => rej(e.target.error); }),
                    new Promise((res, rej) => { valuesRequest.onsuccess = () => res(valuesRequest.result); valuesRequest.onerror = (e) => rej(e.target.error); })
                ]).then(([keys, values]) => {
                    const result = keys.map((key, index) => ({ key, value: values[index] }));
                    resolve(result);
                }).catch(reject);
            } catch (e) {
                reject(e);
            }
        });
    }
};

/**
 * Elimina una base de datos de IndexedDB por nombre.
 * @param {string} dbName - El nombre de la DB a eliminar.
 */
export function deleteDB(dbName) {
    return new Promise((resolve, reject) => {
        console.log(`[DB] Solicitando eliminación de ${dbName}`);
        const request = indexedDB.deleteDatabase(dbName);
        
        request.onsuccess = () => {
            console.log(`[DB] ${dbName} eliminada exitosamente.`);
            resolve();
        };
        request.onerror = (event) => {
            console.error(`[DB] Error al eliminar ${dbName}:`, event.target.error);
            reject(event.target.error);
        };
        request.onblocked = () => {
            // Esto pasa si otra pestaña tiene la DB abierta
            console.warn('[DB] La eliminación de IndexedDB fue bloqueada. Cierra otras pestañas.');
            resolve(); 
        };
    });
}