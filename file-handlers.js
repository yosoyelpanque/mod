// Importaciones de estado, DB y utilidades
import state, { saveState, updateSerialNumberCache } from './state.js';
import { photoDB } from './db.js';
import elements from './elements.js';
import { logActivity } from './logger.js';
import { showToast, showConfirmationModal } from './utils.js';

// Importaciones de funciones de UI (para actualizar después de la importación)
import { 
    renderDashboard, 
    populateAreaSelects, 
    populateReportFilters, 
    populateBookTypeFilter,
    renderLoadedLists,
    renderDirectory
} from './ui-render.js';
import { filterAndRenderInventory } from './ui-inventory.js';

// XLSX y JSZip se asumen como globales (cargados en index.html)

/**
 * Extrae la información del responsable de una hoja de Excel.
 * @param {object} sheet - La hoja de trabajo (worksheet) de XLSX.
 * @returns {object|null} - Objeto con { name, title } o null.
 */
function extractResponsibleInfo(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const contentRows = data.filter(row => row.some(cell => cell !== null && String(cell).trim() !== ''));

    if (contentRows.length >= 2) {
        const nameRow = contentRows[contentRows.length - 2];
        const titleRow = contentRows[contentRows.length - 1];
        
        const name = nameRow.find(cell => cell !== null && String(cell).trim() !== '');
        const title = titleRow.find(cell => cell !== null && String(cell).trim() !== '');

        if (name && title && isNaN(name) && isNaN(title) && String(name).length > 3 && String(title).length > 3) {
            return { name: String(name).trim(), title: String(title).trim() };
        }
    }
    // ... (El resto de la lógica de búsqueda de 'responsable')
    return null;
}

/**
 * Añade los items de un archivo Excel al estado de la aplicación.
 * @param {object} sheet - La hoja de trabajo (worksheet) de XLSX.
 * @param {string} tipoLibro - El tipo de libro (extraído de la celda).
 * @param {string} fileName - El nombre del archivo original.
 */
function addItemsFromFile(sheet, tipoLibro, fileName) {
    const areaString = sheet['A10']?.v || 'Sin Área';
    const area = areaString.match(/AREA\s(\d+)/)?.[1] || 'Sin Área';
    const listId = Date.now();
    
    if (area && !state.areaNames[area]) {
        state.areaNames[area] = areaString;
    }
    
    const responsible = extractResponsibleInfo(sheet);
    if (area && !state.areaDirectory[area]) {
        if (responsible) {
            state.areaDirectory[area] = {
                fullName: areaString,
                name: responsible.name,
                title: responsible.title,
            };
        }
    }

    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 11 });
    const claveUnicaRegex = /^(?:\d{5,6}|0\.\d+)$/;

    const newItems = rawData.map(row => {
        const clave = String(row[0] || '').trim();
        if (!claveUnicaRegex.test(clave)) return null;

        return {
            'CLAVE UNICA': clave, 'DESCRIPCION': String(row[1] || ''), 'OFICIO': row[2] || '', 'TIPO': row[3] || '',
            'MARCA': row[4] || '', 'MODELO': row[5] || '', 'SERIE': row[6] || '', 'FECHA DE INICIO': row[7] || '',
            'REMISIÓN': row[8] || '', 'FECHA DE REMISIÓN': row[9] || '', 'FACTURA': row[10] || '', 'FECHA DE FACTURA': row[11] || '', 'AÑO': row[12] || '',
            'NOMBRE DE USUARIO': '', 'UBICADO': 'NO', 'IMPRIMIR ETIQUETA': 'NO',
            'listadoOriginal': tipoLibro, 'areaOriginal': area,
            'listId': listId, 'fileName': fileName
        };
    }).filter(Boolean); 

    state.inventory = state.inventory.concat(newItems);
    state.inventoryFinished = false; 
    
    logActivity('Archivo cargado', `Archivo "${fileName}" con ${newItems.length} bienes para el área ${area}. Tipo: ${tipoLibro}.`);

    const responsibleName = responsible?.name || 'No detectado';
    const toastMessage = `Área ${area}: Se cargaron ${newItems.length} bienes. Responsable: ${responsibleName}.`;
    showToast(toastMessage, 'success');

    // Actualizar todo
    saveState();
    renderDashboard();
    populateAreaSelects();
    populateReportFilters();
    populateBookTypeFilter();
    filterAndRenderInventory({ showItemDetailView: null }); // No podemos pasar la función aquí, se actualizará al cambiar de pestaña
    renderLoadedLists();
    renderDirectory();
    updateSerialNumberCache();
}

/**
 * Procesa un archivo Excel cargado por el usuario.
 * @param {File} file - El objeto File del input.
 */
export function processFile(file) {
    if (state.readOnlyMode) return showToast('Modo de solo lectura: no se pueden cargar nuevos archivos.', 'warning');
    const fileName = file.name;

    const proceedWithUpload = () => {
        elements.loadingOverlay.overlay.classList.add('show');
        elements.dashboard.headerAndDashboard.classList.add('hidden');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const tipoLibro = sheet['B7']?.v || sheet['L7']?.v || 'Sin Tipo';
                addItemsFromFile(sheet, tipoLibro, fileName);
            } catch (error) {
                console.error("Error processing file: ", error);
                showToast('Error al procesar el archivo. Asegúrate de que el formato es correcto.', 'error');
            } finally {
                elements.loadingOverlay.overlay.classList.remove('show');
            }
        };
        reader.onerror = () => {
            elements.loadingOverlay.overlay.classList.remove('show');
            showToast('Error al leer el archivo.', 'error');
        };
        reader.readAsBinaryString(file);
    };

    const isFileAlreadyLoaded = state.inventory.some(item => item.fileName === fileName);
    
    if (isFileAlreadyLoaded) {
        showConfirmationModal(
            'Archivo Duplicado',
            `El archivo "${fileName}" ya fue cargado. ¿Deseas reemplazar los datos existentes de este archivo con el nuevo?`,
            () => {
                const itemsFromThisFile = state.inventory.filter(item => item.fileName === fileName).length;
                logActivity('Archivo reemplazado', `Archivo "${fileName}" con ${itemsFromThisFile} bienes fue reemplazado.`);
                state.inventory = state.inventory.filter(item => item.fileName !== fileName);
                proceedWithUpload();
            }
        );
    } else {
        proceedWithUpload();
    }
}

/**
 * Exporta la sesión completa (estado + fotos) a un archivo .zip.
 * @param {boolean} isFinal - Si es true, marca la sesión como "solo lectura".
 */
export async function exportSession(isFinal = false) {
    const { overlay, text } = elements.loadingOverlay;
    const type = isFinal ? 'FINALIZADO' : 'backup-editable';
    text.textContent = 'Generando archivo de respaldo...';
    overlay.classList.add('show');

    try {
        const zip = new JSZip();

        const stateToSave = { ...state };
        if (isFinal) {
            stateToSave.readOnlyMode = true; 
        }
        delete stateToSave.serialNumberCache;
        delete stateToSave.cameraStream;
        zip.file("session.json", JSON.stringify(stateToSave));

        text.textContent = 'Empaquetando fotos...';
        const allPhotos = await photoDB.getAllItems('photos');
        if (allPhotos.length > 0) {
            const photoFolder = zip.folder("photos");
            for (const { key, value } of allPhotos) {
                photoFolder.file(key, value);
            }
        }
        
        text.textContent = 'Empaquetando imágenes de croquis...';
        const allLayoutImages = await photoDB.getAllItems('layoutImages');
         if (allLayoutImages.length > 0) {
            const layoutImageFolder = zip.folder("layoutImages");
            for (const { key, value } of allLayoutImages) {
                layoutImageFolder.file(key, value);
            }
        }
        
        text.textContent = 'Comprimiendo archivo...';
        const content = await zip.generateAsync({ type: "blob" });

        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = URL.createObjectURL(content);
        a.download = `inventario-${type}-${date}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        logActivity('Sesión exportada', `Tipo: ${type}`);
        showToast(`Sesión ${isFinal ? 'finalizada y' : ''} exportada como .zip`);
    } catch (e) {
        console.error('Error al exportar la sesión como .zip:', e);
        showToast('Error al exportar la sesión.', 'error');
    } finally {
        overlay.classList.remove('show');
    }
}

/**
 * Importa una sesión completa desde un archivo .zip.
 * @param {File} file - El archivo .zip a importar.
 */
export async function importSessionZip(file) {
    if (!file || !file.name.endsWith('.zip')) {
        return showToast('Por favor, selecciona un archivo de sesión .zip válido.', 'error');
    }
    
    logActivity('Importación de sesión', `Archivo: ${file.name}`);
    const { overlay, text } = elements.loadingOverlay;
    text.textContent = 'Abriendo archivo de sesión...';
    overlay.classList.add('show');

    try {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);
        
        const sessionFile = zip.file('session.json');
        if (!sessionFile) throw new Error('El archivo .zip no contiene un session.json válido.');

        const sessionData = await sessionFile.async('string');
        const importedState = JSON.parse(sessionData);
        
        // --- Importar Fotos ---
        const photoFolder = zip.folder("photos");
        if (photoFolder) {
            overlay.classList.remove('show');
            elements.importProgress.modal.classList.add('show');
            
            const photoFiles = [];
            photoFolder.forEach((relativePath, file) => { if (!file.dir) photoFiles.push(file); });
            
            const totalPhotos = photoFiles.length;
            for (let i = 0; i < totalPhotos; i++) {
                const file = photoFiles[i];
                const key = file.name.split('/').pop();
                const blob = await file.async("blob");
                await photoDB.setItem('photos', key, blob);
                
                const percent = Math.round(((i + 1) / totalPhotos) * 100);
                elements.importProgress.bar.style.width = `${percent}%`;
                elements.importProgress.bar.textContent = `${percent}%`;
                elements.importProgress.text.textContent = `Restaurando foto ${i + 1} de ${totalPhotos}...`;
            }
            elements.importProgress.modal.classList.remove('show');
        }
        
        // --- Importar Imágenes de Croquis ---
        const layoutImageFolder = zip.folder("layoutImages");
        if (layoutImageFolder) {
             const layoutImageFiles = [];
            layoutImageFolder.forEach((relativePath, file) => { if (!file.dir) layoutImageFiles.push(file); });
            for (const file of layoutImageFiles) {
                const key = file.name.split('/').pop();
                const blob = await file.async("blob");
                await photoDB.setItem('layoutImages', key, blob);
            }
        }
        
        // Guardar el estado importado y recargar
        localStorage.setItem('inventarioProState', JSON.stringify(importedState));
        showToast('Sesión importada con éxito. Recargando aplicación...', 'success');
        setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
        console.error("Error al importar la sesión:", err);
        showToast('Error fatal al importar el archivo de sesión.', 'error');
        overlay.classList.remove('show');
        elements.importProgress.modal.classList.remove('show');
    }
}

/**
 * Importa múltiples archivos de fotos, asociándolos por nombre de clave.
 * @param {FileList} files - La lista de archivos de imagen.
 */
export async function importPhotos(files) {
    if (state.readOnlyMode) return showToast('Modo de solo lectura: no se pueden importar fotos.', 'warning');
    if (state.inventory.length === 0) return showToast('Carga un inventario antes de importar fotos.', 'error');
    if (!files.length) return;

    const { modal, text, bar } = elements.importProgress;
    modal.classList.add('show');
    text.textContent = 'Iniciando importación de fotos...';
    bar.style.width = '0%';
    bar.textContent = '0%';

    const inventoryClaves = new Set(state.inventory.map(item => String(item['CLAVE UNICA'])));
    let successCount = 0;
    let errorCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const fileName = file.name;
        const clave = fileName.substring(0, fileName.lastIndexOf('.'));

        const percent = Math.round(((i + 1) / totalFiles) * 100);
        bar.style.width = `${percent}%`;
        bar.textContent = `${percent}%`;
        text.textContent = `Procesando ${i + 1} de ${totalFiles}: ${fileName}`;

        if (inventoryClaves.has(clave)) {
            if (file.size > 2 * 1024 * 1024) { // 2MB Límite
                console.warn(`Archivo ignorado (muy grande): ${fileName}`);
                errorCount++;
                continue;
            }
            try {
                await photoDB.setItem('photos', `inventory-${clave}`, file);
                state.photos[clave] = true;
                successCount++;
            } catch (err) {
                console.error(`Error al guardar la foto ${fileName}:`, err);
                errorCount++;
            }
        } else {
            console.warn(`Archivo ignorado (clave no encontrada): ${fileName}`);
            errorCount++;
        }
    }
    
    modal.classList.remove('show');
    
    if (successCount > 0) {
        saveState();
        filterAndRenderInventory({ showItemDetailView: null });
        showToast(`Importación completa: ${successCount} fotos guardadas con éxito.`, 'success');
    }
    if (errorCount > 0) {
        showToast(`${errorCount} archivos fueron ignorados (clave no encontrada o archivo muy grande).`, 'warning');
    }
}

/**
 * Restaura fotos desde un archivo .zip de backup.
 * @param {File} file - El archivo .zip de backup.
 */
export async function restorePhotosZip(file) {
    if (state.readOnlyMode) return showToast('Modo de solo lectura activado.', 'warning');
    if (state.inventory.length === 0) return showToast('Carga un inventario antes de restaurar fotos.', 'error');

    const { modal, text, bar } = elements.importProgress;
    modal.classList.add('show');

    const inventoryClaves = new Set(state.inventory.map(item => String(item['CLAVE UNICA'])));
    let successCount = 0;
    let ignoredCount = 0;

    try {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);

        const photoFolder = zip.folder("photos");
        if (!photoFolder) {
            modal.classList.remove('show');
            return showToast('Error: El archivo .zip no contiene una carpeta "photos" válida.', 'error');
        }

        const photoFiles = [];
        photoFolder.forEach((relativePath, file) => { if (!file.dir) photoFiles.push(file); });
        const totalPhotos = photoFiles.length;

        for (let i = 0; i < totalPhotos; i++) {
            const photoFile = photoFiles[i];
            const key = photoFile.name.split('/').pop(); // 'inventory-12345.jpg'
            const clave = key.replace('inventory-', '').replace('additional-', '').replace('location-','').split('.')[0];
            
            const percent = Math.round(((i + 1) / totalPhotos) * 100);
            bar.style.width = `${percent}%`;
            bar.textContent = `${percent}%`;
            text.textContent = `Restaurando foto ${i + 1} de ${totalPhotos}...`;

            // Solo restaurar si la clave existe en el inventario actual
            if (inventoryClaves.has(clave)) {
                const blob = await photoFile.async("blob");
                await photoDB.setItem('photos', key, blob);
                if (key.startsWith('inventory-')) state.photos[clave] = true;
                if (key.startsWith('additional-')) state.additionalPhotos[clave] = true;
                successCount++;
            } else {
                ignoredCount++;
            }
        }

        modal.classList.remove('show');

        if (successCount > 0) {
            saveState();
            filterAndRenderInventory({ showItemDetailView: null });
            showToast(`${successCount} fotos restauradas y asociadas con éxito.`, 'success');
        }
        if (ignoredCount > 0) {
            showToast(`${ignoredCount} fotos del backup fueron ignoradas (claves no encontradas).`, 'warning');
        }

    } catch (err) {
        modal.classList.remove('show');
        console.error("Error al restaurar fotos desde el backup:", err);
        showToast('Error al procesar el archivo .zip.', 'error');
    }
}