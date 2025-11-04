import elements from './elements.js';
import state, { saveState } from './state.js';
import { photoDB } from './db.js';
import { logActivity } from './logger.js';
import { 
    showToast, 
    showConfirmationModal, 
    getAreaColor, 
    getLocationIcon, 
    blobToBase64,
    dragMoveListener,
    preparePrint 
} from './utils.js';

/**
 * Rellena la barra lateral del editor de croquis con las ubicaciones disponibles.
 */
function populateLayoutSidebar() {
    const container = elements.layoutEditor.sidebar;
    container.innerHTML = '';
    
    const locationsMap = new Map();
    state.resguardantes.forEach(user => {
        const locId = user.locationWithId;
        if (!locationsMap.has(locId)) {
            locationsMap.set(locId, {
                locationBase: user.location,
                areaId: user.area,
                users: []
            });
        }
        locationsMap.get(locId).users.push(user.name);
    });

    const itemsOnCurrentPage = state.mapLayout[state.currentLayoutPage] || {};

    locationsMap.forEach((data, locId) => {
        const el = document.createElement('div');
        el.className = 'layout-shape draggable-item';
        el.dataset.locationId = locId;
        el.dataset.areaId = data.areaId;
        
        if (itemsOnCurrentPage[locId]) {
            el.classList.add('hidden'); // Ocultar si ya está en el lienzo
        }
        
        let usersHtml = data.users.map(name => `<li>${name}</li>`).join('');
        const iconClass = getLocationIcon(data.locationBase);
        const areaColor = getAreaColor(data.areaId);
        const colorDotHtml = `<div class="area-color-dot" style="background-color: ${areaColor};"></div>`;

        el.innerHTML = `
            ${colorDotHtml}
            <h5><i class="${iconClass} location-icon"></i>${locId}</h5>
            <ul>${usersHtml}</ul>
        `;
        container.appendChild(el);
    });
}

/**
 * Actualiza los controles de paginación del editor (nombre de página, botones).
 */
function updateLayoutPagination() {
    const { pageName, pagePrev, pageNext, pageRemove } = elements.layoutEditor;
    pageName.value = state.layoutPageNames[state.currentLayoutPage] || state.currentLayoutPage;
    
    const pageKeys = Object.keys(state.layoutPageNames);
    const currentIndex = pageKeys.indexOf(state.currentLayoutPage);
    
    pagePrev.disabled = currentIndex <= 0;
    pageNext.disabled = currentIndex >= pageKeys.length - 1;
    pageRemove.disabled = pageKeys.length <= 1; // No eliminar la última página
}

/**
 * Cambia la página visible en el editor de croquis.
 * @param {string} newPageKey - La clave de la nueva página a mostrar.
 */
export function switchLayoutPage(newPageKey) {
    state.currentLayoutPage = newPageKey;
    loadSavedLayout(); // Carga las formas para la nueva página
    populateLayoutSidebar(); // Actualiza la sidebar
    updateLayoutPagination(); // Actualiza los botones de paginación
}

/**
 * Carga las formas guardadas (desde el estado) en el lienzo del editor.
 */
async function loadSavedLayout() {
    const canvas = elements.layoutEditor.canvas;
    canvas.innerHTML = ''; // Limpiar lienzo
    
    const layoutData = state.mapLayout[state.currentLayoutPage] || {};
    
    for (const id in layoutData) {
        if (layoutData.hasOwnProperty(id)) {
            const item = layoutData[id];
            let dataUrl = null;
            if (item.type === 'image' && item.imageId) {
                try {
                    const blob = await photoDB.getItem('layoutImages', item.imageId);
                    if (blob) {
                        dataUrl = URL.createObjectURL(blob);
                    }
                } catch(e) {
                    console.error('Error al cargar imagen de croquis desde DB', e);
                }
            }
            createShapeOnCanvas(id, item.x, item.y, item.width, item.height, item.type, (item.text || ''), dataUrl, (item.rotation || 0), item.areaId);
        }
    }
}

/**
 * Crea un elemento (forma) en el lienzo del editor.
 */
function createShapeOnCanvas(id, x, y, width, height, type = 'location', text = '', imageDataUrl = null, rotation = 0, areaId = null) {
    const canvas = elements.layoutEditor.canvas;
    
    if (canvas.querySelector(`[data-id="${id}"]`)) {
        return; // Ya existe
    }
    
    const el = document.createElement('div');
    el.className = 'layout-shape layout-on-canvas';
    el.dataset.id = id;
    
    let innerHtml = '';
    let colorDotHtml = '';
    let currentAreaId = areaId;

    if (type === 'location') {
        const user = state.resguardantes.find(u => u.locationWithId === id);
        if (!user) return; // No crear si la ubicación no existe

        currentAreaId = user.area;
        el.dataset.areaId = currentAreaId;

        const usersInLoc = state.resguardantes
            .filter(u => u.locationWithId === id)
            .map(u => `<li>${u.name} (Área ${u.area})</li>`)
            .join('');
        const iconClass = getLocationIcon(user.location);
        const areaColor = getAreaColor(currentAreaId);
        colorDotHtml = `<div class="area-color-dot" style="background-color: ${areaColor};"></div>`;

        innerHtml = `
            <h5><i class="${iconClass} location-icon"></i>${id}</h5>
            <ul>${usersInLoc}</ul>
        `;
    } 
    else if (type === 'tool') {
        const toolIconClass = {
            'arrow': 'fa-solid fa-arrow-up',
        }[id.split('-')[0]] || 'fa-solid fa-square';
        
        el.classList.add('tool-shape');
        innerHtml = `<i class="${toolIconClass} tool-icon"></i>`;
        width = width || 50;
        height = height || 50;
    }
    else if (type === 'note') {
        el.classList.add('tool-note');
        innerHtml = `<textarea class="layout-shape-note-textarea" placeholder="Escribe una nota...">${text}</textarea>`;
        width = width || 200;
        height = height || 100;
    }
    else if (type === 'text') {
        el.classList.add('tool-text');
        innerHtml = `<textarea class="layout-shape-text-textarea" placeholder="Texto...">${text}</textarea>`;
        width = width || 150;
        height = height || 40;
    }
    else if (type === 'image') {
        el.classList.add('tool-image');
        if (imageDataUrl) {
            el.style.backgroundImage = `url(${imageDataUrl})`;
        } else {
            innerHtml = `<span>Cargando...</span>`;
        }
        width = width || 300;
        height = height || 200;
    }

    el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    if (width) el.style.width = `${width}px`;
    if (height) el.style.height = `${height}px`;
    
    el.dataset.x = x;
    el.dataset.y = y;
    el.dataset.rotation = rotation;
    el.dataset.type = type; 
    
    const controlsHtml = `
        <div class="layout-delete-btn" title="Eliminar"><i class="fa-solid fa-xmark"></i></div>
        <div class="layout-rotate-handle" title="Rotar"><i class="fa-solid fa-rotate-right"></i></div>
    `;
    
    el.innerHTML = colorDotHtml + innerHtml + controlsHtml;
    canvas.appendChild(el);
    
    // Guardar cambios al escribir en notas o texto
    if (type === 'note' || type === 'text') {
        el.querySelector('textarea').addEventListener('input', (e) => {
            saveLayoutPositions(); // Guardar el texto
        });
    }
}

/**
 * Guarda la posición, tamaño y texto de todas las formas en el lienzo actual.
 */
function saveLayoutPositions() {
    const currentPageLayout = {};
    document.querySelectorAll('#layout-canvas .layout-on-canvas').forEach(el => {
        const id = el.dataset.id;
        const x = parseFloat(el.dataset.x) || 0;
        const y = parseFloat(el.dataset.y) || 0;
        const width = parseFloat(el.style.width) || (el.classList.contains('tool-shape') ? 50 : (el.classList.contains('tool-text') ? 150 : (el.classList.contains('tool-note') ? 200 : (el.classList.contains('tool-image') ? 300 : 180))));
        const height = parseFloat(el.style.height) || (el.classList.contains('tool-shape') ? 50 : (el.classList.contains('tool-text') ? 40 : (el.classList.contains('tool-note') ? 100 : (el.classList.contains('tool-image') ? 200 : 60))));
        const type = el.dataset.type;
        const rotation = parseFloat(el.dataset.rotation) || 0;
        
        const itemData = { x, y, width, height, type, rotation };

        if (type === 'note' || type === 'text') {
            itemData.text = el.querySelector('textarea').value;
        }
        
        if (type === 'image') {
            itemData.imageId = state.layoutImages[id];
        }
        
        if (type === 'location') {
            itemData.areaId = el.dataset.areaId;
        }
        
        currentPageLayout[id] = itemData;
    });
    state.mapLayout[state.currentLayoutPage] = currentPageLayout;
    logActivity('Croquis guardado', `Se guardó la página ${state.currentLayoutPage} con ${Object.keys(currentPageLayout).length} elementos.`);
}

/**
 * Genera el HTML para la impresión del croquis (multi-página).
 */
async function printLayout() {
    logActivity('Impresión de Croquis', 'Generando impresión de croquis...');

    document.querySelectorAll('.print-page.layout-clone').forEach(el => el.remove());
    document.querySelectorAll('.print-page').forEach(page => page.classList.remove('active'));

    const masterTemplate = elements.printTemplates.layout;
    
    // Llenar lista de usuarios (solo en la primera página)
    const userListContainer = masterTemplate.querySelector('#print-layout-user-list');
    const usersByArea = state.resguardantes.reduce((acc, user) => {
        const areaKey = user.area || 'Sin Área';
        if (!acc[areaKey]) acc[areaKey] = [];
        acc[areaKey].push(user);
        return acc;
    }, {});
    const sortedAreas = Object.keys(usersByArea).sort();
    let userHtml = '<h2>Listado de Usuarios por Área</h2>';
    for (const area of sortedAreas) {
        const areaName = state.areaNames[area] || `Área ${area}`;
        userHtml += `<h3>${areaName}</h3><ul>`;
        userHtml += usersByArea[area]
            .map(user => `<li><strong>${user.name}</strong> (${user.locationWithId})</li>`)
            .join('');
        userHtml += '</ul>';
    }
    userListContainer.innerHTML = userHtml;

    const allPageKeys = Object.keys(state.layoutPageNames);

    for (let index = 0; index < allPageKeys.length; index++) {
        const pageKey = allPageKeys[index];
        const isFirstPage = index === 0;
        const pageTemplate = isFirstPage ? masterTemplate : masterTemplate.cloneNode(true);
        
        if (!isFirstPage) {
            pageTemplate.id = `print-layout-page-${index}`;
            pageTemplate.classList.add('layout-clone');
            pageTemplate.querySelector('#print-layout-user-list').innerHTML = ''; // Limpiar lista
            elements.printContainer.appendChild(pageTemplate);
        }
        
        const pageName = state.layoutPageNames[pageKey] || pageKey;
        pageTemplate.querySelector('#print-layout-page-number').textContent = `Página ${index + 1}: ${pageName}`;
        pageTemplate.querySelector('#print-layout-date').textContent = new Date().toLocaleDateString('es-MX');

        const printCanvasContainer = pageTemplate.querySelector('.print-layout-canvas-container');
        const printCanvas = pageTemplate.querySelector('#print-layout-canvas');
        printCanvas.innerHTML = '';
        
        printCanvasContainer.style.width = '720px';
        printCanvasContainer.style.height = '960px';
        printCanvas.style.width = '100%';
        printCanvas.style.height = '100%';
        
        const layoutData = state.mapLayout[pageKey] || {};
        let hasShapes = false;

        for (const id in layoutData) {
            if (layoutData.hasOwnProperty(id)) {
                hasShapes = true;
                const item = layoutData[id];
                const el = document.createElement('div');
                el.className = 'layout-shape';
                
                el.style.position = 'absolute';
                el.style.left = `${item.x}px`;
                el.style.top = `${item.y}px`;
                el.style.width = `${item.width}px`;
                el.style.height = `${item.height}px`;
                el.style.transform = `rotate(${item.rotation || 0}deg)`;
                el.style.transformOrigin = 'center center';
                el.style.fontSize = '0.8em';

                let innerHtml = '';
                let colorDotHtml = ''; 
                if (item.type === 'location') {
                    const user = state.resguardantes.find(u => u.locationWithId === id);
                    if (!user) continue;
                    const usersInLoc = state.resguardantes
                        .filter(u => u.locationWithId === id)
                        .map(u => `<li>${u.name} (Área ${u.area})</li>`)
                        .join('');
                    const iconClass = getLocationIcon(user.location);
                    const areaColor = getAreaColor(item.areaId || user.area);
                    colorDotHtml = `<div class="area-color-dot" style="background-color: ${areaColor}; border-color: #555;"></div>`;
                    innerHtml = `<h5><i class="${iconClass} location-icon"></i>${id}</h5><ul>${usersInLoc}</ul>`;
                } else if (item.type === 'tool') {
                    const toolIconClass = 'fa-solid fa-arrow-up'; 
                    el.classList.add('tool-shape');
                    innerHtml = `<i class="${toolIconClass} tool-icon"></i>`;
                } else if (item.type === 'note') {
                    el.classList.add('tool-note');
                    innerHtml = `<textarea class="layout-shape-note-textarea" readonly>${item.text || ''}</textarea>`;
                } else if (item.type === 'text') { 
                    el.classList.add('tool-text');
                    innerHtml = `<textarea class="layout-shape-text-textarea" readonly>${item.text || ''}</textarea>`;
                } else if (item.type === 'image' && item.imageId) {
                    el.classList.add('tool-image');
                    try {
                        const blob = await photoDB.getItem('layoutImages', item.imageId);
                        if(blob) {
                            const dataUrl = await blobToBase64(blob);
                            el.style.backgroundImage = `url(${dataUrl})`;
                        }
                    } catch(e) { console.error('Error al cargar imagen para impresión', e); }
                }
                
                el.innerHTML = colorDotHtml + innerHtml; 
                printCanvas.appendChild(el); 
            }
        }
        
        if (!hasShapes) {
            printCanvas.innerHTML = '<p style="text-align:center; padding-top: 40px; color: #888;">Página vacía</p>';
        }
        
        pageTemplate.classList.add('active'); 
    }
    
    preparePrint('print-layout-view'); // Llama a la función de impresión
}

/**
 * Resetea el lienzo actual, eliminando todas las formas.
 */
function resetCurrentLayoutPage() {
    if (state.readOnlyMode) return;
    showConfirmationModal('Restablecer Lienzo', `¿Seguro que quieres eliminar todos los elementos de la página "${state.layoutPageNames[state.currentLayoutPage]}"?`, () => {
        state.mapLayout[state.currentLayoutPage] = {};
        elements.layoutEditor.canvas.innerHTML = '';
        populateLayoutSidebar();
        saveState();
        showToast('Lienzo restablecido.');
        logActivity('Croquis', `Lienzo de la página ${state.currentLayoutPage} restablecido.`);
    });
}

/**
 * Configura todos los listeners de `interact.js` para el editor.
 */
export function initializeLayoutEditor() {
    
    // 1. Mover y Redimensionar formas DENTRO del lienzo
    interact('.layout-on-canvas')
        .draggable({
            listeners: {
                move(event) {
                    if(state.readOnlyMode) return;
                    const target = event.target;
                    const x = (parseFloat(target.dataset.x) || 0) + event.dx;
                    const y = (parseFloat(target.dataset.y) || 0) + event.dy;
                    const rotation = (parseFloat(target.dataset.rotation) || 0);

                    target.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                    target.dataset.x = x;
                    target.dataset.y = y;
                }
            },
            modifiers: [
                interact.modifiers.snap({ targets: [ interact.snappers.grid({ x: 10, y: 10 }) ], range: Infinity, relativePoints: [ { x: 0, y: 0 } ] }),
                interact.modifiers.restrictRect({ restriction: 'parent' }) // Mantener dentro del canvas
            ],
            inertia: false
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move (event) {
                    if(state.readOnlyMode) return;
                    let target = event.target;
                    let x = (parseFloat(target.dataset.x) || 0);
                    let y = (parseFloat(target.dataset.y) || 0);
                    const rotation = (parseFloat(target.dataset.rotation) || 0);

                    target.style.width = event.rect.width + 'px';
                    target.style.height = event.rect.height + 'px';
                    x += event.deltaRect.left;
                    y += event.deltaRect.top;

                    target.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                    target.dataset.x = x;
                    target.dataset.y = y;
                }
            },
            modifiers: [
                interact.modifiers.snap({ targets: [ interact.snappers.grid({ x: 10, y: 10 }) ], range: Infinity }),
                interact.modifiers.restrictSize({ min: { width: 50, height: 50 } })
            ],
            inertia: false
        });

    // 2. Arrastrar DESDE la sidebar (ubicaciones) AL lienzo
    interact('.draggable-item').draggable({
        listeners: { move: dragMoveListener },
        inertia: true
    });

    // 3. Arrastrar DESDE la barra de herramientas (formas) AL lienzo
    interact('.draggable-tool').draggable({
        listeners: { move: dragMoveListener },
        inertia: true
    });

    // 4. Definir el lienzo como zona para "soltar"
    interact('#layout-canvas').dropzone({
        accept: '.draggable-item, .draggable-tool',
        ondrop: function(event) {
            if(state.readOnlyMode) return;
            const draggableElement = event.relatedTarget;
            
            const canvasWrapperRect = elements.layoutEditor.canvasWrapper.getBoundingClientRect();
            const canvasRect = elements.layoutEditor.canvas.getBoundingClientRect();
            
            // Calcular X/Y relativo al *canvas*, no al wrapper
            const x = (event.client.x - canvasRect.left) + elements.layoutEditor.canvasWrapper.scrollLeft;
            const y = (event.client.y - canvasRect.top) + elements.layoutEditor.canvasWrapper.scrollTop;

            // Restringir a los bordes del canvas
            const snappedX = Math.round(Math.max(0, Math.min(x, canvasRect.width - 50)) / 10) * 10;
            const snappedY = Math.round(Math.max(0, Math.min(y, canvasRect.height - 50)) / 10) * 10;
            
            if (draggableElement.classList.contains('draggable-item')) {
                const locId = draggableElement.dataset.locationId;
                const areaId = draggableElement.dataset.areaId;
                createShapeOnCanvas(locId, snappedX, snappedY, null, null, 'location', '', null, 0, areaId);
                draggableElement.classList.add('hidden');
            } 
            else if (draggableElement.classList.contains('draggable-tool')) {
                const toolType = draggableElement.dataset.toolType;
                const toolId = `${toolType}-${Date.now()}`;
                
                if (toolType === 'note') createShapeOnCanvas(toolId, snappedX, snappedY, 200, 100, 'note');
                else if (toolType === 'arrow') createShapeOnCanvas(toolId, snappedX, snappedY, 50, 50, 'tool');
                else if (toolType === 'text') createShapeOnCanvas(toolId, snappedX, snappedY, 150, 40, 'text');
            }
            
            draggableElement.style.transform = 'none'; // Resetear original
            draggableElement.dataset.x = 0;
            draggableElement.dataset.y = 0;
            saveLayoutPositions(); // Guardar al soltar
        }
    });

    // 5. Lógica de Rotación
    interact('.layout-rotate-handle').draggable({
        onmove: (event) => {
            if(state.readOnlyMode) return;
            
            const handle = event.target;
            const shape = handle.closest('.layout-on-canvas');
            if (!shape) return;

            const rect = shape.getBoundingClientRect();
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
            let rotation = Math.round(angle + 90);
            rotation = Math.round(rotation / 15) * 15; // Snap a 15 grados

            const x = parseFloat(shape.dataset.x) || 0;
            const y = parseFloat(shape.dataset.y) || 0;

            shape.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
            shape.dataset.rotation = rotation;
        },
        onend: (event) => {
            if(state.readOnlyMode) return;
            saveLayoutPositions();
            saveState();
        }
    });

    // --- Listeners de botones del editor ---
    elements.layoutEditor.openBtn.addEventListener('click', () => {
        if(state.readOnlyMode) return showToast('Modo de solo lectura: no se puede editar el croquis.', 'warning');
        switchLayoutPage(state.currentLayoutPage || 'page1');
        elements.layoutEditor.modal.classList.add('show');
    });
    
    elements.layoutEditor.saveBtn.addEventListener('click', () => {
        if(state.readOnlyMode) return;
        saveLayoutPositions();
        saveState();
        showToast('Croquis guardado con éxito.');
    });

    elements.layoutEditor.printBtn.addEventListener('click', printLayout);
    elements.layoutEditor.pageAdd.addEventListener('click', () => {
        const newPageKey = `page${Date.now()}`;
        const newPageName = `Página ${Object.keys(state.layoutPageNames).length + 1}`;
        state.mapLayout[newPageKey] = {};
        state.layoutPageNames[newPageKey] = newPageName;
        switchLayoutPage(newPageKey);
        saveState();
    });

    elements.layoutEditor.pageRemove.addEventListener('click', () => {
        const pageKeys = Object.keys(state.layoutPageNames);
        if (pageKeys.length <= 1) return showToast('No se puede eliminar la última página.', 'warning');
        
        showConfirmationModal('Eliminar Página', `¿Seguro que quieres eliminar la "${state.layoutPageNames[state.currentLayoutPage]}"?`, () => {
            delete state.mapLayout[state.currentLayoutPage];
            delete state.layoutPageNames[state.currentLayoutPage];
            const newPageKeys = Object.keys(state.layoutPageNames);
            switchLayoutPage(newPageKeys[0]);
            saveState();
        });
    });

    elements.layoutEditor.pageReset.addEventListener('click', resetCurrentLayoutPage);

    elements.layoutEditor.pagePrev.addEventListener('click', () => {
        const pageKeys = Object.keys(state.layoutPageNames);
        const currentIndex = pageKeys.indexOf(state.currentLayoutPage);
        if (currentIndex > 0) switchLayoutPage(pageKeys[currentIndex - 1]);
    });

    elements.layoutEditor.pageNext.addEventListener('click', () => {
        const pageKeys = Object.keys(state.layoutPageNames);
        const currentIndex = pageKeys.indexOf(state.currentLayoutPage);
        if (currentIndex < pageKeys.length - 1) switchLayoutPage(pageKeys[currentIndex + 1]);
    });

    elements.layoutEditor.pageName.addEventListener('change', (e) => {
        const newName = e.target.value.trim();
        if (newName) {
            state.layoutPageNames[state.currentLayoutPage] = newName;
            saveState();
            showToast('Nombre de página actualizado.');
        }
    });

    // --- Listeners de Carga y Borrado de Imágenes ---
    elements.layoutEditor.addImageBtn.addEventListener('click', () => {
        if(state.readOnlyMode) return;
        elements.layoutEditor.imageInput.click();
    });

    elements.layoutEditor.imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target.result;
            const imageId = `img_${Date.now()}`;
            const shapeId = `image-${imageId}`;
            
            try {
                await photoDB.setItem('layoutImages', imageId, file);
                state.layoutImages[shapeId] = imageId;
                createShapeOnCanvas(shapeId, 20, 20, 300, 200, 'image', '', dataUrl, 0);
                saveLayoutPositions();
                saveState();
            } catch (err) {
                console.error('Error al guardar la imagen del croquis:', err);
                showToast('Error al guardar la imagen.', 'error');
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Limpiar input
    });

    // Listener para borrar formas (en el canvas)
    elements.layoutEditor.canvas.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.layout-delete-btn');
        if (!deleteBtn || state.readOnlyMode) return;

        const shape = deleteBtn.closest('.layout-on-canvas');
        if (!shape) return;

        const id = shape.dataset.id;
        const type = shape.dataset.type;
        shape.remove(); // Quitar del DOM

        if (type === 'location') {
            const sidebarItem = document.querySelector(`.draggable-item[data-location-id="${id}"]`);
            if (sidebarItem) {
                sidebarItem.classList.remove('hidden');
            }
        }
        
        if (type === 'image') {
            const imageId = state.layoutImages[id];
            if (imageId) {
                photoDB.deleteItem('layoutImages', imageId); // Borrar de DB
                delete state.layoutImages[id]; // Borrar de estado
            }
        }
        
        saveLayoutPositions();
        saveState();
        showToast('Elemento eliminado del croquis.');
    });

    // Listener para añadir desde la sidebar (clic)
    elements.layoutEditor.sidebar.addEventListener('click', (e) => {
        const item = e.target.closest('.draggable-item');
        if (!item || state.readOnlyMode) return;
        
        const x = (elements.layoutEditor.canvasWrapper.scrollLeft + elements.layoutEditor.canvasWrapper.clientWidth / 2) - 90;
        const y = (elements.layoutEditor.canvasWrapper.scrollTop + elements.layoutEditor.canvasWrapper.clientHeight / 2) - 30;
        const snappedX = Math.round(x / 10) * 10;
        const snappedY = Math.round(y / 10) * 10;
        
        const locId = item.dataset.locationId;
        const areaId = item.dataset.areaId;
        createShapeOnCanvas(locId, snappedX, snappedY, null, null, 'location', '', null, 0, areaId);
        item.classList.add('hidden');
        
        saveLayoutPositions();
        showToast(`Ubicación ${locId} añadida al lienzo.`);
    });
}