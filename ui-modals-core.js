import elements from './elements.js';
import state, { saveState } from './state.js';
import { logActivity } from './logger.js';
import { showToast, showConfirmationModal, handleModalNavigation } from './utils.js';
import { renderAdicionalesList, renderDashboard } from './ui-render.js';
// (Otras dependencias, como 'filterAndRenderInventory', serán inyectadas a través de callbacks)

/**
 * Muestra el modal de Notas.
 * @param {string[]} claves - Array de claves de inventario a las que aplicar la nota.
 */
export function showNotesModal(claves) {
    if (claves.length === 0) {
        return showToast('Seleccione al menos un bien.', 'error');
    }

    if (claves.length > 1) {
        elements.noteTextarea.value = '';
        elements.noteTextarea.placeholder = `Añadir una nota a los ${claves.length} bienes seleccionados...`;
    } else {
        elements.noteTextarea.value = state.notes[claves[0]] || '';
        elements.noteTextarea.placeholder = 'Escribe tu nota aquí...';
    }

    elements.noteSaveBtn.dataset.claves = JSON.stringify(claves);
    elements.notesModal.classList.add('show');
    handleModalNavigation(elements.notesModal);
}

/**
 * Muestra el modal con el Código QR generado.
 * @param {string} clave - La clave del bien para generar el QR.
 */
export function showQrModal(clave) {
    const { modal, container, title } = elements.qrDisplayModal;
    container.innerHTML = '';
    title.textContent = `Código QR del Bien: ${clave}`;
    
    // Asumiendo que QRCode (qrcode.min.js) está en el scope global (desde index.html)
    new QRCode(container, {
        text: clave,
        width: 200,
        height: 200,
        correctLevel: QRCode.CorrectLevel.H
    });
    
    modal.classList.add('show');
    handleModalNavigation(modal);
}

/**
 * Muestra el modal para editar un usuario resguardante.
 * @param {number} index - El índice del usuario en `state.resguardantes`.
 */
export function showEditUserModal(index) {
    if (state.readOnlyMode) return;
    const user = state.resguardantes[index];
    elements.editUserModal.querySelector('#edit-user-name').value = user.name;
    elements.editUserModal.querySelector('#edit-user-location').value = user.locationWithId;
    elements.editUserAreaSelect.value = user.area;
    elements.editUserSaveBtn.dataset.userIndex = index;
    elements.editUserModal.classList.add('show');
    handleModalNavigation(elements.editUserModal);
}

/**
 * Muestra el modal para editar un bien adicional.
 * @param {string} id - El ID del bien adicional.
 */
export function showEditAdicionalModal(id) {
    if (state.readOnlyMode) return;
    const item = state.additionalItems.find(i => i.id === id);
    if (!item) return;

    const { modal, form, saveBtn } = elements.editAdicionalModal;
    form.elements['clave'].value = item.clave || '';
    form.elements['descripcion'].value = item.descripcion || '';
    form.elements['marca'].value = item.marca || '';
    form.elements['modelo'].value = item.modelo || '';
    form.elements['serie'].value = item.serie || '';
    form.elements['area'].value = item.area || '';
    form.elements['personal'].value = item.personal || 'No';
    
    saveBtn.dataset.id = id;
    modal.classList.add('show');
    handleModalNavigation(modal);
}

/**
 * Muestra el modal de "Bien Personal" (Formato de Entrada).
 * @param {Function} onConfirm - Callback que recibe (true) para 'Sí' o (false) para 'No'.
 */
export function showFormatoEntradaModal(onConfirm) {
    const { modal, siBtn, noBtn } = elements.formatoEntradaModal;
    modal.classList.add('show');
    
    let cleanup = handleModalNavigation(modal);

    const siHandler = () => { onConfirm(true); closeModal(); };
    const noHandler = () => { onConfirm(false); closeModal(); };
    
    const closeModal = () => {
        modal.classList.remove('show');
        siBtn.removeEventListener('click', siHandler, { once: true });
        noBtn.removeEventListener('click', noHandler, { once: true });
        cleanup();
    };

    siBtn.addEventListener('click', siHandler, { once: true });
    noBtn.addEventListener('click', noHandler, { once: true });
}

/**
 * Muestra el modal de reasignación al eliminar un listado.
 * @param {number} listId - ID del listado a eliminar.
 * @param {string} areaOriginal - ID del área afectada.
 * @param {object[]} affectedUsers - Usuarios en esa área.
 * @param {object[]} affectedAdicionales - Bienes adicionales de esos usuarios.
 * @param {Function} deleteListAndRefreshCallback - Callback para eliminar el listado.
 */
export function showReassignModal(listId, areaOriginal, affectedUsers, affectedAdicionales, deleteListAndRefreshCallback) {
    const { modal, text, areaSelect, confirmBtn, keepBtn, deleteAllBtn, cancelBtn } = elements.reassignModal;
    
    text.textContent = `El listado del área ${areaOriginal} tiene ${affectedUsers.length} usuario(s) y ${affectedAdicionales.length} bien(es) asociado(s). Elige una acción.`;
    
    areaSelect.innerHTML = state.areas
        .filter(area => area !== areaOriginal)
        .map(area => `<option value="${area}">Área ${state.areaNames[area] || area}</option>`)
        .join('');
    
    if (areaSelect.options.length === 0) {
        areaSelect.disabled = true;
        confirmBtn.disabled = true;
        areaSelect.innerHTML = '<option>No hay otras áreas disponibles</option>';
    } else {
        areaSelect.disabled = false;
        confirmBtn.disabled = false;
    }
    
    modal.classList.add('show');
    const cleanup = handleModalNavigation(modal);

    const confirmHandler = () => {
        const newArea = areaSelect.value;
        if (!newArea) return showToast('Por favor, selecciona un área para reasignar.', 'error');
        
        affectedUsers.forEach(user => user.area = newArea);
        logActivity('Usuarios reasignados', `${affectedUsers.length} usuarios del área ${areaOriginal} movidos al área ${newArea}.`);
        showToast(`${affectedUsers.length} usuario(s) reasignado(s) al área ${newArea}.`);
        deleteListAndRefreshCallback(listId);
        closeModal();
    };
    
    const keepHandler = () => {
        if (!state.persistentAreas.includes(areaOriginal)) {
            state.persistentAreas.push(areaOriginal);
        }
        logActivity('Área mantenida', `El área ${areaOriginal} se mantuvo a pesar de eliminar el listado.`);
        showToast(`Los usuarios y bienes se mantendrán en el área ${areaOriginal}.`);
        deleteListAndRefreshCallback(listId);
        closeModal();
    };
    
    const deleteAllHandler = () => {
        showConfirmationModal(
            '¡ADVERTENCIA!', 
            `Esto eliminará permanentemente ${affectedUsers.length} usuario(s) y ${affectedAdicionales.length} bien(es) asociado(s). Esta acción no se puede deshacer. ¿Continuar?`, 
            () => {
                const affectedUserIds = affectedUsers.map(u => u.id);
                const affectedUserNames = affectedUsers.map(u => u.name);
                state.resguardantes = state.resguardantes.filter(u => !affectedUserIds.includes(u.id));
                state.additionalItems = state.additionalItems.filter(item => !affectedUserNames.includes(item.usuario));
                logActivity('Eliminación masiva', `Se eliminaron ${affectedUsers.length} usuarios y ${affectedAdicionales.length} bienes del área ${areaOriginal}.`);
                showToast(`Se eliminaron usuarios y bienes del área ${areaOriginal}.`, 'warning');
                deleteListAndRefreshCallback(listId);
                closeModal();
            }
        );
    };

    const closeModal = () => {
        modal.classList.remove('show');
        confirmBtn.removeEventListener('click', confirmHandler);
        keepBtn.removeEventListener('click', keepHandler);
        deleteAllBtn.removeEventListener('click', deleteAllHandler);
        cancelBtn.removeEventListener('click', closeModal);
        cleanup();
    };

    confirmBtn.addEventListener('click', confirmHandler, { once: true });
    keepBtn.addEventListener('click', keepHandler, { once: true });
    deleteAllBtn.addEventListener('click', deleteAllHandler, { once: true });
    cancelBtn.addEventListener('click', closeModal, { once: true });
}

/**
 * Muestra el modal genérico de pre-impresión para editar campos.
 * @param {string} reportType - El tipo de reporte (ej. 'session_summary').
 * @param {object} data - Datos pre-cargados (ej. { areaId: '123' }).
 * @param {object} callbacks - Objeto con las funciones de generación de reportes (ej. { session_summary: fn, ... }).
 */
export function showPreprintModal(reportType, data, callbacks) {
    const { modal, title, fieldsContainer, confirmBtn } = elements.preprintModal;
    let fieldsHtml = '';
    let defaultValues = {};
    let titleText = '';

    const selectedArea = elements.reports.areaFilter.value;
    const selectedUser = elements.reports.userFilter.value;
    const areaId = data.areaId || (selectedArea !== 'all' ? selectedArea : (state.resguardantes.find(u => u.name === selectedUser)?.area || null));
    const areaResponsibleData = areaId ? state.areaDirectory[areaId] : null;

    switch (reportType) {
        case 'session_summary':
            titleText = 'Generar Resumen de Sesión';
            defaultValues = {
                author: elements.settings.summaryAuthor.value.trim(),
                areaResponsible: elements.settings.summaryAreaResponsible.value.trim(),
                location: elements.settings.summaryLocation.value.trim()
            };
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Ubicación Física:</label><input type="text" id="preprint-location" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.location}"></div>
                <div><label class="block text-sm font-medium">Realizado por (Entrega):</label><input type="text" id="preprint-author" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.author}"></div>
                <div><label class="block text-sm font-medium">Responsable del Área (Recibe):</label><input type="text" id="preprint-areaResponsible" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaResponsible}"></div>
            `;
            break;
        case 'area_closure':
            titleText = 'Generar Acta de Cierre de Área';
            defaultValues = {
                areaId: data.areaId,
                responsible: data.responsible || (areaResponsibleData?.name || ''), 
                location: data.location || '',
                areaFullName: state.areaNames[data.areaId] || `Área ${data.areaId}`,
                entrega: state.currentUser.name,
                recibe: data.responsible || (areaResponsibleData?.name || ''),
                recibeCargo: areaResponsibleData?.title || 'Responsable de Área'
            };
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Nombre Completo del Área:</label><input type="text" id="preprint-areaFullName" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaFullName}"></div>
                <div><label class="block text-sm font-medium">Ubicación de Firma:</label><input type="text" id="preprint-location" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.location}" placeholder="Ej. Oficina 1..."></div>
                <div><label class="block text-sm font-medium">Entrega (Inventario):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                <div><label class="block text-sm font-medium">Recibe de Conformidad:</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}" placeholder="Nombre completo de quien recibe"></div>
                <div><label class="block text-sm font-medium">Cargo de Quien Recibe:</label><input type="text" id="preprint-recibeCargo" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibeCargo}"></div>
            `;
            break;
         case 'simple_pending':
            titleText = 'Imprimir Reporte de Pendientes';
            defaultValues = {
                areaDisplay: selectedArea !== 'all' ? `${state.areaNames[selectedArea] || selectedArea}` : 'Todas las Áreas',
                entrega: state.currentUser.name,
                recibe: "_________________________"
            };
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Reporte para:</label><input type="text" id="preprint-areaDisplay" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaDisplay}"></div>
                <div><label class="block text-sm font-medium">Realizó (Entrega):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                <div><label class="block text-sm font-medium">Recibe Copia:</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}"></div>
            `;
            break;
        case 'individual_resguardo':
        case 'adicionales_informe':
            titleText = 'Imprimir Resguardo';
            const isAdicional = reportType === 'adicionales_informe';
            const isForArea = data.isForArea || false;
            const isForUser = data.isForUser || false;

            let userForReport = 'Usuario';
            if (isAdicional) {
                if (isForUser) userForReport = selectedUser;
                else if (isForArea) userForReport = `Responsables del Área ${areaId}`;
                else userForReport = 'Todas las Áreas';
            } else {
                if (selectedUser !== 'all') userForReport = selectedUser;
                else userForReport = '_________________________'; 
            }
            
            defaultValues = {
                areaFullName: areaId ? (state.areaNames[areaId] || `Área ${areaId}`) : 'Todas las Áreas',
                entrega: areaResponsibleData?.name || '_________________________',
                recibe: userForReport,
                recibeCargo: areaResponsibleData?.title || 'Responsable de Área',
                isForArea: isForArea,
                isForUser: isForUser
            };
            
            fieldsHtml = `
                <div><label class="block text-sm font-medium">Nombre Completo del Área:</label><input type="text" id="preprint-areaFullName" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.areaFullName}"></div>
                <div><label class="block text-sm font-medium">Responsable del Área (Entrega):</label><input type="text" id="preprint-entrega" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.entrega}"></div>
                <div><label class="block text-sm font-medium">Firma de Conformidad (Recibe):</label><input type="text" id="preprint-recibe" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibe}"></div>
                <div><label class="block text-sm font-medium">Cargo de Quien Entrega:</label><input type="text" id="preprint-recibeCargo" class="mt-1 block w-full p-2 border rounded-md" value="${defaultValues.recibeCargo}"></div>
            `;
            break;
        default:
            return;
    }

    title.textContent = titleText;
    fieldsContainer.innerHTML = fieldsHtml;
    modal.classList.add('show');
    const cleanup = handleModalNavigation(modal);

    confirmBtn.onclick = () => {
        const updatedOptions = { ...defaultValues };
        const inputs = fieldsContainer.querySelectorAll('input');
        inputs.forEach(input => {
            const key = input.id.replace('preprint-', '');
            updatedOptions[key] = input.value;
        });

        if (reportType === 'area_closure' && (!updatedOptions.recibe || !updatedOptions.location)) {
             return showToast('Para el Acta de Cierre, el nombre de quien recibe y la ubicación son obligatorios.', 'error');
        }
        
        // Llamar a la función de generación de reporte correspondiente
        if (callbacks[reportType]) {
            callbacks[reportType](updatedOptions);
        }

        modal.classList.remove('show');
        cleanup();
    };
    
    // Asignar el cleanup al botón de cancelar
    elements.preprintModal.cancelBtn.onclick = () => {
        modal.classList.remove('show');
        cleanup();
    };
}