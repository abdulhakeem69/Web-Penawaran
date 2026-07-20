/**
 * ==========================================================================
 * L-TUDO INTERIOR QUOTATION - CLIENT APPLICATION SCRIPT
 * ==========================================================================
 */

// --- Global States ---
let currentQuotation = {};
let quotationHistory = [];
let companySettings = {};
let useApi = false;

// Default settings if LocalStorage is empty
const defaultCompanySettings = {
    name: "L-TUDO INTERIOR",
    address: "",
    contact: "Email: info@ltudo-interior.com | Web: www.ltudo-interior.com",
    sigName: "L-TUDO Interior Design",
    sigTitle: "Estimator & Interior Designer",
    defaultNotes: [
        "Bahan dasar menggunakan Multiplek berkualitas tinggi ketebalan 18mm (Bukan MDF/Partikel Board).",
        "Finishing bagian luar HPL Taco / setara (Warna & motif disetujui customer).",
        "Finishing bagian dalam menggunakan melamin putih berkualitas.",
        "Aksesoris & hardware (engsel, rel laci) menggunakan Huben Slow Motion (Soft-close).",
        "Waktu produksi di workshop adalah 30-40 hari kerja terhitung sejak gambar kerja disetujui.",
        "Sistem pembayaran: DP 50% saat tanda tangan kontrak, Progress 40% saat barang dikirim, Pelunasan 10% setelah instalasi selesai."
    ]
};

// Default template for a new quotation if user starts from scratch
const sampleQuotationTemplate = {
    id: "",
    number: "",
    customerName: "Bapak Aditya Nugroho",
    customerAddress: "Cluster Grand Silma Kavling B-7, Jagakarsa, Jakarta Selatan",
    customerPhone: "0812-9988-7766",
    date: "",
    sections: [
        {
            id: "sec_1",
            title: "Pantry & Kitchen Set",
            items: [
                {
                    id: "item_1_1",
                    name: "Kabinet Atas (Pantry)",
                    volume: "2.8 m1",
                    qty: 2.8,
                    price: 3250000,
                    notes: "Finishing HPL Taco Woodgrain, Fitting Huben Slow Motion"
                },
                {
                    id: "item_1_2",
                    name: "Kabinet Bawah (Pantry)",
                    volume: "2.8 m1",
                    qty: 2.8,
                    price: 3450000,
                    notes: "Finishing HPL Taco Woodgrain, Laci Sendok, Rel Double Track"
                },
                {
                    id: "item_1_3",
                    name: "Top Table Granite Black Gold",
                    volume: "2.8 m1",
                    qty: 2.8,
                    price: 1950000,
                    notes: "Lebar 60cm, Profil Bullnose, Coak Sink & Kompor"
                }
            ]
        },
        {
            id: "sec_2",
            title: "Living Room (TV Cabinet)",
            items: [
                {
                    id: "item_2_1",
                    name: "Buffet TV & Backdrop",
                    volume: "2.4 x 2.2 m",
                    qty: 1,
                    price: 6800000,
                    notes: "Finishing HPL Matte Grey + Woodgrain Accent, Hidden LED Stripe"
                }
            ]
        }
    ],
    notes: [] // will copy from default notes on load
};

// Completely empty template for fresh new quotation
const emptyQuotationTemplate = {
    id: "",
    number: "",
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    date: "",
    sections: [],
    notes: []
};

// --- Initialization ---
window.onload = function() {
    init();
};

/**
 * Initializes the application: loads storage, binds events, and setups the default UI state.
 */
async function init() {
    console.log("Initializing L-TUDO Interior Quotation application...");
    
    // Check if we should use SQL backend (if protocol is http/https)
    useApi = window.location.protocol.startsWith('http');
    console.log("Database Mode:", useApi ? "SQL Database (SQLite Backend)" : "LocalStorage (Browser Backend)");
    
    // Set Header Date
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('header-date').innerText = new Date().toLocaleDateString('id-ID', dateOptions);

    // 1. Load Settings
    await loadSettings();

    // 2. Load History
    await loadHistory();

    // 3. Set up active quotation
    await loadLocal();

    // 4. Update Dashboard metrics
    updateDashboardMetrics();

    // 5. Render History list
    renderHistory();
    
    // 5b. Update database status badge
    updateDatabaseStatus();
    
    // 6. Bind window resize/scroll details if any
    updateLivePreview();
}

/**
 * Switch page/tab in Single Page Application layout
 */
function switchPage(pageId, event) {
    if (event) {
        event.preventDefault();
    }
    
    // Select all pages and links
    const pages = document.querySelectorAll('.page-section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Hide all pages
    pages.forEach(p => p.classList.add('d-none'));
    
    // Deactivate all nav links
    navLinks.forEach(l => l.classList.remove('active'));
    
    // Show target page
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('d-none');
    }
    
    // Activate clicked nav link
    const targetLink = document.getElementById(`nav-${pageId}`);
    if (targetLink) {
        targetLink.classList.add('active');
    }
    
    // Update Title in Navbar
    const titleMap = {
        'dashboard': 'Dashboard',
        'buat-penawaran': 'Buat Penawaran Baru',
        'riwayat': 'Riwayat Penawaran',
        'pengaturan': 'Pengaturan Default'
    };
    document.getElementById('page-title').innerText = titleMap[pageId] || 'L-TUDO';

    // Auto close sidebar on mobile if open
    document.body.classList.remove('sidebar-open');

    // Trigger updates
    if (pageId === 'dashboard') {
        updateDashboardMetrics();
    } else if (pageId === 'riwayat') {
        renderHistory();
    } else if (pageId === 'buat-penawaran') {
        updateLivePreview();
    }
}

/**
 * Responsive Sidebar Toggle
 */
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
    
    // Create overlay if not exist
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }
}

// --- Data Synchronization (LocalStorage) ---

/**
 * Save settings to LocalStorage and SQL Database
 */
async function saveSettings() {
    companySettings.name = document.getElementById('settings-co-name').value.trim();
    companySettings.address = document.getElementById('settings-co-address').value.trim();
    companySettings.contact = document.getElementById('settings-co-contact').value.trim();
    companySettings.sigName = document.getElementById('settings-co-sig-name').value.trim();
    companySettings.sigTitle = document.getElementById('settings-co-sig-title').value.trim();
    
    // Parse default notes from textarea
    const notesText = document.getElementById('settings-default-notes').value;
    companySettings.defaultNotes = notesText.split('\n').map(n => n.trim()).filter(n => n !== '');

    localStorage.setItem('ltudo_settings', JSON.stringify(companySettings));
    
    if (useApi) {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(companySettings)
            });
        } catch (e) {
            console.error("Failed to save settings to SQL database", e);
        }
    }
    
    // Update active company info
    document.getElementById('preview-company-name').innerText = companySettings.name;
    document.getElementById('preview-company-address').innerText = companySettings.address;
    document.getElementById('preview-company-contact').innerText = companySettings.contact;
    document.getElementById('preview-sig-company').innerText = companySettings.sigName;
    document.getElementById('preview-sig-company-title').innerText = companySettings.sigTitle;

    // Update Dashboard Company widget
    document.getElementById('dash-company-name').innerText = companySettings.name;
    document.getElementById('dash-company-address').innerText = companySettings.address;

    alert("Pengaturan perusahaan berhasil disimpan!");
    updateLivePreview();
}

/**
 * Load settings from SQL Database or LocalStorage
 */
async function loadSettings() {
    let settingsLoaded = false;
    
    if (useApi) {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data && data.name) {
                companySettings = data;
                settingsLoaded = true;
            }
        } catch (e) {
            console.error("Failed to load settings from SQL database, falling back to LocalStorage", e);
        }
    }

    if (!settingsLoaded) {
        const saved = localStorage.getItem('ltudo_settings');
        if (saved) {
            try {
                companySettings = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse settings, reloading defaults", e);
                companySettings = { ...defaultCompanySettings };
            }
        } else {
            companySettings = { ...defaultCompanySettings };
            localStorage.setItem('ltudo_settings', JSON.stringify(companySettings));
        }
    }

    // Populate Settings Form Fields
    document.getElementById('settings-co-name').value = companySettings.name;
    document.getElementById('settings-co-address').value = companySettings.address;
    document.getElementById('settings-co-contact').value = companySettings.contact;
    document.getElementById('settings-co-sig-name').value = companySettings.sigName;
    document.getElementById('settings-co-sig-title').value = companySettings.sigTitle;
    document.getElementById('settings-default-notes').value = companySettings.defaultNotes.join('\n');

    // Populate Preview Headers immediately
    document.getElementById('preview-company-name').innerText = companySettings.name;
    document.getElementById('preview-company-address').innerText = companySettings.address;
    document.getElementById('preview-company-contact').innerText = companySettings.contact;
    document.getElementById('preview-sig-company').innerText = companySettings.sigName;
    document.getElementById('preview-sig-company-title').innerText = companySettings.sigTitle;

    // Dashboard Company Preview widget
    document.getElementById('dash-company-name').innerText = companySettings.name;
    document.getElementById('dash-company-address').innerText = companySettings.address;
}

/**
 * Load saved quotations history list from SQL Database or LocalStorage
 */
async function loadHistory() {
    let historyLoaded = false;
    
    if (useApi) {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            if (Array.isArray(data)) {
                quotationHistory = data;
                historyLoaded = true;
            }
        } catch (e) {
            console.error("Failed to load history from SQL database, falling back to LocalStorage", e);
        }
    }

    if (!historyLoaded) {
        const saved = localStorage.getItem('ltudo_history');
        if (saved) {
            try {
                quotationHistory = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse history", e);
                quotationHistory = [];
            }
        } else {
            // Seed database with mock history data for premium design wow factor
            seedMockHistory();
        }
    }
}

/**
 * Seeds starting mock records in history to make the Dashboard look instantly professional
 */
function seedMockHistory() {
    console.log("Seeding mock history records for demonstration...");
    const baseDate = new Date();
    
    // Sample 1: Ruko Office
    const date1 = new Date();
    date1.setDate(baseDate.getDate() - 10);
    const date1Str = date1.toISOString().split('T')[0];
    
    const mock1 = {
        id: "quote_mock_1",
        number: `LT/${date1.getFullYear()}/${String(date1.getMonth() + 1).padStart(2, '0')}/001`,
        customerName: "Ibu Amanda Wijaya",
        customerAddress: "Ruko Sentra Boulevard Blok C/12, Gading Serpong",
        customerPhone: "0811-2233-4455",
        date: date1Str,
        sections: [
            {
                id: "ms1_s1",
                title: "Main Receptionist Desk",
                items: [
                    { id: "ms1_i1", name: "Meja Resepsionis Lapis HPL", volume: "3.0 m1", qty: 3, price: 3500000, notes: "Bentuk L, Fitting Soft-close" },
                    { id: "ms1_i2", name: "Backdrop Lobby & Logo Board", volume: "9.0 m2", qty: 9, price: 1800000, notes: "Finishing Taco Woodgrain, Backlight LED" }
                ]
            }
        ],
        notes: [
            "Bahan dasar Multiplek 18mm.",
            "Finishing HPL Taco / setara.",
            "Sudah termasuk pengiriman dan instalasi di lokasi."
        ]
    };

    // Sample 2: Bedroom Apartment
    const date2 = new Date();
    date2.setDate(baseDate.getDate() - 2);
    const date2Str = date2.toISOString().split('T')[0];
    
    const mock2 = {
        id: "quote_mock_2",
        number: `LT/${date2.getFullYear()}/${String(date2.getMonth() + 1).padStart(2, '0')}/002`,
        customerName: "Bapak Ryan Hidayat",
        customerAddress: "Apartemen BSD Kemang Unit 24-05, Jakarta Selatan",
        customerPhone: "0857-1234-5678",
        date: date2Str,
        sections: [
            {
                id: "ms2_s1",
                title: "Master Bedroom Wardrobe",
                items: [
                    { id: "ms2_i1", name: "Wardrobe Tinggi Plafon (Pintu Slide)", volume: "2.2 m1", qty: 2.2, price: 3300000, notes: "Pintu cermin full, aksesoris gantungan hidrolik" },
                    { id: "ms2_i2", name: "Meja Rias Gantung", volume: "1.2 m1", qty: 1.2, price: 2800000, notes: "Finishing HPL, include cermin bundar LED" }
                ]
            }
        ],
        notes: [
            "Bahan dasar Multiplek 18mm.",
            "Finishing HPL Taco premium.",
            "Termasuk cermin LED bulat diameter 60cm."
        ]
    };

    quotationHistory = [mock1, mock2];
    localStorage.setItem('ltudo_history', JSON.stringify(quotationHistory));
}

/**
 * Load current working quotation from SQL Database or LocalStorage
 */
async function loadLocal() {
    let activeLoaded = false;
    
    if (useApi) {
        try {
            const res = await fetch('/api/active');
            const data = await res.json();
            if (data && (data.number || data.customerName || (data.sections && data.sections.length > 0))) {
                currentQuotation = data;
                activeLoaded = true;
            }
        } catch (e) {
            console.error("Failed to load active quotation from SQL database, falling back to LocalStorage", e);
        }
    }

    if (!activeLoaded) {
        const savedActive = localStorage.getItem('ltudo_active_quotation');
        if (savedActive) {
            try {
                currentQuotation = JSON.parse(savedActive);
            } catch (e) {
                console.error("Failed to parse active quotation, resetting", e);
                createNewQuotation();
                return;
            }
        } else {
            createNewQuotation();
            return;
        }
    }

    // Populate form fields
    document.getElementById('cust-name').value = currentQuotation.customerName || '';
    document.getElementById('cust-address').value = currentQuotation.customerAddress || '';
    document.getElementById('cust-phone').value = currentQuotation.customerPhone || '';
    document.getElementById('cust-date').value = currentQuotation.date || '';
    document.getElementById('cust-number').value = currentQuotation.number || '';

    renderQuotation();
    updateLivePreview();
}
const loadActiveQuotation = loadLocal;

/**
 * Save active quotation state to SQL Database and LocalStorage
 */
async function saveLocal() {
    localStorage.setItem('ltudo_active_quotation', JSON.stringify(currentQuotation));
    
    if (useApi) {
        try {
            await fetch('/api/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentQuotation)
            });
        } catch (e) {
            console.error("Failed to save active quotation to SQL database", e);
        }
    }
}
const saveActiveQuotationLocal = saveLocal;

// --- core CRUD functions ---

/**
 * Initialize a fresh quotation in editor memory
 */
function createNewQuotation() {
    // Deep clone template
    currentQuotation = JSON.parse(JSON.stringify(emptyQuotationTemplate));
    
    // Set date to today
    const today = new Date().toISOString().split('T')[0];
    currentQuotation.date = today;
    
    // Assign custom quotation code
    currentQuotation.number = generateQuotationNumber();
    
    // Assign standard default notes
    currentQuotation.notes = [...companySettings.defaultNotes];
    
    // Clear editor active ID (it's a new unsaved quotation)
    currentQuotation.id = "";

    saveActiveQuotationLocal();
    
    // Populate form fields
    document.getElementById('cust-name').value = currentQuotation.customerName;
    document.getElementById('cust-address').value = currentQuotation.customerAddress;
    document.getElementById('cust-phone').value = currentQuotation.customerPhone;
    document.getElementById('cust-date').value = currentQuotation.date;
    document.getElementById('cust-number').value = currentQuotation.number;

    renderQuotation();
    updateLivePreview();
}

/**
 * Generate a standard invoice/quotation number sequentially based on records in current month
 */
function generateQuotationNumber() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    
    // Filter history of current month/year
    const prefix = `LT/${year}/${month}/`;
    const matchCount = quotationHistory.filter(q => q.number && q.number.startsWith(prefix)).length;
    
    const nextNumber = String(matchCount + 1).padStart(3, '0');
    return `${prefix}${nextNumber}`;
}

/**
 * Re-generates a new quotation number manually on request
 */
function regenerateQuotationNumber() {
    const num = generateQuotationNumber();
    document.getElementById('cust-number').value = num;
    currentQuotation.number = num;
    saveActiveQuotationLocal();
    updateLivePreview();
}

/**
 * Calculate totals of active quotation
 */
function calculateTotal() {
    let grandTotal = 0;
    
    if (currentQuotation.sections) {
        currentQuotation.sections.forEach(section => {
            let sectionSubtotal = 0;
            if (section.items) {
                section.items.forEach(item => {
                    const qty = parseFloat(item.qty) || 0;
                    const price = parseFloat(item.price) || 0;
                    const total = qty * price;
                    item.total = total; // Cache total on item
                    sectionSubtotal += total;
                });
            }
            section.subtotal = sectionSubtotal; // Cache subtotal
            grandTotal += sectionSubtotal;
        });
    }
    
    currentQuotation.grandTotal = grandTotal;
    return grandTotal;
}

/**
 * Add a new job section
 */
function addSection(title = "") {
    const newSectionId = "sec_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const newSection = {
        id: newSectionId,
        title: title || `Pekerjaan ${currentQuotation.sections.length + 1}`,
        items: []
    };
    
    currentQuotation.sections.push(newSection);
    
    // Auto add one empty item row in the new section for clean workflow
    addItem(newSectionId);
    
    saveActiveQuotationLocal();
    renderQuotation();
    updateLivePreview();
}

/**
 * Delete a job section
 */
function deleteSection(sectionId) {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh rincian pekerjaan ini?")) {
        currentQuotation.sections = currentQuotation.sections.filter(s => s.id !== sectionId);
        saveActiveQuotationLocal();
        renderQuotation();
        updateLivePreview();
    }
}

/**
 * Add an item to a section
 */
function addItem(sectionId) {
    const section = currentQuotation.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const newItemId = "item_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const newItem = {
        id: newItemId,
        name: "",
        volume: "",
        qty: 1,
        price: 0,
        notes: ""
    };
    
    section.items.push(newItem);
    saveActiveQuotationLocal();
    renderQuotation();
    updateLivePreview();
}

/**
 * Delete an item from a section
 */
function deleteItem(sectionId, itemId) {
    const section = currentQuotation.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    section.items = section.items.filter(i => i.id !== itemId);
    saveActiveQuotationLocal();
    renderQuotation();
    updateLivePreview();
}

/**
 * Update dynamic text item in currentQuotation object on form edit
 */
function syncFormData() {
    currentQuotation.customerName = document.getElementById('cust-name').value.trim();
    currentQuotation.customerPhone = document.getElementById('cust-phone').value.trim();
    currentQuotation.customerAddress = document.getElementById('cust-address').value.trim();
    currentQuotation.date = document.getElementById('cust-date').value;
    currentQuotation.number = document.getElementById('cust-number').value.trim();

    // Synchronize section and item inputs
    currentQuotation.sections.forEach(section => {
        // Section Title Input
        const sTitleInput = document.getElementById(`input-sec-title-${section.id}`);
        if (sTitleInput) {
            section.title = sTitleInput.value.trim();
        }

        // Section Items
        section.items.forEach(item => {
            const iName = document.getElementById(`input-item-name-${item.id}`);
            const iVolume = document.getElementById(`input-item-volume-${item.id}`);
            const iQty = document.getElementById(`input-item-qty-${item.id}`);
            const iPrice = document.getElementById(`input-item-price-${item.id}`);
            const iNotes = document.getElementById(`input-item-notes-${item.id}`);

            if (iName) item.name = iName.value.trim();
            if (iVolume) item.volume = iVolume.value.trim();
            if (iQty) item.qty = parseFloat(iQty.value) || 0;
            if (iPrice) item.price = parseFloat(iPrice.value) || 0;
            if (iNotes) item.notes = iNotes.value.trim();
        });
    });

    // Synchronize notes (NB) list
    const noteInputs = document.querySelectorAll('.note-item-input');
    currentQuotation.notes = [];
    noteInputs.forEach(input => {
        const val = input.value.trim();
        currentQuotation.notes.push(val);
    });

    saveActiveQuotationLocal();
}

/**
 * Triggers re-calculation and redraws the paper preview in real-time
 */
function updateLivePreview() {
    syncFormData();
    calculateTotal();
    renderPreview();
}

/**
 * Renders the Quotation Form Editor (Left column)
 */
function renderQuotation() {
    // Synchronize number badge
    document.getElementById('form-quotation-number-badge').innerText = currentQuotation.number || '-';
    
    // Clear list container
    const container = document.getElementById('sections-container');
    container.innerHTML = "";

    if (!currentQuotation.sections || currentQuotation.sections.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 border rounded-3 bg-white mb-4">
                <i class="bi bi-folder2-open text-muted fs-1 mb-2"></i>
                <p class="text-muted">Rincian pekerjaan masih kosong.</p>
                <button class="btn btn-accent btn-sm rounded-pill px-3 shadow-sm" onclick="addSection()">
                    <i class="bi bi-plus-lg me-1"></i>Tambah Pekerjaan Pertama
                </button>
            </div>
        `;
        return;
    }

    // Build each section card
    currentQuotation.sections.forEach((section, sIndex) => {
        const sectionCard = document.createElement('div');
        sectionCard.className = "card main-card section-card mb-4";
        sectionCard.innerHTML = `
            <div class="card-header-custom d-flex justify-content-between align-items-center bg-light bg-opacity-50 py-2.5">
                <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold text-accent font-monospace">${sIndex + 1}.</span>
                    <input type="text" 
                           class="section-input-title" 
                           id="input-sec-title-${section.id}" 
                           value="${escapeHtml(section.title)}" 
                           placeholder="Nama Pekerjaan (Contoh: Kitchen Set)" 
                           oninput="updateLivePreview()">
                </div>
                <button class="btn btn-outline-danger btn-xs-custom rounded-pill" onclick="deleteSection('${section.id}')">
                    <i class="bi bi-trash-fill me-1"></i>Hapus Pekerjaan
                </button>
            </div>
            <div class="card-body-custom px-3 py-3">
                <div class="table-responsive">
                    <table class="table align-middle form-item-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Nama Item</th>
                                <th style="width: 15%;">Volume</th>
                                <th style="width: 10%;">Qty</th>
                                <th style="width: 20%;">Harga Satuan</th>
                                <th style="width: 20%;">Catatan</th>
                                <th style="width: 10%;" class="text-end">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="items-tbody-${section.id}">
                            <!-- Item rows will be loaded here -->
                        </tbody>
                    </table>
                </div>
                
                <div class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top gap-3">
                    <button class="btn btn-outline-primary btn-xs-custom rounded-pill" onclick="addItem('${section.id}')">
                        <i class="bi bi-plus-lg me-1"></i>Tambah Item Pekerjaan
                    </button>
                    <div class="section-subtotal-area text-secondary fw-semibold">
                        Subtotal Pekerjaan: <span class="text-primary font-monospace ms-1" id="label-subtotal-${section.id}">Rp 0</span>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(sectionCard);
        
        // Render items inside this section
        const tbody = document.getElementById(`items-tbody-${section.id}`);
        const items = section.items || [];
        
        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-3 text-muted small">Belum ada item di pekerjaan ini. Klik "Tambah Item".</td>
                </tr>
            `;
        } else {
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <input type="text" class="form-control form-control-sm form-input-custom" 
                               id="input-item-name-${item.id}" value="${escapeHtml(item.name)}" 
                               placeholder="Nama item" oninput="updateLivePreview()">
                    </td>
                    <td>
                        <input type="text" class="form-control form-control-sm form-input-custom" 
                               id="input-item-volume-${item.id}" value="${escapeHtml(item.volume)}" 
                               placeholder="PxLxT / m1" oninput="updateLivePreview()">
                    </td>
                    <td>
                        <input type="number" step="any" min="0" class="form-control form-control-sm form-input-custom text-center" 
                               id="input-item-qty-${item.id}" value="${item.qty}" 
                               placeholder="Qty" oninput="updateLivePreview()">
                    </td>
                    <td>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-light text-muted border-slate-200">Rp</span>
                            <input type="number" step="1000" min="0" class="form-control form-control-sm form-input-custom" 
                                   id="input-item-price-${item.id}" value="${item.price}" 
                                   placeholder="Harga" oninput="updateLivePreview()">
                        </div>
                    </td>
                    <td>
                        <input type="text" class="form-control form-control-sm form-input-custom" 
                               id="input-item-notes-${item.id}" value="${escapeHtml(item.notes)}" 
                               placeholder="Catatan tambahan" oninput="updateLivePreview()">
                    </td>
                    <td class="text-end">
                        <button class="item-delete-btn" onclick="deleteItem('${section.id}', '${item.id}')" title="Hapus Item">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        // Update subtotal display
        const subVal = section.subtotal || 0;
        document.getElementById(`label-subtotal-${section.id}`).innerText = formatRupiah(subVal);
    });

    // Render Note (NB) Editor list
    const notesContainer = document.getElementById('notes-container');
    notesContainer.innerHTML = "";
    
    if (currentQuotation.notes && currentQuotation.notes.length > 0) {
        currentQuotation.notes.forEach((note, index) => {
            const row = document.createElement('div');
            row.className = "note-item-row";
            row.innerHTML = `
                <span class="text-muted fw-bold font-monospace">•</span>
                <input type="text" class="form-control form-control-sm form-input-custom note-item-input flex-grow-1" 
                       value="${escapeHtml(note)}" placeholder="Isi catatan ketentuan..." oninput="updateLivePreview()">
                <button class="btn btn-outline-danger btn-xs py-1" onclick="deleteNoteItem(${index})" title="Hapus Catatan">
                    <i class="bi bi-x-lg"></i>
                </button>
            `;
            notesContainer.appendChild(row);
        });
    } else {
        notesContainer.innerHTML = `<p class="text-muted small text-center mb-0 py-2">Belum ada catatan tambahan (NB).</p>`;
    }
}

/**
 * Add note item in NB container
 */
function addNoteItem() {
    if (!currentQuotation.notes) currentQuotation.notes = [];
    currentQuotation.notes.push("");
    saveActiveQuotationLocal();
    renderQuotation();
    updateLivePreview();
}

/**
 * Delete note item by index
 */
function deleteNoteItem(index) {
    if (currentQuotation.notes) {
        currentQuotation.notes.splice(index, 1);
        saveActiveQuotationLocal();
        renderQuotation();
        updateLivePreview();
    }
}

/**
 * Renders the PDF/Print A4 paper representation (Right column)
 */
function renderPreview() {
    // Fill text metadata values
    document.getElementById('preview-quote-number').innerText = currentQuotation.number || 'LT/2026/07/000';
    document.getElementById('preview-quote-date').innerText = formatDateIndo(currentQuotation.date || new Date().toISOString().split('T')[0]);
    document.getElementById('preview-cust-name').innerText = currentQuotation.customerName || '[Nama Pelanggan]';
    document.getElementById('preview-cust-address').innerText = currentQuotation.customerAddress || '[Alamat Project]';
    document.getElementById('preview-cust-phone').innerText = currentQuotation.customerPhone || '';
    
    document.getElementById('preview-sig-customer').innerText = currentQuotation.customerName || '[Nama Pelanggan]';

    // Build table content
    const tbody = document.getElementById('preview-items-body');
    tbody.innerHTML = "";

    if (!currentQuotation.sections || currentQuotation.sections.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted font-monospace">Belum ada rincian pekerjaan yang ditambahkan.</td>
            </tr>
        `;
        document.getElementById('preview-grand-total').innerText = "Rp 0";
        return;
    }

    let globalCounter = 1;

    currentQuotation.sections.forEach((section, sIndex) => {
        // Section Header Row
        const secTr = document.createElement('tr');
        secTr.className = "section-row-print";
        secTr.innerHTML = `
            <td class="text-center font-monospace">${sIndex + 1}</td>
            <td colspan="5" class="fw-bold text-uppercase">${escapeHtml(section.title)}</td>
        `;
        tbody.appendChild(secTr);

        // Section Items
        const items = section.items || [];
        if (items.length === 0) {
            const emptyTr = document.createElement('tr');
            emptyTr.innerHTML = `
                <td></td>
                <td colspan="5" class="text-muted small italic">Tidak ada item rincian pekerjaan.</td>
            `;
            tbody.appendChild(emptyTr);
        } else {
            // alphabet index tracking for subitems
            const alphabet = "abcdefghijklmnopqrstuvwxyz";
            items.forEach((item, iIndex) => {
                const subItemChar = alphabet[iIndex % alphabet.length];
                const tr = document.createElement('tr');
                
                // Details formatting: includes name and note below
                let descContent = `<strong>${escapeHtml(item.name || 'Item Pekerjaan')}</strong>`;
                if (item.notes) {
                    descContent += `<div class="item-specs-preview">Spesifikasi: ${escapeHtml(item.notes)}</div>`;
                }

                const totalVal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);

                tr.innerHTML = `
                    <td class="text-center text-muted font-monospace">${subItemChar}.</td>
                    <td>${descContent}</td>
                    <td class="text-center font-monospace text-nowrap">${escapeHtml(item.volume || '-')}</td>
                    <td class="text-center font-monospace text-nowrap">${item.qty}</td>
                    <td class="text-end font-monospace text-nowrap">${formatRupiah(item.price)}</td>
                    <td class="text-end font-monospace fw-semibold text-nowrap">${formatRupiah(totalVal)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Section Subtotal Row
        const subTr = document.createElement('tr');
        subTr.className = "subtotal-row-print";
        subTr.innerHTML = `
            <td colspan="5" class="text-end fw-semibold text-nowrap">Subtotal ${escapeHtml(section.title)}:</td>
            <td class="text-end fw-semibold font-monospace text-nowrap">${formatRupiah(section.subtotal || 0)}</td>
        `;
        tbody.appendChild(subTr);
    });

    // Update Grand Total in Preview
    const grandVal = currentQuotation.grandTotal || 0;
    document.getElementById('preview-grand-total').innerText = formatRupiah(grandVal);

    // Build Notes list
    const notesUl = document.getElementById('preview-notes-list');
    notesUl.innerHTML = "";
    const activeNotes = (currentQuotation.notes || []).filter(note => note.trim() !== "");
    if (activeNotes.length > 0) {
        activeNotes.forEach(note => {
            const li = document.createElement('li');
            li.innerText = note;
            notesUl.appendChild(li);
        });
    } else {
        notesUl.innerHTML = `<li class="text-muted italic">Tidak ada catatan syarat & ketentuan khusus.</li>`;
    }

    // 100% WYSIWYG: Clone screen preview directly to the print container
    const printArea = document.getElementById('quotation-print-area');
    const printTarget = document.getElementById('quotation-print');
    if (printArea && printTarget) {
        const clone = printArea.cloneNode(true);
        clone.id = "quotation-print-clone"; // Rename ID to avoid duplicate DOM IDs
        printTarget.innerHTML = "";
        printTarget.appendChild(clone);
    }
}

// --- Invoice Action Handlers ---

/**
 * Save current quotation to History list, LocalStorage and SQL Database
 */
async function saveQuotation() {
    syncFormData();
    calculateTotal();
    
    if (!currentQuotation.customerName) {
        alert("Mohon masukkan nama customer terlebih dahulu.");
        document.getElementById('cust-name').focus();
        return;
    }

    // Check if we are updating an existing quotation
    const isNew = !currentQuotation.id;
    if (isNew) {
        currentQuotation.id = "quote_" + Date.now();
        quotationHistory.unshift({ ...currentQuotation }); // add to beginning of list
    } else {
        // update existing in array
        const idx = quotationHistory.findIndex(q => q.id === currentQuotation.id);
        if (idx !== -1) {
            quotationHistory[idx] = { ...currentQuotation };
        } else {
            quotationHistory.unshift({ ...currentQuotation });
        }
    }

    localStorage.setItem('ltudo_history', JSON.stringify(quotationHistory));
    await saveActiveQuotationLocal();

    if (useApi) {
        try {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentQuotation)
            });
        } catch (e) {
            console.error("Failed to save quotation to SQL database", e);
        }
    }

    alert(`Penawaran ${currentQuotation.number} berhasil DISIMPAN ke Riwayat!`);
    updateDashboardMetrics();
    renderHistory();
    updateDatabaseStatus();
}

/**
 * Trigger CSS-print window. Handles browser page printing.
 */
function printQuotation() {
    // Automatically save active quota status before printing so changes are not lost
    syncFormData();
    calculateTotal();
    saveActiveQuotationLocal();

    // Print
    window.print();
}

/**
 * Reset form input back to blank template state
 */
function resetQuotationForm() {
    if (confirm("Apakah Anda yakin ingin me-reset form penawaran? Semua data pekerjaan yang belum disimpan di riwayat akan hilang.")) {
        createNewQuotation();
    }
}

// --- History List Handlers ---

/**
 * Renders the Quotation list under History page
 */
function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    const recentBody = document.getElementById('dash-recent-list');
    const searchVal = document.getElementById('search-history').value.toLowerCase().trim();

    // Filter array
    const filtered = quotationHistory.filter(q => {
        const numberMatch = q.number && q.number.toLowerCase().includes(searchVal);
        const nameMatch = q.customerName && q.customerName.toLowerCase().includes(searchVal);
        return numberMatch || nameMatch;
    });

    // 1. Render main History table
    tbody.innerHTML = "";
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-muted">
                    <i class="bi bi-folder-x fs-2 mb-2"></i>
                    <p class="mb-0">Tidak ada riwayat penawaran ditemukan.</p>
                </td>
            </tr>
        `;
    } else {
        filtered.forEach(q => {
            const tr = document.createElement('tr');
            
            // Calculate totals for safety
            let gt = q.grandTotal;
            if (gt === undefined) {
                let tempTotal = 0;
                q.sections.forEach(s => {
                    let sTotal = 0;
                    s.items.forEach(i => { sTotal += (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0); });
                    tempTotal += sTotal;
                });
                gt = tempTotal;
            }

            tr.innerHTML = `
                <td class="fw-semibold text-primary font-monospace">${escapeHtml(q.number || '-')}</td>
                <td>
                    <div class="fw-bold">${escapeHtml(q.customerName || '-')}</div>
                    <div class="text-muted small text-truncate" style="max-width: 300px;">${escapeHtml(q.customerAddress || '')}</div>
                </td>
                <td class="font-monospace">${formatDateIndo(q.date)}</td>
                <td class="text-end fw-bold font-monospace text-secondary">${formatRupiah(gt)}</td>
                <td class="text-center">
                    <div class="d-flex justify-content-center gap-1">
                        <button class="btn btn-xs btn-outline-info btn-action-table" onclick="loadQuotationToView('${q.id}')" title="Lihat Preview">
                            <i class="bi bi-eye"></i> Lihat
                        </button>
                        <button class="btn btn-xs btn-outline-primary btn-action-table" onclick="loadQuotationToEdit('${q.id}')" title="Edit Form">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-xs btn-outline-warning btn-action-table" onclick="duplicateQuotation('${q.id}')" title="Duplikasi">
                            <i class="bi bi-copy"></i> Duplikat
                        </button>
                        <button class="btn btn-xs btn-outline-danger btn-action-table" onclick="deleteHistoryItem('${q.id}')" title="Hapus">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 2. Render recent list on Dashboard (max 5 records)
    recentBody.innerHTML = "";
    const recentQuotes = quotationHistory.slice(0, 5);
    
    if (recentQuotes.length === 0) {
        recentBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">Belum ada penawaran. Klik tombol aksi cepat untuk membuat baru.</td>
            </tr>
        `;
    } else {
        recentQuotes.forEach(q => {
            const tr = document.createElement('tr');
            
            // Calculate totals
            let gt = q.grandTotal;
            if (gt === undefined) {
                let tempTotal = 0;
                q.sections.forEach(s => {
                    let sTotal = 0;
                    s.items.forEach(i => { sTotal += (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0); });
                    tempTotal += sTotal;
                });
                gt = tempTotal;
            }

            tr.innerHTML = `
                <td class="fw-semibold text-primary font-monospace">${escapeHtml(q.number || '-')}</td>
                <td class="fw-bold">${escapeHtml(q.customerName || '-')}</td>
                <td class="font-monospace">${formatDateIndo(q.date)}</td>
                <td class="fw-bold text-secondary font-monospace">${formatRupiah(gt)}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-xs btn-outline-primary" onclick="loadQuotationToEdit('${q.id}')" title="Edit Form">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            `;
            recentBody.appendChild(tr);
        });
    }
}

/**
 * Load a quote in Read-Only view, scrolling and focusing on Preview
 */
function loadQuotationToView(id) {
    const q = quotationHistory.find(item => item.id === id);
    if (!q) return;

    // Set current active quotation to this object
    currentQuotation = JSON.parse(JSON.stringify(q));
    saveActiveQuotationLocal();

    // Populate form fields
    document.getElementById('cust-name').value = currentQuotation.customerName;
    document.getElementById('cust-address').value = currentQuotation.customerAddress;
    document.getElementById('cust-phone').value = currentQuotation.customerPhone;
    document.getElementById('cust-date').value = currentQuotation.date;
    document.getElementById('cust-number').value = currentQuotation.number;

    renderQuotation();
    updateLivePreview();
    
    // Switch to page
    switchPage('buat-penawaran');
    
    // Scroll view automatically to the preview paper area
    setTimeout(() => {
        document.querySelector('.preview-panel').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

/**
 * Load a quote into Edit form, switching pages
 */
function loadQuotationToEdit(id) {
    const q = quotationHistory.find(item => item.id === id);
    if (!q) return;

    // Load copy
    currentQuotation = JSON.parse(JSON.stringify(q));
    saveActiveQuotationLocal();

    // Populate inputs
    document.getElementById('cust-name').value = currentQuotation.customerName;
    document.getElementById('cust-address').value = currentQuotation.customerAddress;
    document.getElementById('cust-phone').value = currentQuotation.customerPhone;
    document.getElementById('cust-date').value = currentQuotation.date;
    document.getElementById('cust-number').value = currentQuotation.number;

    renderQuotation();
    updateLivePreview();

    switchPage('buat-penawaran');
}

/**
 * Duplicate a saved quote, generating a new Quotation Code automatically
 */
function duplicateQuotation(id) {
    const q = quotationHistory.find(item => item.id === id);
    if (!q) return;

    // Create deep copy
    const dup = JSON.parse(JSON.stringify(q));
    
    // Assign fresh values
    dup.id = "";
    dup.date = new Date().toISOString().split('T')[0];
    dup.number = generateQuotationNumber();
    dup.customerName = `${dup.customerName} (Salinan)`;
    
    // Set as active
    currentQuotation = dup;
    saveActiveQuotationLocal();

    // Populate inputs
    document.getElementById('cust-name').value = currentQuotation.customerName;
    document.getElementById('cust-address').value = currentQuotation.customerAddress;
    document.getElementById('cust-phone').value = currentQuotation.customerPhone;
    document.getElementById('cust-date').value = currentQuotation.date;
    document.getElementById('cust-number').value = currentQuotation.number;

    renderQuotation();
    updateLivePreview();

    switchPage('buat-penawaran');
    alert("Penawaran berhasil diduplikasi. Silakan simpan untuk memasukkannya ke riwayat.");
}

/**
 * Delete quotation record from history list, LocalStorage and SQL Database
 */
async function deleteHistoryItem(id) {
    const q = quotationHistory.find(item => item.id === id);
    if (!q) return;

    if (confirm(`Apakah Anda yakin ingin menghapus penawaran ${q.number} milik ${q.customerName} secara permanen?`)) {
        quotationHistory = quotationHistory.filter(item => item.id !== id);
        localStorage.setItem('ltudo_history', JSON.stringify(quotationHistory));
        
        if (useApi) {
            try {
                await fetch(`/api/history/${id}`, {
                    method: 'DELETE'
                });
            } catch (e) {
                console.error("Failed to delete quotation from SQL database", e);
            }
        }
        
        // If the current active quotation was this one, reset the editor form
        if (currentQuotation.id === id) {
            createNewQuotation();
        }

        renderHistory();
        updateDashboardMetrics();
        updateDatabaseStatus();
    }
}

// --- Dashboard Indicators Calculator ---

/**
 * Update Dashboard metrics boxes
 */
function updateDashboardMetrics() {
    // count total quotes
    const totalCount = quotationHistory.length;
    document.getElementById('dash-total-qty').innerText = totalCount;

    // sum total value
    let totalSum = 0;
    let monthSum = 0;
    
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1; // 1-12

    quotationHistory.forEach(q => {
        let qValue = 0;
        
        // Sum sections
        if (q.sections) {
            q.sections.forEach(s => {
                if (s.items) {
                    s.items.forEach(i => {
                        qValue += (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0);
                    });
                }
            });
        }
        
        totalSum += qValue;

        // Parse date for monthly calculation
        if (q.date) {
            const qD = new Date(q.date);
            if (qD.getFullYear() === curYear && (qD.getMonth() + 1) === curMonth) {
                monthSum++;
            }
        }
    });

    document.getElementById('dash-total-value').innerText = formatRupiah(totalSum);
    document.getElementById('dash-total-month').innerText = monthSum;
    
    // Average
    const avg = totalCount > 0 ? (totalSum / totalCount) : 0;
    document.getElementById('dash-avg-value').innerText = formatRupiah(avg);
}

// --- Settings & Recovery ---

/**
 * Clear all data from application and restore default seeded values
 */
async function clearAllData() {
    if (confirm("PERINGATAN: Tindakan ini akan menghapus semua riwayat penawaran dan pengaturan Anda secara permanen. Apakah Anda ingin melanjutkan?")) {
        localStorage.clear();
        if (useApi) {
            try {
                await fetch('/api/reset', { method: 'POST' });
            } catch (e) {
                console.error("Failed to reset SQL database", e);
            }
        }
        alert("Semua data berhasil dibersihkan! Aplikasi akan dimuat ulang.");
        location.reload();
    }
}

// --- Formatting Helpers ---

/**
 * Helper to convert double digits or floats to standard Indonesian currency text
 */
function formatRupiah(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return 'Rp 0';
    let number = parseFloat(angka);
    // Format: Rp 3.250.000
    return 'Rp ' + number.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Convert YYYY-MM-DD to Indonesian Date format
 * e.g. 2026-07-08 -> 8 Juli 2026
 */
function formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const year = parts[0];
    const monthIndex = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    return `${day} ${months[monthIndex]} ${year}`;
}

/**
 * HTML Escaper to prevent input scripts injections inside inputs preview rendering
 */
function escapeHtml(text) {
    if (!text) return "";
    return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- Database Backup & Restore Functions ---

/**
 * Update the UI badge showing the number of quotations in database
 */
function updateDatabaseStatus() {
    const badge = document.getElementById('db-status-badge');
    if (badge) {
        badge.innerText = `${quotationHistory.length} Penawaran`;
    }
}

/**
 * Export all data from LocalStorage to a JSON file
 */
function exportDatabase() {
    try {
        const database = {
            history: quotationHistory,
            settings: companySettings,
            activeQuotation: currentQuotation,
            exportedAt: new Date().toISOString(),
            version: "1.0.0"
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(database, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        
        const today = new Date().toISOString().split('T')[0];
        downloadAnchor.setAttribute("download", `ltudo_database_backup_${today}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    } catch (e) {
        console.error("Failed to export database", e);
        alert("Gagal melakukan pencadangan database: " + e.message);
    }
}

/**
 * Trigger file selection for importing database
 */
function triggerImportFile() {
    document.getElementById('database-import-file').click();
}

/**
 * Import database from JSON file and save to LocalStorage
 */
function importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Basic validation
            if (!importedData || (!importedData.history && !importedData.settings)) {
                throw new Error("Format file tidak valid. Pastikan file adalah backup database L-TUDO.");
            }

            if (confirm("Apakah Anda yakin ingin memulihkan database? Ini akan menimpa seluruh data dan riwayat penawaran saat ini.")) {
                if (importedData.settings) {
                    companySettings = importedData.settings;
                    localStorage.setItem('ltudo_settings', JSON.stringify(companySettings));
                }
                if (importedData.history) {
                    quotationHistory = importedData.history;
                    localStorage.setItem('ltudo_history', JSON.stringify(quotationHistory));
                }
                if (importedData.activeQuotation) {
                    currentQuotation = importedData.activeQuotation;
                    localStorage.setItem('ltudo_active_quotation', JSON.stringify(currentQuotation));
                }
                
                alert("Database berhasil dipulihkan! Halaman akan dimuat ulang.");
                location.reload();
            }
        } catch (err) {
            console.error("Failed to import database", err);
            alert("Gagal memulihkan database: " + err.message);
        }
        // Reset input value to allow selecting same file again
        event.target.value = '';
    };
    reader.readAsText(file);
}

