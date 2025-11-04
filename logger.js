import state from './state.js';

/**
 * Registra una entrada de actividad en el log del estado.
 * @param {string} action - La acción realizada (ej. 'Usuario Creado', 'Archivo Cargado').
 * @param {string} details - Detalles adicionales sobre la acción.
 */
export function logActivity(action, details = '') {
    const timestamp = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const logEntry = `[${timestamp}] ${action}: ${details}`;
    
    // Accede al array activityLog del estado importado
    if (state.activityLog) {
        state.activityLog.push(logEntry);
    } else {
        // Fallback por si el log no se ha inicializado
        state.activityLog = [logEntry];
    }
}