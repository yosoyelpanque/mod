import elements from './elements.js';
import state, { saveState, startAutosave, checkReadOnlyMode } from './state.js';
import { logActivity } in './logger.js';
import { 
    renderDashboard, 
    updateActiveUserBanner, 
    renderUserList,
    renderAreaProgress,
    renderReportStats,
    populateReportFilters,
    renderLoadedLists,
    renderDirectory,
    populateAdicionalesFilters,
    renderAdicionalesList,
    populateAreaSelects,
    populateBookTypeFilter,
    updateTheme
} from './ui-render.js';
import { 
    filterAndRenderInventory, 
    setInventoryPage 
} from './ui-inventory.js';

/**
 * Cambia la pestaña activa en la interfaz.
 * @param {string} tabName - El nombre de la pestaña a activar (ej. 'users', 'inventory').
 */
export function changeTab(tabName) {
    // Ocultar todos los contenidos de pestañas
    elements.tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Quitar 'active' de todos los botones de pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Activar la pestaña y el botón correctos
    const activeTabContent = document.getElementById(`${tabName}-tab`);
    const activeTabButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    
    if (activeTabContent) {
        activeTabContent.classList.add('active');
    }
    if (activeTabButton) {
        activeTabButton.classList.add('active');
    }
    
    // Cambiar el fondo "glass"
    const contentArea = elements.mainContentArea;
    contentArea.className = 'p-6 rounded-xl shadow-md glass-effect'; // Resetea clases
    contentArea.classList.add(`bg-tab-${tabName}`);

    logActivity('Navegación', `Se cambió a la pestaña: ${tabName}.`);
    
    // Actualizar el banner de usuario (podría ocultarse/mostrarse)
    updateActiveUserBanner();

    // Lógica específica al cargar cada pestaña
    if (tabName === 'inventory') {
        setInventoryPage(1); // Resetea a la página 1
        filterAndRenderInventory({ showItemDetailView }); // Pasa la función de mostrar detalles
        setTimeout(() => elements.inventory.searchInput.focus(), 100);
    }
    if (tabName === 'users') {
        renderUserList();
    }
    if (tabName === 'reports') {
        renderAreaProgress();
        renderReportStats();
        populateReportFilters();
    }
    if (tabName === 'settings') {
        renderLoadedLists();
        renderDirectory();
    }
    if (tabName === 'adicionales') {
        populateAdicionalesFilters();
        renderAdicionalesList();
        setTimeout(() => document.getElementById('ad-clave').focus(), 100);
    }
}

/**
 * Muestra la aplicación principal (después del login) y configura el estado inicial de la UI.
 */
export function showMainApp() {
    elements.loginPage.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    elements.currentUserDisplay.textContent = state.currentUser.name;
    elements.settings.summaryAuthor.value = state.currentUser.name;

    updateTheme(state.theme);
    renderDashboard();
    populateAreaSelects();
    populateReportFilters();
    populateBookTypeFilter();
    setInventoryPage(1);
    filterAndRenderInventory({ showItemDetailView }); // Pasa la función de mostrar detalles
    startAutosave();
    renderLoadedLists();
    renderDirectory();
    checkReadOnlyMode();
    changeTab('users'); // Iniciar en la pestaña de usuarios
}