const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// --- Mock Data for Seeding ---
const defaultNotesArray = [
    "Bahan dasar menggunakan Multiplek berkualitas tinggi ketebalan 18mm (Bukan MDF/Partikel Board).",
    "Finishing bagian luar HPL Taco / setara (Warna & motif disetujui customer).",
    "Finishing bagian dalam menggunakan melamin putih berkualitas.",
    "Aksesoris & hardware (engsel, rel laci) menggunakan Huben Slow Motion (Soft-close).",
    "Waktu produksi di workshop adalah 30-40 hari kerja terhitung sejak gambar kerja disetujui.",
    "Sistem pembayaran: DP 50% saat tanda tangan kontrak, Progress 40% saat barang dikirim, Pelunasan 10% setelah instalasi selesai."
];

const mockCompanySettings = {
    name: "L-TUDO INTERIOR",
    address: "",
    contact: "Email: info@ltudo-interior.com | Web: www.ltudo-interior.com",
    sigName: "L-TUDO Interior Design",
    sigTitle: "Estimator & Interior Designer",
    defaultNotes: defaultNotesArray
};

const getMockQuotations = () => {
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

    return [mock1, mock2];
};

// --- Database Adapter Setup ---
let dbAdapter;

if (process.env.DATABASE_URL) {
    console.log("Using Cloud PostgreSQL database...");
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    dbAdapter = {
        init: async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS store (
                    key VARCHAR(100) PRIMARY KEY,
                    value JSONB
                );
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS quotations (
                    id VARCHAR(100) PRIMARY KEY,
                    data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            
            // Seed if empty
            const countRes = await pool.query("SELECT COUNT(*) FROM quotations");
            if (parseInt(countRes.rows[0].count) === 0) {
                console.log("PostgreSQL database is empty. Seeding mock data...");
                await pool.query(
                    `INSERT INTO store (key, value) VALUES ('company_settings', $1) ON CONFLICT (key) DO UPDATE SET value = $1`,
                    [mockCompanySettings]
                );
                for (const mockQ of getMockQuotations()) {
                    await pool.query(
                        `INSERT INTO quotations (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
                        [mockQ.id, mockQ]
                    );
                }
            }
        },
        getSettings: async () => {
            const res = await pool.query("SELECT value FROM store WHERE key = 'company_settings'");
            return res.rows[0]?.value || {};
        },
        saveSettings: async (settings) => {
            await pool.query(
                `INSERT INTO store (key, value) VALUES ('company_settings', $1) ON CONFLICT (key) DO UPDATE SET value = $1`,
                [settings]
            );
        },
        getActiveDraft: async () => {
            const res = await pool.query("SELECT value FROM store WHERE key = 'active_draft'");
            return res.rows[0]?.value || null;
        },
        saveActiveDraft: async (data) => {
            await pool.query(
                `INSERT INTO store (key, value) VALUES ('active_draft', $1) ON CONFLICT (key) DO UPDATE SET value = $1`,
                [data]
            );
        },
        getHistory: async () => {
            const res = await pool.query("SELECT data FROM quotations ORDER BY created_at DESC");
            return res.rows.map(r => r.data);
        },
        saveQuotation: async (q) => {
            await pool.query(
                `INSERT INTO quotations (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
                [q.id, q]
            );
        },
        deleteQuotation: async (id) => {
            await pool.query("DELETE FROM quotations WHERE id = $1", [id]);
        },
        reset: async () => {
            await pool.query("DELETE FROM quotations");
            await pool.query("DELETE FROM store");
            // Re-seed
            await pool.query(
                `INSERT INTO store (key, value) VALUES ('company_settings', $1) ON CONFLICT (key) DO UPDATE SET value = $1`,
                [mockCompanySettings]
            );
            for (const mockQ of getMockQuotations()) {
                await pool.query(
                    `INSERT INTO quotations (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
                    [mockQ.id, mockQ]
                );
            }
        }
    };
} else {
    console.log("Using Local SQLite database...");
    const sqlite3 = require('sqlite3').verbose();
    const fs = require('fs');

    const dbFolder = (process.env.PROJECT_DOMAIN) ? path.join(__dirname, '.data') : __dirname;
    if (dbFolder !== __dirname && !fs.existsSync(dbFolder)) {
        fs.mkdirSync(dbFolder, { recursive: true });
    }
    const dbPath = path.join(dbFolder, 'penawaran.db');
    const db = new sqlite3.Database(dbPath);

    const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

    const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    dbAdapter = {
        init: async () => {
            await dbRun(`
                CREATE TABLE IF NOT EXISTS store (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);
            await dbRun(`
                CREATE TABLE IF NOT EXISTS quotations (
                    id TEXT PRIMARY KEY,
                    data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Seed if empty
            const countRes = await dbGet("SELECT COUNT(*) as count FROM quotations");
            if (parseInt(countRes.count) === 0) {
                console.log("SQLite database is empty. Seeding mock data...");
                await dbRun(
                    `INSERT OR REPLACE INTO store (key, value) VALUES ('company_settings', ?)`,
                    [JSON.stringify(mockCompanySettings)]
                );
                for (const mockQ of getMockQuotations()) {
                    await dbRun(
                        `INSERT OR REPLACE INTO quotations (id, data) VALUES (?, ?)`,
                        [mockQ.id, JSON.stringify(mockQ)]
                    );
                }
            }
        },
        getSettings: async () => {
            const row = await dbGet("SELECT value FROM store WHERE key = 'company_settings'");
            return row ? JSON.parse(row.value) : {};
        },
        saveSettings: async (settings) => {
            await dbRun(
                `INSERT OR REPLACE INTO store (key, value) VALUES ('company_settings', ?)`,
                [JSON.stringify(settings)]
            );
        },
        getActiveDraft: async () => {
            const row = await dbGet("SELECT value FROM store WHERE key = 'active_draft'");
            return row ? JSON.parse(row.value) : null;
        },
        saveActiveDraft: async (data) => {
            await dbRun(
                `INSERT OR REPLACE INTO store (key, value) VALUES ('active_draft', ?)`,
                [JSON.stringify(data)]
            );
        },
        getHistory: async () => {
            const rows = await dbAll("SELECT data FROM quotations ORDER BY created_at DESC");
            return rows.map(r => JSON.parse(r.data));
        },
        saveQuotation: async (q) => {
            await dbRun(
                `INSERT OR REPLACE INTO quotations (id, data) VALUES (?, ?)`,
                [q.id, JSON.stringify(q)]
            );
        },
        deleteQuotation: async (id) => {
            await dbRun("DELETE FROM quotations WHERE id = ?", [id]);
        },
        reset: async () => {
            await dbRun("DELETE FROM quotations");
            await dbRun("DELETE FROM store");
            // Re-seed
            await dbRun(
                `INSERT OR REPLACE INTO store (key, value) VALUES ('company_settings', ?)`,
                [JSON.stringify(mockCompanySettings)]
            );
            for (const mockQ of getMockQuotations()) {
                await dbRun(
                    `INSERT OR REPLACE INTO quotations (id, data) VALUES (?, ?)`,
                    [mockQ.id, JSON.stringify(mockQ)]
                );
            }
        }
    };
}

// Initialize database when app starts
dbAdapter.init().then(() => {
    console.log("Database initialized successfully.");
}).catch(err => {
    console.error("Database initialization failed:", err);
});

// --- API ROUTES ---

// 1. Settings API
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await dbAdapter.getSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        await dbAdapter.saveSettings(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Active Draft API
app.get('/api/active', async (req, res) => {
    try {
        const active = await dbAdapter.getActiveDraft();
        res.json(active);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/active', async (req, res) => {
    try {
        await dbAdapter.saveActiveDraft(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. History API
app.get('/api/history', async (req, res) => {
    try {
        const history = await dbAdapter.getHistory();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/history', async (req, res) => {
    try {
        const q = req.body;
        if (!q.id) {
            return res.status(400).json({ error: "Missing quotation ID" });
        }
        await dbAdapter.saveQuotation(q);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Delete Quotation
app.delete('/api/history/:id', async (req, res) => {
    try {
        await dbAdapter.deleteQuotation(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Reset Database
app.post('/api/reset', async (req, res) => {
    try {
        await dbAdapter.reset();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
