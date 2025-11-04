import elements from './elements.js';
import state from './state.js';
import { photoDB } from './db.js';

/**
 * Actualiza la foto en el modal de "Vista de Detalles del Bien".
 * @param {string} clave - La clave del bien.
 */
function updateDetailViewPhoto(clave) {
    const { detailView } = elements;
    
    detailView.photo.classList.add('hidden');
    detailView.noPhoto.classList.remove('hidden');
    detailView.photo.src = ''; 

    if (state.photos[clave]) {
        photoDB.getItem('photos', `inventory-${clave}`).then(imageBlob => {
            if (imageBlob) {
                const objectURL = URL.createObjectURL(imageBlob);
                detailView.photo.src = objectURL;
                // Revocar el object URL cuando la imagen se cargue (o falle)
                detailView.photo.onload = () => URL.revokeObjectURL(objectURL);
                detailView.photo.onerror = () => URL.revokeObjectURL(objectURL);
                detailView.photo.classList.remove('hidden');
                detailView.noPhoto.classList.add('hidden');
            }
        }).catch(() => {
            // Manejar error si la foto no se puede cargar
            detailView.photo.classList.add('hidden');
            detailView.noPhoto.classList.remove('hidden');
            detailView.photo.src = '';
        });
    }
}

/**
 * Muestra el modal de "Vista de Detalles del Bien".
 * @param {string} clave - La clave del bien a mostrar.
 * @param {object} callbacks - Objeto con funciones a ejecutar para los botones.
 * @param {Function} callbacks.onUbicar - Callback para el botón 'Ubicar'.
 * @param {Function} callbacks.onReetiquetar - Callback para 'Re-etiquetar'.
 * @param {Function} callbacks.onNota - Callback para 'Nota'.
 * @param {Function} callbacks.onFoto - Callback para 'Foto'.
 */
export function showItemDetailView(clave, callbacks = {}) {
    const item = state.inventory.find(i => i['CLAVE UNICA'] === clave);
    if (!item) return;

    const { detailView } = elements;
    const areaName = state.areaNames[item.areaOriginal] || `Área ${item.areaOriginal}`;

    detailView.clave.textContent = item['CLAVE UNICA'];
    detailView.descripcion.textContent = item['DESCRIPCION'] || 'N/A';
    detailView.marca.textContent = item['MARCA'] || 'N/A';
    detailView.modelo.textContent = item['MODELO'] || 'N/A';
    detailView.serie.textContent = item['SERIE'] || 'N/A';
    detailView.usuario.textContent = item['NOMBRE DE USUARIO'] || 'Sin Asignar';
    detailView.area.textContent = areaName;
    
    // Configurar advertencia de área
    const warningContainer = detailView.areaWarning;
    warningContainer.innerHTML = '';
    warningContainer.className = 'mt-3 p-3 rounded-lg text-sm hidden'; // Reset

    const activeUser = state.activeResguardante;
    if (activeUser && item.areaOriginal !== activeUser.area) {
        warningContainer.classList.remove('hidden');
        warningContainer.classList.add('bg-yellow-100', 'dark:bg-yellow-900/50', 'text-yellow-800', 'dark:text-yellow-200');
        warningContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i><strong>Aviso:</strong> Este bien pertenece al <strong>área ${item.areaOriginal}</strong>, pero el usuario activo está en el <strong>área ${activeUser.area}</strong>.`;
    } else if (!activeUser) {
        warningContainer.classList.remove('hidden');
        warningContainer.classList.add('bg-blue-100', 'dark:bg-blue-900/50', 'text-blue-800', 'dark:text-blue-200');
        warningContainer.innerHTML = `<i class="fa-solid fa-info-circle mr-2"></i>Para ubicar este bien, primero activa un usuario en la pestaña "Usuarios".`;
    }

    // Cargar foto
    updateDetailViewPhoto(clave);

    // Asignar handlers a los botones (los callbacks vienen de main.js)
    // Usamos .onclick para reemplazar handlers antiguos y evitar duplicados
    detailView.ubicarBtn.onclick = () => {
        if (callbacks.onUbicar) callbacks.onUbicar(clave);
        detailView.modal.classList.remove('show');
    };
    detailView.reetiquetarBtn.onclick = () => {
        if (callbacks.onReetiquetar) callbacks.onReetiquetar(clave);
        detailView.modal.classList.remove('show');
    };
    detailView.notaBtn.onclick = () => {
        if (callbacks.onNota) callbacks.onNota(clave);
        // No cerramos el modal, el modal de nota va encima
    };
    detailView.fotoBtn.onclick = () => {
        if (callbacks.onFoto) callbacks.onFoto(clave);
        // No cerramos el modal, el modal de foto va encima
    };

    detailView.modal.classList.add('show');
}

/**
 * Muestra el modal de "Vista de Detalles del Usuario".
 * @param {string} userId - El ID del usuario a mostrar.
 */
export function showUserDetailView(userId) {
    const user = state.resguardantes.find(u => u.id === userId);
    if (!user) return;

    const { modal, title, name, area, location, photo, noPhoto } = elements.userDetailView;
    
    title.textContent = 'Detalles del Usuario';
    name.textContent = user.name;
    area.textContent = state.areaNames[user.area] || `Área ${user.area}`;
    location.textContent = user.locationWithId;
    
    photo.classList.add('hidden');
    noPhoto.classList.remove('hidden');
    photo.src = '';

    if (state.locationPhotos[user.locationWithId]) {
        photoDB.getItem('photos', `location-${user.locationWithId}`).then(imageBlob => {
            if (imageBlob) {
                const objectURL = URL.createObjectURL(imageBlob);
                photo.src = objectURL;
                photo.onload = () => URL.revokeObjectURL(objectURL);
                photo.onerror = () => URL.revokeObjectURL(objectURL);
                photo.classList.remove('hidden');
                noPhoto.classList.add('hidden');
            }
        }).catch(() => {
            photo.classList.add('hidden');
            noPhoto.classList.remove('hidden');
            photo.src = '';
        });
    }

    modal.classList.add('show');
}

/**
 * Muestra el modal de "Vista de Detalles del Bien Adicional".
 * @param {string} itemId - El ID del bien adicional.
 */
export function showAdicionalDetailView(itemId) {
    const item = state.additionalItems.find(i => i.id === itemId);
    if (!item) return;

    const { modal, title, descripcion, clave, claveAsignada, marca, modelo, serie, area, usuario, tipo, photo, noPhoto } = elements.adicionalDetailView;

    title.textContent = 'Detalles del Bien Adicional';
    descripcion.textContent = item.descripcion || 'N/A';
    clave.textContent = item.clave || 'N/A';
    claveAsignada.textContent = item.claveAsignada || 'N/A';
    marca.textContent = item.marca || 'N/A';
    modelo.textContent = item.modelo || 'N/A';
    serie.textContent = item.serie || 'N/A';
    area.textContent = item.area || 'N/A';
    usuario.textContent = item.usuario || 'N/A';
    
    let tipoText = 'Institucional';
    if (item.personal === 'Si') {
        if (item.tieneFormatoEntrada === true) tipoText = 'Personal (Con Formato)';
        else if (item.tieneFormatoEntrada === false) tipoText = 'Personal (Sin Formato - Regularizar)';
        else tipoText = 'Personal (Estado de formato no registrado)';
    }
    tipo.textContent = tipoText;

    photo.classList.add('hidden');
    noPhoto.classList.remove('hidden');
    photo.src = '';

    if (state.additionalPhotos[item.id]) {
        photoDB.getItem('photos', `additional-${item.id}`).then(imageBlob => {
            if (imageBlob) {
                const objectURL = URL.createObjectURL(imageBlob);
                photo.src = objectURL;
                photo.onload = () => URL.revokeObjectURL(objectURL);
                photo.onerror = () => URL.revokeObjectURL(objectURL);
                photo.classList.remove('hidden');
                noPhoto.classList.add('hidden');
            }
        }).catch(() => {
            photo.classList.add('hidden');
            noPhoto.classList.remove('hidden');
            photo.src = '';
        });
    }
    
    modal.classList.add('show');
}

/**
 * Renderiza datos en el modal genérico de "Vista de Reporte".
 * @param {Array<object>} data - Los objetos de datos a renderizar.
 * @param {string} title - Título para el modal.
 * @param {object} options - Opciones de configuración.
 * @param {string[]} options.headers - Array de strings para los encabezados <th>.
 * @param {string} options.reportType - (Opcional) Tipo de reporte (ej. 'labels', 'notes').
 */
export function renderReportTable(data, title, options = {}) {
    const { headers = [], reportType = null } = options; 
    
    const { modal, title: modalTitle, tableHead, tableBody } = elements.reports.reportViewModal;

    modalTitle.textContent = title;
    
    tableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${h}</th>`).join('')}</tr>`;
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center py-4 text-gray-500 dark:text-gray-300">No se encontraron bienes.</td></tr>`;
        modal.classList.add('show');
        return;
    }
    
    data.forEach(item => {
        const row = document.createElement('tr');
        let cells = '';
        const clave = item['CLAVE UNICA'] || item.id; // Usar ID para adicionales
        const isInstitutionalReport = reportType === 'institutional_adicionales';

        if (isInstitutionalReport) {
            const isChecked = state.institutionalReportCheckboxes[item.id] || false;
            cells = `
                <td class="px-4 py-4"><input type="checkbox" class="rounded institutional-report-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
                <td class="px-4 py-4 text-sm">${item.descripcion}</td>
                <td class="px-4 py-4 text-sm">${item.clave || 'N/A'}</td>
                <td class="px-4 py-4 text-sm">${item.area || 'N/A'}</td>
                <td class="px-4 py-4 text-sm">${item.marca || 'N/A'}</td>
                <td class="px-4 py-4 text-sm">${item.serie || 'N/A'}</td>
                <td class_name="px-4 py-4 text-sm">${item.usuario}</td>
                <td class="px-4 py-4">
                    <input type="text" value="${item.claveAsignada || ''}" placeholder="Asignar..." class="new-clave-input w-24 rounded-md border-gray-300 dark:border-slate-600 shadow-sm p-2 text-sm" data-id="${item.id}" autocomplete="off">
                </td>
                <td class="px-4 py-4">
                    <button class="save-new-clave-btn px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors bg-indigo-500 hover:bg-indigo-600" data-id="${item.id}">
                        <i class="fa-solid fa-save mr-1"></i> Guardar
                    </button>
                </td>
            `;
        } else { 
            // Lógica para reportes estándar
            if (reportType === 'labels') {
                cells += `<td class="px-4 py-4">
                    <button class="report-label-done-btn px-3 py-1 rounded-lg text-xs font-bold text-white transition-colors bg-green-500 hover:bg-green-600" data-clave="${clave}">
                        HECHO
                    </button>
                </td>`;
            } else if (reportType === 'notes' || reportType === 'mismatched') {
                const isChecked = state.reportCheckboxes[reportType] ? (state.reportCheckboxes[reportType][clave] || false) : false;
                cells += `<td class="px-4 py-4"><input type="checkbox" class="rounded report-item-checkbox" data-clave="${clave}" data-report-type="${reportType}" ${isChecked ? 'checked' : ''}></td>`;
            }
            
            // Construir celdas basadas en headers
            if (headers.includes('Clave Única')) cells += `<td class="px-4 py-4 text-sm">${item['CLAVE UNICA']}</td>`;
            if (headers.includes('Descripción')) cells += `<td class="px-4 py-4 text-sm">${item['DESCRIPCION']}</td>`;
            if (headers.includes('Serie')) cells += `<td class="px-4 py-4 text-sm">${item['SERIE'] || 'N/A'}</td>`;
            if (headers.includes('Usuario')) cells += `<td class="px-4 py-4 text-sm">${item['NOMBRE DE USUARIO'] || 'N/A'}</td>`;
            if (headers.includes('Marca')) cells += `<td class="px-4 py-4 text-sm">${item['MARCA'] || 'N/A'}</td>`;
            if (headers.includes('Modelo')) cells += `<td class="px-4 py-4 text-sm">${item['MODELO'] || 'N/A'}</td>`;
            if (headers.includes('Ubicado')) cells += `<td class" class="px-4 py-4 text-sm">${item['UBICADO'] || 'NO'}</td>`;
            if (headers.includes('Área Original')) cells += `<td class="px-4 py-4 text-sm">${item.areaOriginal}</td>`;
            if (headers.includes('Nota')) cells += `<td class="px-4 py-4 text-sm" style="white-space: pre-wrap; word-break: break-word;">${state.notes[clave] || 'N/A'}</td>`;
            if (headers.includes('Usuario/Área Actual')) {
                const currentUser = state.resguardantes.find(u => u.name === item['NOMBRE DE USUARIO']);
                cells += `<td class="px-4 py-4 text-sm">${item['NOMBRE DE USUARIO']} (Área: ${currentUser?.area || 'N/A'})</td>`;
            }
        }
        
        row.innerHTML = cells;
        tableBody.appendChild(row);
    });

    modal.classList.add('show');
}

/**
 * Muestra el modal del Log de Actividad.
 */
export function showLogModal() {
    elements.log.content.textContent = state.activityLog.join('\n');
    elements.log.modal.classList.add('show');
    handleModalNavigation(elements.log.modal);
}