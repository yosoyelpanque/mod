import elements from './elements.js';
import state from './state.js';
import { logActivity } from './logger.js';
// (Las funciones de renderizado de tablas/filtros se importarán cuando se necesiten)

/**
 * Actualiza el dashboard principal con las estadísticas del estado.
 */
export function renderDashboard() {
    const totalItems = state.inventory.length;
    const locatedItems = state.inventory.filter(item => item.UBICADO === 'SI').length;
    const todayStr = new Date().toISOString().slice(0, 10);
    
    const dailyInventoryProgress = state.inventory.filter(item => item.fechaUbicado && item.fechaUbicado.startsWith(todayStr)).length;
    const dailyAdditionalProgress = state.additionalItems.filter(item => item.fechaRegistro && item.fechaRegistro.startsWith(todayStr)).length;
    const dailyTotal = dailyInventoryProgress + dailyAdditionalProgress;

    elements.totalItemsEl.textContent = totalItems;
    elements.locatedItemsEl.textContent = locatedItems;
    elements.pendingItemsEl.textContent = totalItems - locatedItems;
    elements.dailyProgressEl.textContent = dailyTotal;
    elements.workingAreasCountEl.textContent = new Set(state.inventory.map(item => item.areaOriginal)).size;
    elements.additionalItemsCountEl.textContent = state.additionalItems.length;
}

/**
 * Renderiza las barras de progreso para cada área en la pestaña de Reportes.
 */
export function renderAreaProgress() {
    const container = elements.reports.areaProgressContainer;
    if (!container) return;

    container.innerHTML = '';
    const areas = [...new Set(state.inventory.map(i => i.areaOriginal))].sort();

    if (areas.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 dark:text-slate-400">No hay áreas cargadas.</p>';
        return;
    }

    let progressHtml = '';
    areas.forEach(area => {
        const areaItems = state.inventory.filter(i => i.areaOriginal === area);
        const total = areaItems.length;
        if (total === 0) return;
        
        const located = areaItems.filter(i => i.UBICADO === 'SI').length;
        const percent = Math.round((located / total) * 100);
        const areaName = state.areaNames[area] || `Área ${area}`;
        
        const barColor = percent === 100 ? 'bg-green-500' : 'bg-blue-600';

        progressHtml += `
            <div>
                <div class="flex justify-between mb-1">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-300">${areaName}</span>
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-300">${located} / ${total} (${percent}%)</span>
                </div>
                <div class="progress-bar-container">
                    <div class="${barColor} h-2.5 rounded-full" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    });
    container.innerHTML = progressHtml;
}

/**
 * Muestra u oculta el banner de usuario activo en la parte superior.
 */
export function updateActiveUserBanner() {
    const { banner, name, area } = elements.activeUserBanner;
    const tabsToShowOn = ['users', 'inventory', 'adicionales'];
    
    // Obtenemos la pestaña activa
    const currentTab = document.querySelector('.tab-btn.active')?.dataset.tab;

    if (state.activeResguardante && tabsToShowOn.includes(currentTab)) {
        name.textContent = state.activeResguardante.name;
        const areaName = state.areaNames[state.activeResguardante.area] || `Área ${state.activeResguardante.area}`;
        area.textContent = `Área: ${areaName}`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

/**
 * Renderiza la lista de usuarios en la pestaña de Usuarios.
 */
export function renderUserList() {
    const list = elements.userForm.list;
    const searchInput = document.getElementById('user-search-input');
    const userCountBadge = document.getElementById('user-count-badge');
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredUsers = state.resguardantes.filter(user => {
        if (!searchTerm) return true;
        return (
            user.name.toLowerCase().includes(searchTerm) ||
            user.locationWithId.toLowerCase().includes(searchTerm) ||
            String(user.area).toLowerCase().includes(searchTerm)
        );
    });
    
    if (userCountBadge) {
        userCountBadge.textContent = `${filteredUsers.length} de ${state.resguardantes.length} Total`;
    }

    list.innerHTML = filteredUsers.length === 0 
        ? `<p class="text-gray-500">No se encontraron usuarios.</p>` 
        : '';
        
    filteredUsers.forEach((user) => {
        const originalIndex = state.resguardantes.findIndex(u => u.id === user.id);
        const isActive = state.activeResguardante?.id === user.id;
        const item = document.createElement('div');
        
        item.className = `flex items-center justify-between p-2 rounded-lg shadow-sm transition-colors cursor-pointer ${isActive ? 'active-user border-l-4 border-green-500' : 'non-active-user'}`;
        item.dataset.userId = user.id;
        
        const hasLocationPhoto = state.locationPhotos && state.locationPhotos[user.locationWithId];
        const photoIconColor = hasLocationPhoto ? 'text-indigo-500' : 'text-gray-400';

        item.innerHTML = `
            <div class="flex-grow user-info-clickable" data-user-id="${user.id}">
               <p class="font-semibold">${user.name}</p>
               <p class="text-sm text-gray-500 dark:text-gray-400">${user.locationWithId} - Área ${user.area}</p>
            </div>
            <div class="space-x-2 flex items-center">
                <i class="fa-solid fa-camera text-xl ${photoIconColor} cursor-pointer location-photo-btn" data-location-id="${user.locationWithId}" title="Gestionar foto de la ubicación"></i>
                <button data-index="${originalIndex}" class="activate-user-btn px-3 py-1 rounded-lg text-xs font-bold transition-colors ${isActive ? 'text-white bg-green-600' : 'text-gray-700 bg-gray-200 hover:bg-gray-300'}">${isActive ? 'Activo' : 'Activar'}</button>
                <button data-index="${originalIndex}" class="edit-user-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600">Editar</button>
                <button data-index="${originalIndex}" class="delete-user-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600">Eliminar</button>
            </div>`;
        list.appendChild(item);
    });
}

/**
 * Renderiza la lista de bienes adicionales en su pestaña.
 */
export function renderAdicionalesList() {
    const listEl = elements.adicionales.list;
    const filterUser = elements.adicionales.userFilter.value;
    const filterArea = elements.adicionales.areaFilter.value;
    
    let filtered = state.additionalItems;

    if (filterArea && filterArea !== 'all') {
        const usersInArea = state.resguardantes
            .filter(user => user.area === filterArea)
            .map(user => user.name);
        filtered = filtered.filter(item => usersInArea.includes(item.usuario));
    }

    if (filterUser && filterUser !== 'all') {
        filtered = filtered.filter(item => item.usuario === filterUser);
    }
    
    elements.adicionales.total.textContent = `${filtered.length} de ${state.additionalItems.length} Total`;

    if (filtered.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500">No hay bienes adicionales con los filtros seleccionados.</p>';
        return;
    }

    listEl.innerHTML = filtered.map((item, index) => {
        const isPersonal = item.personal === 'Si';
        const itemClass = isPersonal ? 'personal-item' : 'additional-item';
        
        let personalTag = '';
        if (isPersonal) {
            if (item.tieneFormatoEntrada === true) {
                personalTag = `<span class="font-bold text-xs ml-2" title="Tiene formato de entrada"><i class="fa-solid fa-file-circle-check text-green-600"></i> (Personal)</span>`;
            } else if (item.tieneFormatoEntrada === false) {
                personalTag = `<span class="font-bold text-xs ml-2" title="No tiene formato de entrada"><i class="fa-solid fa-file-circle-exclamation text-amber-600"></i> (Personal)</span>`;
            } else {
                personalTag = `<span class="font-bold text-xs ml-2">(Personal)</span>`;
            }
        }

        const hasPhoto = state.additionalPhotos[item.id];

        return `<div data-id="${item.id}" class="adicional-item-clickable flex items-center justify-between p-3 rounded-lg shadow-sm border-l-4 ${itemClass} cursor-pointer">
            <div class="flex items-center" data-id="${item.id}">
                <span class="font-bold text-lg mr-3">${index + 1}.</span>
                <div>
                    <p class="font-semibold">${item.descripcion}${personalTag}</p>
                    <p class="text-sm opacity-80">Clave: ${item.clave || 'N/A'}, Marca: ${item.marca || 'N/A'}, Serie: ${item.serie || 'N/A'}</p>
                    <p class="text-sm opacity-70">Usuario: ${item.usuario}</p>
                </div>
            </div>
            <div class="space-x-2">
                <button data-id="${item.id}" class="adicional-photo-btn action-btn ${hasPhoto ? 'text-indigo-500' : ''}"><i class="fa-solid fa-camera"></i></button>
                <button data-id="${item.id}" class="edit-adicional-btn action-btn"><i class="fa-solid fa-pencil"></i></button>
                <button data-id="${item.id}" class="delete-adicional-btn action-btn"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`
    }).join('');
}

/**
 * Renderiza la lista de archivos cargados en la pestaña de Ajustes.
 */
export function renderLoadedLists() {
    const container = elements.settings.loadedListsContainer;
    const countEl = document.getElementById('loaded-lists-count');
    container.innerHTML = '';

    const loadedListsMap = new Map();
    state.inventory.forEach(item => {
        if (!loadedListsMap.has(item.listId)) {
            loadedListsMap.set(item.listId, {
                listId: item.listId,
                fileName: item.fileName,
                areaOriginal: item.areaOriginal,
                listadoOriginal: item.listadoOriginal
            });
        }
    });
    const loadedLists = Array.from(loadedListsMap.values());


    countEl.textContent = `Total: ${loadedLists.length}`;

    if (loadedLists.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No hay listados cargados.</p>';
        return;
    }

    loadedLists.forEach(list => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-slate-800';
        
        const areaId = list.areaOriginal;
        const isAreaCompleted = !!state.completedAreas[areaId];
        const isAreaClosed = !!state.closedAreas[areaId];
        let areaActionButtonHtml = '';

        if (isAreaClosed) {
            areaActionButtonHtml = `
                <button data-area-id="${areaId}" class="reprint-area-report-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-500 hover:bg-blue-600">Reimprimir Acta</button>
            `;
        } else if (isAreaCompleted) {
             areaActionButtonHtml = `
                <button data-area-id="${areaId}" class="generate-area-report-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-green-500 hover:bg-green-600">Generar Acta Cierre</button>
            `;
        }

        item.innerHTML = `
            <div class="flex-grow">
                <p class="font-semibold text-sm text-gray-500 dark:text-slate-400">Área: <span class="text-gray-900 dark:text-slate-100">${state.areaNames[list.areaOriginal] || list.areaOriginal}</span></p>
                <p class="font-semibold text-sm text-gray-500 dark:text-slate-400">Tipo de Libro: <span class="text-gray-900 dark:text-slate-100">${list.listadoOriginal}</span></p>
                <p class="font-semibold text-sm text-gray-500 dark:text-slate-400">Archivo: <span class="text-gray-700 dark:text-slate-300 italic">${list.fileName}</span></p>
            </div>
            <div class="flex flex-col space-y-2 items-end">
                ${areaActionButtonHtml} 
                <button data-list-id="${list.listId}" class="delete-list-btn px-3 py-1 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600">Eliminar Listado</button>
            </div>
        `;
        container.appendChild(item);
    });
}

/**
 * Renderiza el directorio de responsables de área en la pestaña de Ajustes.
 */
export function renderDirectory() {
    const container = elements.settings.directoryContainer;
    const countEl = elements.settings.directoryCount;
    const areas = Object.keys(state.areaDirectory);

    countEl.textContent = `Total: ${areas.length}`;
    
    if (areas.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No se han cargado áreas con información de responsable.</p>';
        return;
    }
    
    container.innerHTML = areas.sort().map((areaKey, index) => {
        const areaInfo = state.areaDirectory[areaKey];
        return `
            <div class="p-3 rounded-lg bg-white dark:bg-slate-800 text-gray-800 border-l-4 border-indigo-400 shadow-sm">
                <p class="font-bold text-sm text-gray-900 dark:text-slate-100">
                    ${index + 1}. ${areaInfo.fullName || `ÁREA ${areaKey}`}
                </p>
                <p class="text-sm mt-1 text-gray-700 dark:text-slate-300">
                    <strong>Responsable:</strong> ${areaInfo.name || 'No encontrado'}
                </p>
                 <p class="text-sm text-gray-700 dark:text-slate-300">
                    <strong>Cargo:</strong> ${areaInfo.title || 'No encontrado'}
                </p>
            </div>
        `;
    }).join('');
}

/**
 * Calcula y renderiza las estadísticas detalladas en la pestaña de Reportes.
 */
export function renderReportStats() {
    const stats = {};
    const groupBy = (arr, key) => arr.reduce((acc, item) => {
        (acc[item[key]] = acc[item[key]] || []).push(item);
        return acc;
    }, {});

    stats.pendingByArea = groupBy(state.inventory.filter(i => i.UBICADO === 'NO'), 'areaOriginal');
    stats.assignedByUser = groupBy(state.inventory.filter(i => i.UBICADO === 'SI'), 'NOMBRE DE USUARIO');
    const pendingLabels = state.inventory.filter(i => i['IMPRIMIR ETIQUETA'] === 'SI');
    stats.labelsByArea = groupBy(pendingLabels, 'areaOriginal');
    stats.labelsByUser = groupBy(pendingLabels, 'NOMBRE DE USUARIO');
    stats.additionalCount = state.additionalItems.length;
            
    let html = `<p class="font-bold">Bienes Adicionales Registrados: <span class="font-normal">${stats.additionalCount}</span></p><hr class="my-2 border-gray-300 dark:border-gray-600">`;

    const generateHtmlList = (title, data) => {
        let listHtml = `<div class="mb-2"><p class="font-bold">${title}</p>`;
        const entries = Object.entries(data);
        if (entries.length === 0) {
            listHtml += `<p class="text-gray-500 text-xs">No hay datos.</p></div>`;
            return listHtml;
        }
        listHtml += '<ul class="list-disc list-inside">';
        entries.forEach(([key, value]) => {
            listHtml += `<li><strong>${key || 'Sin Asignar'}:</strong> ${value.length}</li>`;
        });
        listHtml += '</ul></div>';
        return listHtml;
    };

    html += generateHtmlList('Bienes Asignados por Usuario:', stats.assignedByUser);
    html += '<hr class="my-2 border-gray-300 dark:border-gray-600">';
    html += generateHtmlList('Bienes Pendientes por Área:', stats.pendingByArea);
    html += '<hr class="my-2 border-gray-300 dark:border-gray-600">';
    html += generateHtmlList('Etiquetas Pendientes por Usuario:', stats.labelsByUser);
    html += '<hr class="my-2 border-gray-300 dark:border-gray-600">';
    html += generateHtmlList('Etiquetas Pendientes por Área:', stats.labelsByArea);

    elements.reports.stats.innerHTML = html;
}

/**
 * Rellena todos los menús desplegables de selección de área.
 */
export function populateAreaSelects() {
    const areasFromInventory = state.inventory.map(item => item.areaOriginal);
    const areasFromUsers = state.resguardantes.map(user => user.area);
    const persistentAreas = state.persistentAreas || [];
    state.areas = [...new Set([...areasFromInventory, ...areasFromUsers, ...persistentAreas])].filter(Boolean).sort();

    [elements.userForm.areaSelect, elements.reports.areaFilter, elements.inventory.areaFilter, elements.editUserAreaSelect, elements.adicionales.areaFilter].forEach(select => {
        if (!select) return; // Salvaguarda por si algún elemento no existe
        const selectedValue = select.value;
        const firstOpt = select.id.includes('user-area-select') ? '<option value="">Seleccione</option>' : '<option value="all">Todas</option>';
        
        select.innerHTML = firstOpt + state.areas.map(area => 
            `<option value="${area}" ${selectedValue === area ? 'selected' : ''}>${state.areaNames[area] || area}</option>`
        ).join('');
        
        if (selectedValue && !select.querySelector(`option[value="${selectedValue}"]`)) {
            select.value = select.id.includes('user-area-select') ? '' : 'all'; 
        }
    });
}

/**
 * Rellena los filtros de Área y Usuario en la pestaña de Reportes (con dependencia).
 */
export function populateReportFilters() {
    const areaSelect = elements.reports.areaFilter;
    const userSelect = elements.reports.userFilter;
    if (!areaSelect || !userSelect) return;
    
    const selectedArea = areaSelect.value;

    // 1. Poblar Áreas (ya se hace en populateAreaSelects, pero lo re-aseguramos aquí)
    populateAreaSelects();
    areaSelect.value = selectedArea; // Restaurar valor
    
    // 2. Filtrar usuarios basados en el área seleccionada
    let usersToList = state.resguardantes;
    if (selectedArea !== 'all') {
        usersToList = usersToList.filter(user => user.area === selectedArea);
    }

    const selectedUser = userSelect.value; // Guardar valor actual

    // 3. Poblar Usuarios
    userSelect.innerHTML = '<option value="all">Todos los usuarios</option>' +
        usersToList.sort((a,b) => a.name.localeCompare(b.name)).map(user => `<option value="${user.name}">${user.name}</option>`).join('');
    
    // 4. Restaurar valor de usuario
    if (usersToList.some(user => user.name === selectedUser)) {
        userSelect.value = selectedUser;
    } else {
        userSelect.value = 'all';
    }
}

/**
 * Rellena los filtros de Área y Usuario en la pestaña de Adicionales (con dependencia).
 */
export function populateAdicionalesFilters() {
    const areaSelect = elements.adicionales.areaFilter;
    const userSelect = elements.adicionales.userFilter;
    if (!areaSelect || !userSelect) return;
            
    const selectedArea = areaSelect.value;
    
    // 1. Poblar Áreas
    populateAreaSelects(); // Asegura que el filtro de área esté actualizado
    areaSelect.value = selectedArea; // Restaurar valor
    
    // 2. Filtrar usuarios basados en el área seleccionada
    let usersToList = state.resguardantes;
    if (selectedArea !== 'all') {
        usersToList = usersToList.filter(user => user.area === selectedArea);
    }

    const selectedUser = userSelect.value; // Guardar valor actual

    // 3. Poblar Usuarios
    userSelect.innerHTML = '<option value="all">Todos los usuarios</option>' +
        usersToList.sort((a,b) => a.name.localeCompare(b.name)).map(user => `<option value="${user.name}">${user.name}</option>`).join('');
    
    // 4. Restaurar valor de usuario
    if (usersToList.some(user => user.name === selectedUser)) {
        userSelect.value = selectedUser;
    } else {
        userSelect.value = 'all';
    }
}

/**
 * Rellena el filtro de "Tipo de Libro" en la pestaña de Inventario.
 */
export function populateBookTypeFilter() {
    const bookTypes = [...new Set(state.inventory.map(item => item.listadoOriginal))].filter(Boolean).sort();
    const select = elements.inventory.bookTypeFilter;
    const staticOptions = Array.from(select.querySelectorAll('option[value]:not([value="all"])')).map(opt => opt.value);
    const allTypes = [...new Set([...staticOptions, ...bookTypes])].sort();
    
    select.innerHTML = '<option value="all">Todos los tipos</option>' + 
        allTypes.map(type => `<option value="${type}">${type}</option>`).join('');
}

/**
 * Actualiza el tema (Claro/Oscuro) en el body.
 * @param {'light' | 'dark'} theme - El tema a aplicar.
 */
export function updateTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    state.theme = theme;
    logActivity('Ajustes', `Tema cambiado a ${theme}.`);
}