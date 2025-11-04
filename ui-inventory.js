import elements from './elements.js';
import state, { saveState, updateSerialNumberCache } from './state.js';
import { itemsPerPage } from './constants.js';
import { logActivity } from './logger.js';
import { showToast, showConfirmationModal, highlightText } from './utils.js';
// Necesitaremos estas funciones de UI-Modals y UI-Render, pero las importaremos en main.js
// y las pasaremos o las llamaremos desde funciones que sí las importan.
// Por ahora, nos centramos en la lógica interna del inventario.

// Variables locales del módulo para la paginación y filtrado
let currentPage = 1;
let filteredItems = [];

/**
 * Crea el elemento TR para un item del inventario.
 * @param {object} item - El objeto del item del inventario.
 * @returns {HTMLTableRowElement} - El elemento <tr> construido.
 */
function createInventoryRowElement(item) {
    const searchTerm = elements.inventory.searchInput.value.trim();
    const clave = item['CLAVE UNICA'] || '';
    const descripcion = item['DESCRIPCION'] || '';
    const marca = item['MARCA'] || '';
    const modelo = item['MODELO'] || '';
    const serie = item['SERIE'] || '';
    const usuario = item['NOMBRE DE USUARIO'] || '';

    const row = document.createElement('tr');
    let rowClasses = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer';
    if (state.notes[clave]) rowClasses += ' has-note';
    if (item.UBICADO === 'SI') rowClasses += ' item-located';
    row.className = rowClasses;
    row.dataset.clave = clave;
    
    const mismatchTag = item.areaIncorrecta ? `<span class="mismatched-area-tag" title="Ubicado en el área de otro listado">⚠️</span>` : '';
    
    const userData = state.resguardantes.find(u => u.name === usuario);
    const userDetails = userData 
        ? `${userData.name}\nÁrea: ${userData.area}\nUbicación: ${userData.locationWithId}` 
        : usuario;
    
    const truncate = (str, len) => (str && String(str).length > len ? String(str).substring(0, len) + '...' : str || '');

    row.innerHTML = `
        <td class="px-2 py-2"><input type="checkbox" class="inventory-item-checkbox rounded"></td>
        <td class="px-2 py-2 text-sm" title="${clave}">${highlightText(truncate(clave, 8), searchTerm)}</td>
        <td class="px-2 py-2 text-sm" title="${descripcion}">
            ${highlightText(truncate(descripcion, 30), searchTerm)}
            ${mismatchTag}
        </td>
        <td class="px-2 py-2 text-sm" title="${marca}">${highlightText(truncate(marca, 15), searchTerm)}</td>
        <td class="px-2 py-2 text-sm" title="${modelo}">${highlightText(truncate(modelo, 15), searchTerm)}</td>
        <td class="px-2 py-2 text-sm" title="${serie}">${highlightText(truncate(serie, 20), searchTerm)}</td>
        <td class="px-2 py-2 text-sm" title="${userDetails}">
             ${highlightText(truncate(usuario, 20), searchTerm)}
        </td>
        <td class="px-2 py-2 text-sm">${item['UBICADO']}</td><td class="px-2 py-2 text-sm">${item['IMPRIMIR ETIQUETA']}</td>
        <td class="px-2 py-2 text-center">
            <div class="flex items-center justify-center space-x-3">
                <i class="fa-solid fa-note-sticky text-xl ${state.notes[clave] ? 'text-yellow-500' : 'text-gray-400'} note-icon cursor-pointer" title="Añadir/Ver Nota"></i>
                <i class="fa-solid fa-camera text-xl ${state.photos[clave] ? 'text-indigo-500' : 'text-gray-400'} camera-icon cursor-pointer" title="Añadir/Ver Foto"></i>
                <i class="fa-solid fa-circle-info text-xl text-gray-400 hover:text-blue-500 md:hidden view-details-btn cursor-pointer" title="Ver Detalles"></i>
                <i class="fa-solid fa-qrcode text-xl text-gray-400 hover:text-indigo-500 view-qr-btn cursor-pointer" title="Ver Código QR"></i>
            </div>
        </td>`;
    
    return row;
}

/**
 * Renderiza la tabla de inventario (la página actual) en el DOM.
 */
export function renderInventoryTable() {
    const { tableBody, pageInfo, prevPageBtn, nextPageBtn } = elements.inventory;
    const fragment = document.createDocumentFragment();

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToRender = filteredItems.slice(start, end);

    if (itemsToRender.length === 0) {
        const emptyRow = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 12;
        cell.className = 'text-center py-4 text-gray-500';
        cell.textContent = 'No se encontraron bienes con los filtros actuales.';
        emptyRow.appendChild(cell);
        fragment.appendChild(emptyRow);
    } else {
        itemsToRender.forEach(item => {
            const rowElement = createInventoryRowElement(item);
            fragment.appendChild(rowElement);
        });
    }
    
    tableBody.innerHTML = '';
    tableBody.appendChild(fragment);

    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

/**
 * Filtra el inventario basado en los inputs y renderiza la tabla.
 * También maneja la búsqueda en bienes adicionales.
 * @param {object} options - Opciones, como showItemDetailView.
 * @param {Function} options.showItemDetailView - Callback para mostrar el modal de detalles.
 */
export function filterAndRenderInventory(options = {}) {
    const { showItemDetailView } = options;
    const searchTerm = elements.inventory.searchInput.value.trim().toLowerCase();
    const statusFilter = elements.inventory.statusFilter.value;
    const areaFilter = elements.inventory.areaFilter.value;
    const bookTypeFilter = elements.inventory.bookTypeFilter.value;

    filteredItems = state.inventory.filter(item =>
        (!searchTerm || [item['CLAVE UNICA'], item['DESCRIPCION'], item['MARCA'], item['MODELO'], item['SERIE']].some(f => String(f||'').toLowerCase().includes(searchTerm))) &&
        (statusFilter === 'all' || item.UBICADO === statusFilter) &&
        (areaFilter === 'all' || item.areaOriginal === areaFilter) &&
        (bookTypeFilter === 'all' || item.listadoOriginal === bookTypeFilter)
    );
    
    renderInventoryTable();

    // Si la búsqueda es una clave única exacta y solo hay un resultado, abrir detalles
    if (searchTerm && filteredItems.length === 1 && String(filteredItems[0]['CLAVE UNICA']).toLowerCase() === searchTerm) {
        if (showItemDetailView) {
            showItemDetailView(filteredItems[0]['CLAVE UNICA']);
        }
    }

    // --- Lógica de Búsqueda en Adicionales ---
    const additionalResultsContainer = document.getElementById('additional-search-results-container');
    const additionalResultsList = document.getElementById('additional-search-results-list');

    if (!searchTerm) {
        additionalResultsContainer.classList.add('hidden');
        return;
    }

    const additionalMatches = state.additionalItems.filter(item =>
        (item.clave && String(item.clave).toLowerCase().includes(searchTerm)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm)) ||
        (item.marca && item.marca.toLowerCase().includes(searchTerm)) ||
        (item.modelo && item.modelo.toLowerCase().includes(searchTerm)) ||
        (item.serie && String(item.serie).toLowerCase().includes(searchTerm)) ||
        (item.claveAsignada && String(item.claveAsignada).toLowerCase().includes(searchTerm))
    );

    if (additionalMatches.length > 0) {
        additionalResultsList.innerHTML = additionalMatches.map(item => {
            const isPersonal = item.personal === 'Si';
            const itemClass = isPersonal ? 'personal-item' : 'additional-item';
            return `
                <div class="flex items-center justify-between p-3 rounded-lg shadow-sm border-l-4 ${itemClass}">
                    <div>
                        <p class="font-semibold">${item.descripcion}</p>
                        <p class="text-sm opacity-80">Clave: ${item.clave || 'N/A'}, Serie: ${item.serie || 'N/A'}, Clave Asignada: ${item.claveAsignada || 'N/A'}</p>
                        <p class="text-xs opacity-70 mt-1">Asignado a: <strong>${item.usuario}</strong></p>
                    </div>
                    <i class="fa-solid fa-star text-purple-400" title="Bien Adicional"></i>
                </div>
            `;
        }).join('');
        additionalResultsContainer.classList.remove('hidden');
    } else {
        additionalResultsContainer.classList.add('hidden');
    }
}

/**
 * Asigna un item a un usuario y maneja la lógica de completitud.
 * @param {object} item - El item del inventario.
 * @param {object} user - El usuario resguardante.
 * @param {object} callbacks - Funciones callback.
 * @param {Function} callbacks.checkAreaCompletion - Callback.
 * @param {Function} callbacks.checkInventoryCompletion - Callback.
 */
function assignItem(item, user, callbacks) {
    item.UBICADO = 'SI';
    item['NOMBRE DE USUARIO'] = user.name;
    item.fechaUbicado = new Date().toISOString();
    item.areaIncorrecta = item.areaOriginal !== user.area;

    callbacks.checkAreaCompletion(item.areaOriginal);
    callbacks.checkInventoryCompletion();
}

/**
 * Maneja las acciones de los botones (Ubicar, Re-etiquetar, Des-ubicar).
 * @param {'ubicar' | 're-etiquetar' | 'desubicar'} action - La acción a realizar.
 * @param {object} callbacks - Funciones callback.
 * @param {Function} callbacks.checkAreaCompletion - Callback.
 * @param {Function} callbacks.checkInventoryCompletion - Callback.
 * @param {Function} callbacks.renderDashboard - Callback.
 */
export function handleInventoryActions(action, callbacks) {
    if (state.readOnlyMode) return showToast('Modo de solo lectura: no se pueden realizar acciones.', 'warning');
    
    const selectedClaves = Array.from(document.querySelectorAll('.inventory-item-checkbox:checked'))
        .map(cb => cb.closest('tr').dataset.clave);
    
    if (selectedClaves.length === 0) return showToast('Seleccione al menos un bien.', 'error');
    
    // --- Acción de Des-ubicar ---
    if (action === 'desubicar') {
        showConfirmationModal('Des-ubicar Bienes', `¿Estás seguro de que quieres marcar ${selectedClaves.length} bien(es) como NO ubicados? Esto eliminará la asignación de usuario.`, () => {
            selectedClaves.forEach(clave => {
                const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
                if (item) {
                    item.UBICADO = 'NO';
                    item['NOMBRE DE USUARIO'] = '';
                    item['IMPRIMIR ETIQUETA'] = 'NO';
                    item.fechaUbicado = null;
                    item.areaIncorrecta = false;
                    logActivity('Bien des-ubicado', `Clave: ${clave}`);
                    callbacks.checkAreaCompletion(item.areaOriginal); 
                }
            });
            showToast(`${selectedClaves.length} bien(es) marcado(s) como NO ubicado(s).`);
            filterAndRenderInventory(); // Re-renderizar tabla
            callbacks.renderDashboard(); // Actualizar dashboard
            saveState();
        });
        return;
    }

    // --- Acciones de Ubicar y Re-etiquetar ---
    if (!state.activeResguardante) {
        return showToast('Debe activar un usuario para poder ubicar o re-etiquetar bienes.', 'error');
    }
    
    const activeUser = state.activeResguardante;
    const { searchInput } = elements.inventory;
    let requiresConfirmation = false;

    selectedClaves.forEach(clave => {
        const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
        if (!item) return;

        const isAssignedToOther = item.UBICADO === 'SI' && item['NOMBRE DE USUARIO'] && item['NOMBRE DE USUARIO'] !== activeUser.name;
        
        const processItem = () => {
            assignItem(item, activeUser, callbacks); // Asigna y revisa completitud
            
            if (action === 're-etiquetar') {
                item['IMPRIMIR ETIQUETA'] = 'SI';
                logActivity('Bien marcado para re-etiquetar', `Clave: ${clave}, Usuario: ${activeUser.name}`);
            } else if (action === 'ubicar') {
                if (item['IMPRIMIR ETIQUETA'] === 'SI') {
                    item['IMPRIMIR ETIQUETA'] = 'NO';
                    logActivity('Marca de re-etiquetar quitada al ubicar', `Clave: ${clave}, Usuario: ${activeUser.name}`);
                } else {
                    logActivity('Bien ubicado', `Clave: ${clave}, Usuario: ${activeUser.name}`);
                }
            }
        };

        if (isAssignedToOther) {
            requiresConfirmation = true;
            showConfirmationModal('Reasignar Bien', `El bien ${clave} ya está asignado a ${item['NOMBRE DE USUARIO']}. ¿Deseas reasignarlo a ${activeUser.name}?`, () => {
                logActivity('Bien reasignado', `Clave: ${clave} de ${item['NOMBRE DE USUARIO']} a ${activeUser.name}`);
                processItem();
                showToast(`Bien ${clave} reasignado a ${activeUser.name}.`);
                filterAndRenderInventory(); 
                callbacks.renderDashboard(); 
                saveState();
            });
        } else {
            processItem(); // Procesar directamente si no hay conflicto
        }
    });

    if (!requiresConfirmation) {
         const message = action === 'ubicar' ? `Se ubicaron ${selectedClaves.length} bienes.` : `Se marcaron ${selectedClaves.length} bienes para re-etiquetar y fueron ubicados.`;
         showToast(message);
         searchInput.value = '';
         searchInput.focus();
         filterAndRenderInventory(); 
         callbacks.renderDashboard(); 
         saveState();
    } else {
        showToast(`Algunos bienes requerían confirmación para reasignar.`);
        document.querySelectorAll('.inventory-item-checkbox:checked').forEach(cb => cb.checked = false);
    }
}

/**
 * Cambia la página actual de la tabla de inventario.
 * @param {'prev' | 'next'} direction - La dirección a la que cambiar.
 */
export function changeInventoryPage(direction) {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    } else if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
    }
    renderInventoryTable();
}

/**
 * Limpia los filtros y la búsqueda de la tabla de inventario.
 */
export function clearInventorySearch() {
    elements.inventory.searchInput.value = '';
    elements.inventory.statusFilter.value = 'all';
    elements.inventory.areaFilter.value = 'all';
    elements.inventory.bookTypeFilter.value = 'all';
    currentPage = 1;
    filterAndRenderInventory();
    elements.inventory.searchInput.focus();
}

/**
 * Establece la página actual de inventario.
 * @param {number} page - El número de página.
 */
export function setInventoryPage(page) {
    currentPage = page;
}