/**
 * Almacena todas las referencias a los elementos del DOM 
 * para un acceso rápido y centralizado.
 */
const elements = {
    loginPage: document.getElementById('login-page'), mainApp: document.getElementById('main-app'),
    employeeNumberInput: document.getElementById('employee-number-input'),
    employeeLoginBtn: document.getElementById('employee-login-btn'),
    clearSessionLink: document.getElementById('clear-session-link'),
    currentUserDisplay: document.getElementById('current-user-name'),
    fileInput: document.getElementById('file-input'),
    uploadBtn: document.getElementById('upload-btn'), logoutBtn: document.getElementById('logout-btn'),
    dashboard: {
        headerAndDashboard: document.getElementById('header-and-dashboard'),
        toggleBtn: document.getElementById('dashboard-toggle-btn'),
        dailyProgressCard: document.getElementById('daily-progress-card'),
        progressTooltip: document.getElementById('progress-tooltip'),
    },
    totalItemsEl: document.getElementById('total-items'), locatedItemsEl: document.getElementById('located-items'),
    pendingItemsEl: document.getElementById('pending-items'), dailyProgressEl: document.getElementById('daily-progress'),
    workingAreasCountEl: document.getElementById('working-areas-count'),
    additionalItemsCountEl: document.getElementById('additional-items-count'),
    tabsContainer: document.getElementById('tabs-container'), tabContents: document.querySelectorAll('.tab-content'),
    mainContentArea: document.getElementById('main-content-area'),
    logo: {
        container: document.getElementById('logo-container'),
        img: document.getElementById('logo-img'),
        title: document.querySelector('#main-app header div:nth-child(1) > div:nth-child(2) > h2')
    },
    // --- INICIO MEJORA 1: Elementos del Banner de Usuario Activo ---
    activeUserBanner: {
        banner: document.getElementById('active-user-banner'),
        name: document.getElementById('active-user-banner-name'),
        area: document.getElementById('active-user-banner-area'), // <-- AÑADE ESTA LÍNEA
        deactivateBtn: document.getElementById('deactivate-user-btn')
    },
    // --- FIN MEJORA 1 ---
    userForm: {
        name: document.getElementById('user-name'), locationSelect: document.getElementById('user-location-select'),
        locationManual: document.getElementById('user-location-manual'), areaSelect: document.getElementById('user-area-select'),
        createBtn: document.getElementById('create-user-btn'), list: document.getElementById('registered-users-list')
    },
    inventory: {
        tableBody: document.getElementById('inventory-table-body'),
        searchInput: document.getElementById('search-input'), qrScanBtn: document.getElementById('qr-scan-btn'),
        clearSearchBtn: document.getElementById('clear-search-btn'), ubicadoBtn: document.getElementById('ubicado-btn'),
        reEtiquetarBtn: document.getElementById('re-etiquetar-btn'),
        // --- INICIO MEJORA 2 ---
        desubicarBtn: document.getElementById('desubicar-btn'),
        // --- FIN MEJORA 2 ---
        addNoteBtn: document.getElementById('add-note-btn'),
        prevPageBtn: document.getElementById('prev-page-btn'),
        nextPageBtn: document.getElementById('next-page-btn'), pageInfo: document.getElementById('page-info'),
        statusFilter: document.getElementById('status-filter'), areaFilter: document.getElementById('area-filter-inventory'),
        bookTypeFilter: document.getElementById('book-type-filter'),
        selectAllCheckbox: document.getElementById('select-all-checkbox')
    },
    adicionales: {
        form: document.getElementById('adicional-form'),
        addBtn: document.getElementById('add-adicional-btn'), list: document.getElementById('adicionales-list'),
        areaFilter: document.getElementById('ad-area-filter'),
        userFilter: document.getElementById('ad-user-filter'),
        printResguardoBtn: document.getElementById('print-adicionales-resguardo-btn'),
        total: document.getElementById('additional-items-total')
    },
    reports: {
        // --- INICIO PULIDO: Añadido elemento de progreso ---
        areaProgressContainer: document.getElementById('area-progress-container'),
        // --- FIN PULIDO ---
        stats: document.getElementById('general-stats'), 
        // --- INICIO REQ 1: Referencias de filtros invertidas ---
        areaFilter: document.getElementById('report-area-filter'),
        userFilter: document.getElementById('report-user-filter'),
        // --- FIN REQ 1 ---
        reportButtons: document.querySelectorAll('.report-btn'),
        exportLabelsXlsxBtn: document.getElementById('export-labels-xlsx-btn'),
        exportXlsxBtn: document.getElementById('export-xlsx-btn'),
        // --- INICIO REQ 3: Referencias al nuevo modal de reportes ---
        reportViewModal: {
            modal: document.getElementById('report-view-modal'),
            title: document.getElementById('report-view-title'),
            closeBtn: document.getElementById('report-view-close-btn'),
            closeFooterBtn: document.getElementById('report-view-close-footer-btn'),
            content: document.getElementById('report-view-content'),
            tableHead: document.getElementById('report-view-table-head'),
            tableBody: document.getElementById('report-view-table-body')
        }
    },
    settings: {
        themes: document.querySelectorAll('[data-theme]'), autosaveInterval: document.getElementById('autosave-interval'),
        loadedListsContainer: document.getElementById('loaded-lists-container'),
        exportSessionBtn: document.getElementById('export-session-btn'),
        importSessionBtn: document.getElementById('import-session-btn'),
        importFileInput: document.getElementById('import-file-input'),
        finalizeInventoryBtn: document.getElementById('finalize-inventory-btn'),
        summaryAuthor: document.getElementById('summary-author'),
        summaryAreaResponsible: document.getElementById('summary-area-responsible'),
        summaryLocation: document.getElementById('summary-location'),
        directoryContainer: document.getElementById('directory-container'),
        directoryCount: document.getElementById('directory-count'),
        aboutHeader: document.getElementById('about-header'),
        aboutContent: document.getElementById('about-content'),
        // --- INICIO REQ 7: Limpieza de código (referencias a botones eliminados) ---
        importPhotosBtn: document.getElementById('import-photos-btn'),
        importPhotosInput: document.getElementById('import-photos-input'),
        restorePhotosBtn: document.getElementById('restore-photos-from-backup-btn'),
        restorePhotosInput: document.getElementById('restore-photos-input')
        // --- FIN REQ 7 ---
    },
    loadingOverlay: {
        overlay: document.getElementById('loading-overlay'),
        spinner: document.getElementById('loading-spinner'),
        text: document.getElementById('loading-text')
    },
    importProgress: {
        modal: document.getElementById('import-progress-modal'),
        text: document.getElementById('import-progress-text'),
        bar: document.getElementById('import-progress-bar')
    },
    confirmationModal: document.getElementById('confirmation-modal'), modalTitle: document.getElementById('modal-title'),
    modalText: document.getElementById('modal-text'), modalConfirmBtn: document.getElementById('modal-confirm'),
    modalCancelBtn: document.getElementById('modal-cancel'), toastContainer: document.getElementById('toast-container'),
    notesModal: document.getElementById('notes-modal'), noteTextarea: document.getElementById('note-textarea'),
    noteSaveBtn: document.getElementById('note-save-btn'), noteCancelBtn: document.getElementById('note-cancel-btn'),
    itemDetailsModal: {
        modal: document.getElementById('item-details-modal'),
        title: document.getElementById('item-details-title'),
        content: document.getElementById('item-details-content'),
        closeBtn: document.getElementById('item-details-close-btn')
    },
    qrDisplayModal: {
        modal: document.getElementById('qr-display-modal'),
        title: document.getElementById('qr-display-title'),
        container: document.getElementById('qr-code-display'),
        closeBtn: document.getElementById('qr-display-close-btn')
    },
    // INICIO MOD 4: Elementos del Modal de Transferencia de Foto
    transferPhotoModal: {
        modal: document.getElementById('transfer-photo-modal'),
        title: document.getElementById('transfer-photo-title'),
        text: document.getElementById('transfer-photo-text'),
        preview: document.getElementById('transfer-photo-preview'),
        search: document.getElementById('transfer-photo-search'),
        select: document.getElementById('transfer-photo-select'),
        skipBtn: document.getElementById('transfer-photo-skip-btn'),
        cancelBtn: document.getElementById('transfer-photo-cancel-btn'),
        confirmBtn: document.getElementById('transfer-photo-confirm-btn')
    },
    // FIN MOD 4
    formatoEntradaModal: {
        modal: document.getElementById('formato-entrada-modal'),
        siBtn: document.getElementById('formato-entrada-si'),
        noBtn: document.getElementById('formato-entrada-no')
    },
    editAdicionalModal: {
        modal: document.getElementById('edit-adicional-modal'),
        form: document.getElementById('edit-adicional-form'),
        saveBtn: document.getElementById('edit-adicional-save-btn'),
        cancelBtn: document.getElementById('edit-adicional-cancel-btn')
    },
    photo: {
        modal: document.getElementById('photo-modal'),
        title: document.getElementById('photo-modal-title'),
        input: document.getElementById('photo-input'),
        message: document.getElementById('photo-message'),
        closeBtn: document.getElementById('photo-close-btn'),
        viewContainer: document.getElementById('photo-view-container'),
        uploadContainer: document.getElementById('photo-upload-container'),
        img: document.getElementById('item-photo-img'),
        deleteBtn: document.getElementById('delete-photo-btn'),
        useCameraBtn: document.getElementById('use-camera-btn'),
        cameraViewContainer: document.getElementById('camera-view-container'),
        cameraStream: document.getElementById('camera-stream'),
        photoCanvas: document.getElementById('photo-canvas'),
        captureBtn: document.getElementById('capture-photo-btn'),
        switchToUploadBtn: document.getElementById('switch-to-upload-btn'),
        cameraSelect: document.getElementById('photo-camera-select')
    },
    editUserModal: document.getElementById('edit-user-modal'),
    editUserSaveBtn: document.getElementById('edit-user-save-btn'), editUserCancelBtn: document.getElementById('edit-user-cancel-btn'),
    editUserAreaSelect: document.getElementById('edit-user-area'), 
    qrScannerModal: document.getElementById('qr-scanner-modal'),
    qrReader: document.getElementById('qr-reader'), 
    qrScannerCloseBtn: document.getElementById('qr-scanner-close-btn'),
    qrCameraSelect: document.getElementById('qr-camera-select'),
    areaClosure: {
        modal: document.getElementById('area-closure-modal'),
        title: document.getElementById('area-closure-title'),
        responsibleInput: document.getElementById('area-closure-responsible'),
        locationInput: document.getElementById('area-closure-location'),
        confirmBtn: document.getElementById('area-closure-confirm-btn'),
        cancelBtn: document.getElementById('area-closure-cancel-btn')
    },
    reassignModal: {
        modal: document.getElementById('reassign-modal'),
        title: document.getElementById('reassign-title'),
        text: document.getElementById('reassign-text'),
        areaSelect: document.getElementById('reassign-area-select'),
        confirmBtn: document.getElementById('reassign-confirm-btn'),
        keepBtn: document.getElementById('reassign-keep-btn'),
        deleteAllBtn: document.getElementById('reassign-delete-all-btn'),
        cancelBtn: document.getElementById('reassign-cancel-btn'),
    },
    readOnlyOverlay: document.getElementById('read-only-mode-overlay'),
    log: {
        modal: document.getElementById('log-modal'),
        content: document.getElementById('log-content'),
        showBtn: document.getElementById('show-log-btn'),
        closeBtn: document.getElementById('log-close-btn')
    },
    detailView: {
        modal: document.getElementById('item-detail-view-modal'),
        title: document.getElementById('detail-view-title'),
        closeBtn: document.getElementById('detail-view-close-btn'),
        photoContainer: document.getElementById('detail-view-photo-container'),
        photo: document.getElementById('detail-view-photo'),
        noPhoto: document.getElementById('detail-view-no-photo'),
        clave: document.getElementById('detail-view-clave'),
        descripcion: document.getElementById('detail-view-descripcion'),
        marca: document.getElementById('detail-view-marca'),
        modelo: document.getElementById('detail-view-modelo'),
        serie: document.getElementById('detail-view-serie'),
        usuario: document.getElementById('detail-view-usuario'),
        area: document.getElementById('detail-view-area'),
        areaWarning: document.getElementById('detail-view-area-warning'),
        ubicarBtn: document.getElementById('detail-view-ubicar-btn'),
        reetiquetarBtn: document.getElementById('detail-view-reetiquetar-btn'),
        notaBtn: document.getElementById('detail-view-nota-btn'),
        fotoBtn: document.getElementById('detail-view-foto-btn')
    },
    // --- INICIO REQ 2: Referencias para modales de detalle de Usuario y Adicional ---
    userDetailView: {
        modal: document.getElementById('user-detail-view-modal'),
        title: document.getElementById('user-detail-view-title'),
        closeBtn: document.getElementById('user-detail-view-close-btn'),
        closeFooterBtn: document.getElementById('user-detail-view-close-footer-btn'),
        photoContainer: document.getElementById('user-detail-view-photo-container'),
        photo: document.getElementById('user-detail-view-photo'),
        noPhoto: document.getElementById('user-detail-view-no-photo'),
        name: document.getElementById('user-detail-view-name'),
        area: document.getElementById('user-detail-view-area'),
        location: document.getElementById('user-detail-view-location')
    },
    adicionalDetailView: {
        modal: document.getElementById('adicional-detail-view-modal'),
        title: document.getElementById('adicional-detail-view-title'),
        closeBtn: document.getElementById('adicional-detail-view-close-btn'),
        closeFooterBtn: document.getElementById('adicional-detail-view-close-footer-btn'),
        photoContainer: document.getElementById('adicional-detail-view-photo-container'),
        photo: document.getElementById('adicional-detail-view-photo'),
        noPhoto: document.getElementById('adicional-detail-view-no-photo'),
        descripcion: document.getElementById('adicional-detail-view-descripcion'),
        clave: document.getElementById('adicional-detail-view-clave'),
        claveAsignada: document.getElementById('adicional-detail-view-claveAsignada'),
        marca: document.getElementById('adicional-detail-view-marca'),
        modelo: document.getElementById('adicional-detail-view-modelo'),
        serie: document.getElementById('adicional-detail-view-serie'),
        area: document.getElementById('adicional-detail-view-area'),
        usuario: document.getElementById('adicional-detail-view-usuario'),
        tipo: document.getElementById('adicional-detail-view-tipo')
    },
    preprintModal: {
        modal: document.getElementById('preprint-edit-modal'),
        title: document.getElementById('preprint-title'),
        fieldsContainer: document.getElementById('preprint-fields'),
        confirmBtn: document.getElementById('preprint-confirm-btn'),
        cancelBtn: document.getElementById('preprint-cancel-btn')
    },
    layoutEditor: { 
        modal: document.getElementById('layout-editor-modal'),
        openBtn: document.getElementById('open-layout-editor-btn'),
        closeBtn: document.getElementById('layout-close-btn'),
        saveBtn: document.getElementById('layout-save-btn'),
        printBtn: document.getElementById('layout-print-btn'),
        sidebar: document.getElementById('layout-sidebar-locations'),
        toolsSidebar: document.getElementById('layout-tools-sidebar'),
        canvas: document.getElementById('layout-canvas'),
        canvasWrapper: document.getElementById('layout-canvas-wrapper'),
        pagePrev: document.getElementById('layout-page-prev'),
        pageNext: document.getElementById('layout-page-next'),
        pageAdd: document.getElementById('layout-page-add'),
        // --- INICIO MEJORA 3 (Botón Reset) ---
        pageReset: document.getElementById('layout-page-reset'),
        // --- FIN MEJORA 3 ---
        pageRemove: document.getElementById('layout-page-remove'),
        pageName: document.getElementById('layout-page-name'),
        addImageBtn: document.getElementById('layout-add-image-btn'),
        imageInput: document.getElementById('layout-image-input')
    }, 
    printContainer: document.getElementById('print-view-container'),
    printTemplates: {
        sessionSummary: document.getElementById('print-session-summary'),
        areaClosure: document.getElementById('print-area-closure'),
        resguardo: document.getElementById('print-resguardo'),
        simplePending: document.getElementById('print-simple-pending'),
        tasksReport: document.getElementById('print-tasks-report'),
        layout: document.getElementById('print-layout-view')
    }
};

export default elements;