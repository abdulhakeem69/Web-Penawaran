const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Initialize Database
const fs = require('fs');
const dbFolder = (process.env.PROJECT_DOMAIN) ? path.join(__dirname, '.data') : __dirname;
if (dbFolder !== __dirname && !fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}
const dbPath = path.join(dbFolder, 'penawaran.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        // Enable Foreign Keys
        db.run("PRAGMA foreign_keys = ON;");

        // Settings Table
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id TEXT PRIMARY KEY,
                name TEXT,
                address TEXT,
                contact TEXT,
                sig_name TEXT,
                sig_title TEXT,
                default_notes TEXT -- Store default notes as JSON array string
            )
        `);

        // Quotations Table
        db.run(`
            CREATE TABLE IF NOT EXISTS quotations (
                id TEXT PRIMARY KEY,
                number TEXT,
                customer_name TEXT,
                customer_address TEXT,
                customer_phone TEXT,
                date TEXT,
                grand_total REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Sections Table
        db.run(`
            CREATE TABLE IF NOT EXISTS quotation_sections (
                id TEXT PRIMARY KEY,
                quotation_id TEXT,
                title TEXT,
                sort_order INTEGER,
                FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
            )
        `);

        // Items Table
        db.run(`
            CREATE TABLE IF NOT EXISTS quotation_items (
                id TEXT PRIMARY KEY,
                section_id TEXT,
                name TEXT,
                volume TEXT,
                qty REAL,
                price REAL,
                notes TEXT,
                sort_order INTEGER,
                FOREIGN KEY(section_id) REFERENCES quotation_sections(id) ON DELETE CASCADE
            )
        `);

        // Notes Table (NB)
        db.run(`
            CREATE TABLE IF NOT EXISTS quotation_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quotation_id TEXT,
                note_content TEXT,
                sort_order INTEGER,
                FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
            )
        `);

        // Active Quotation Table (Draft)
        db.run(`
            CREATE TABLE IF NOT EXISTS active_quotation (
                id TEXT PRIMARY KEY,
                data TEXT
            )
        `);

        // Seed mock data if quotations table is empty
        seedIfEmpty();
    });
}

function seedIfEmpty() {
    db.get("SELECT COUNT(*) as count FROM quotations", [], (err, row) => {
        if (err) {
            console.error("Error checking quotation count:", err);
            return;
        }
        if (row.count === 0) {
            console.log("Database is empty, seeding mock data...");
            seedMockData();
        }
    });
}

function seedMockData() {
    // Default company settings
    const defaultSettings = {
        id: "company_settings",
        name: "L-TUDO INTERIOR",
        address: "",
        contact: "Email: info@ltudo-interior.com | Web: www.ltudo-interior.com",
        sig_name: "L-TUDO Interior Design",
        sig_title: "Estimator & Interior Designer",
        default_notes: JSON.stringify([
            "Bahan dasar menggunakan Multiplek berkualitas tinggi ketebalan 18mm (Bukan MDF/Partikel Board).",
            "Finishing bagian luar HPL Taco / setara (Warna & motif disetujui customer).",
            "Finishing bagian dalam menggunakan melamin putih berkualitas.",
            "Aksesoris & hardware (engsel, rel laci) menggunakan Huben Slow Motion (Soft-close).",
            "Waktu produksi di workshop adalah 30-40 hari kerja terhitung sejak gambar kerja disetujui.",
            "Sistem pembayaran: DP 50% saat tanda tangan kontrak, Progress 40% saat barang dikirim, Pelunasan 10% setelah instalasi selesai."
        ])
    };

    db.run(
        `INSERT OR REPLACE INTO settings (id, name, address, contact, sig_name, sig_title, default_notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            defaultSettings.id,
            defaultSettings.name,
            defaultSettings.address,
            defaultSettings.contact,
            defaultSettings.sig_name,
            defaultSettings.sig_title,
            defaultSettings.default_notes
        ]
    );

    // Mock Quotation 1
    const baseDate = new Date();
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
        grandTotal: 26700000,
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

    // Mock Quotation 2
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
        grandTotal: 10620000,
        sections: [
            {
                id: "ms2_s1",
                title: "Master Bedroom Wardrobe",
                items: [
                    { id: "ms2_i1", name: "Wardrobe Tinggi Plafon (Pintu Slide)", volume: "2.2 m1", qty: 2.2, price: 3300000, notes: "Pintu cermin full, aksesoris gantungan hidrolik" },
                    { id: "ms2_i2", name: "Meja Rias Gantung", volume: "1.2 m1", qty: 1.2, price: 2800000, notes: "Finishing HPL, include cermin LED bulat diameter 60cm." }
                ]
            }
        ],
        notes: [
            "Bahan dasar Multiplek 18mm.",
            "Finishing HPL Taco premium.",
            "Termasuk cermin LED bulat diameter 60cm."
        ]
    };

    saveQuotationToDb(mock1);
    saveQuotationToDb(mock2);
}

function saveQuotationToDb(q, callback) {
    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");

        // Insert Quotation
        db.run(
            `INSERT OR REPLACE INTO quotations (id, number, customer_name, customer_address, customer_phone, date, grand_total) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [q.id, q.number, q.customerName, q.customerAddress, q.customerPhone, q.date, q.grandTotal],
            function(err) {
                if (err) {
                    db.run("ROLLBACK;");
                    if (callback) callback(err);
                    return;
                }
            }
        );

        // Delete existing relations to overwrite safely
        db.run(`DELETE FROM quotation_sections WHERE quotation_id = ?`, [q.id]);
        db.run(`DELETE FROM quotation_notes WHERE quotation_id = ?`, [q.id]);

        // Insert Sections & Items
        if (q.sections && q.sections.length > 0) {
            q.sections.forEach((section, sIndex) => {
                db.run(
                    `INSERT INTO quotation_sections (id, quotation_id, title, sort_order) VALUES (?, ?, ?, ?)`,
                    [section.id, q.id, section.title, sIndex],
                    function(err) {
                        if (err) {
                            db.run("ROLLBACK;");
                            if (callback) callback(err);
                            return;
                        }
                    }
                );

                if (section.items && section.items.length > 0) {
                    section.items.forEach((item, iIndex) => {
                        db.run(
                            `INSERT INTO quotation_items (id, section_id, name, volume, qty, price, notes, sort_order) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [item.id, section.id, item.name, item.volume, item.qty, item.price, item.notes, iIndex],
                            function(err) {
                                if (err) {
                                    db.run("ROLLBACK;");
                                    if (callback) callback(err);
                                    return;
                                }
                            }
                        );
                    });
                }
            });
        }

        // Insert Notes
        if (q.notes && q.notes.length > 0) {
            q.notes.forEach((note, nIndex) => {
                db.run(
                    `INSERT INTO quotation_notes (quotation_id, note_content, sort_order) VALUES (?, ?, ?)`,
                    [q.id, note, nIndex],
                    function(err) {
                        if (err) {
                            db.run("ROLLBACK;");
                            if (callback) callback(err);
                            return;
                        }
                    }
                );
            });
        }

        db.run("COMMIT;", (err) => {
            if (callback) callback(err);
        });
    });
}

// --- API ROUTES ---

// 1. Settings API
app.get('/api/settings', (req, res) => {
    db.get("SELECT * FROM settings WHERE id = 'company_settings'", [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.json({});
        }
        res.json({
            name: row.name,
            address: row.address,
            contact: row.contact,
            sigName: row.sig_name,
            sigTitle: row.sig_title,
            defaultNotes: JSON.parse(row.default_notes || '[]')
        });
    });
});

app.post('/api/settings', (req, res) => {
    const s = req.body;
    db.run(
        `INSERT OR REPLACE INTO settings (id, name, address, contact, sig_name, sig_title, default_notes) 
         VALUES ('company_settings', ?, ?, ?, ?, ?, ?)`,
        [s.name, s.address, s.contact, s.sigName, s.sigTitle, JSON.stringify(s.defaultNotes || [])],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

// 2. Active Draft API
app.get('/api/active', (req, res) => {
    db.get("SELECT data FROM active_quotation WHERE id = 'active_draft'", [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.json(null);
        }
        try {
            res.json(JSON.parse(row.data));
        } catch (e) {
            res.status(500).json({ error: "Failed to parse active draft" });
        }
    });
});

app.post('/api/active', (req, res) => {
    const dataStr = JSON.stringify(req.body);
    db.run(
        `INSERT OR REPLACE INTO active_quotation (id, data) VALUES ('active_draft', ?)`,
        [dataStr],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

// 3. History API (Retrieve all quotations, fully populated with sections and items)
app.get('/api/history', (req, res) => {
    // Step 1: Get all quotations
    db.all("SELECT * FROM quotations ORDER BY date DESC, created_at DESC", [], (err, quotes) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (quotes.length === 0) {
            return res.json([]);
        }

        let completed = 0;
        const result = [];

        quotes.forEach((q) => {
            const quotation = {
                id: q.id,
                number: q.number,
                customerName: q.customer_name,
                customerAddress: q.customer_address,
                customerPhone: q.customer_phone,
                date: q.date,
                grandTotal: q.grand_total,
                sections: [],
                notes: []
            };

            // Fetch sections
            db.all("SELECT * FROM quotation_sections WHERE quotation_id = ? ORDER BY sort_order", [q.id], (err, sections) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Fetch notes
                db.all("SELECT * FROM quotation_notes WHERE quotation_id = ? ORDER BY sort_order", [q.id], (err, notes) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    quotation.notes = notes.map(n => n.note_content);

                    if (sections.length === 0) {
                        result.push(quotation);
                        completed++;
                        if (completed === quotes.length) {
                            // Sort by date desc (matching the quotes order)
                            result.sort((a, b) => new Date(b.date) - new Date(a.date));
                            res.json(result);
                        }
                        return;
                    }

                    let sectionsCompleted = 0;
                    sections.forEach((sec) => {
                        const sectionObj = {
                            id: sec.id,
                            title: sec.title,
                            items: []
                        };

                        // Fetch items for section
                        db.all("SELECT * FROM quotation_items WHERE section_id = ? ORDER BY sort_order", [sec.id], (err, items) => {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }

                            sectionObj.items = items.map(i => ({
                                id: i.id,
                                name: i.name,
                                volume: i.volume,
                                qty: i.qty,
                                price: i.price,
                                notes: i.notes
                            }));

                            quotation.sections.push(sectionObj);
                            sectionsCompleted++;

                            if (sectionsCompleted === sections.length) {
                                // Keep sections sorted by database order (sort_order)
                                quotation.sections.sort((a, b) => {
                                    const secA = sections.find(s => s.id === a.id);
                                    const secB = sections.find(s => s.id === b.id);
                                    return secA.sort_order - secB.sort_order;
                                });

                                result.push(quotation);
                                completed++;

                                if (completed === quotes.length) {
                                    // Sort final result to match quotes descending order
                                    const quotesOrder = quotes.map(qu => qu.id);
                                    result.sort((a, b) => quotesOrder.indexOf(a.id) - quotesOrder.indexOf(b.id));
                                    res.json(result);
                                }
                            }
                        });
                    });
                });
            });
        });
    });
});

// 4. Save/Update Quotation
app.post('/api/history', (req, res) => {
    const q = req.body;
    if (!q.id) {
        return res.status(400).json({ error: "Missing quotation ID" });
    }
    saveQuotationToDb(q, (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// 5. Delete Quotation
app.delete('/api/history/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM quotations WHERE id = ?", [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// 6. Reset Database (Danger Zone)
app.post('/api/reset', (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM quotations;");
        db.run("DELETE FROM settings;");
        db.run("DELETE FROM active_quotation;");
        seedMockData();
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
