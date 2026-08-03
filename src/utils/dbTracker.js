import { createClient } from "@libsql/client";
import * as XLSX from 'xlsx';
import { sampleParticipants } from '../data/certificateData';

const PARTICIPANTS_STORAGE_KEY = 'icar_custom_participants_list';

/**
 * Helper to get current Indian Standard Time (IST) ISO string
 */
export const getIndianStandardTime = () => {
    const now = new Date();
    const istTime = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60 * 1000);
    return istTime.toISOString();
};

// Get Turso Database client using Vite environment variables
const getDb = () => {
    const url = import.meta.env.VITE_TURSO_DB_URL;
    const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

    if (!url) {
        console.warn("Turso DB credentials missing in .env: Please set VITE_TURSO_DB_URL and VITE_TURSO_AUTH_TOKEN");
        return null;
    }

    try {
        return createClient({
            url,
            authToken,
        });
    } catch (e) {
        console.error("Error creating Turso DB client:", e);
        return null;
    }
};

/**
 * Initialize table if it doesn't exist & add missing columns for lock system
 */
export const initializeDB = async () => {
    const db = getDb();
    if (!db) return;

    try {
        // Table 1: Certificate Downloads & Locks
        await db.execute(`
        CREATE TABLE IF NOT EXISTS certificate_downloads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          registered_name TEXT,
          certificate_name TEXT,
          salutation TEXT,
          email TEXT,
          mobile TEXT,
          wp_no TEXT,
          kvk_name TEXT,
          atari_zone TEXT,
          serial_number TEXT,
          is_locked INTEGER DEFAULT 1,
          download_time DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
        
        try {
            await db.execute(`ALTER TABLE certificate_downloads ADD COLUMN salutation TEXT;`);
        } catch (_) {}
        
        try {
            await db.execute(`ALTER TABLE certificate_downloads ADD COLUMN is_locked INTEGER DEFAULT 1;`);
        } catch (_) {}

        // Table 2: Registered Participants Roster
        await db.execute(`
        CREATE TABLE IF NOT EXISTS participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          participant_id TEXT,
          name TEXT NOT NULL,
          serial_number TEXT UNIQUE NOT NULL,
          institute_name TEXT,
          atari_zone TEXT,
          training_dates TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

        // Table 3: Organizations & Categories (KVK, ICAR Institute, SAU, CAU)
        await db.execute(`
        CREATE TABLE IF NOT EXISTS organizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          short_name TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          full_name TEXT
        )
      `);

        // Table 4: Admin Credentials & Security
        await db.execute(`
        CREATE TABLE IF NOT EXISTS admin_auth (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT UNIQUE NOT NULL DEFAULT 'superadmin',
          password_hash TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

        // Ensure default superadmin row exists in admin_auth table
        try {
            const adminCheck = await db.execute(`SELECT * FROM admin_auth WHERE role = 'superadmin';`);
                const initPass = (import.meta.env.VITE_INITIAL_ADMIN_PASSWORD || '').trim();
                if (initPass) {
                    await db.execute({
                        sql: `INSERT INTO admin_auth (role, password_hash) VALUES ('superadmin', ?)`,
                        args: [initPass]
                    });
                    console.log("Initialized superadmin credentials in Turso DB!");
                }
        } catch (e) {
            console.warn("Notice seeding admin_auth:", e);
        }
        
        // Physical migration to drop legacy 'name' column if present in live DB table
        try {
            const tableInfo = await db.execute(`PRAGMA table_info(organizations);`);
            const hasNameColumn = tableInfo.rows && tableInfo.rows.some(col => col.name === 'name');

            if (hasNameColumn) {
                console.log("Migrating live database table 'organizations' to drop 'name' column...");
                
                await db.execute(`
                    CREATE TABLE organizations_temp (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category TEXT NOT NULL,
                        short_name TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        full_name TEXT
                    );
                `);

                await db.execute(`
                    INSERT INTO organizations_temp (id, category, short_name, is_active, created_at, full_name)
                    SELECT id, category, COALESCE(short_name, name), is_active, created_at, COALESCE(full_name, name)
                    FROM organizations;
                `);

                await db.execute(`DROP TABLE organizations;`);
                await db.execute(`ALTER TABLE organizations_temp RENAME TO organizations;`);
                console.log("Successfully dropped 'name' column and updated live 'organizations' table structure!");
            }
        } catch (migrationErr) {
            try { await db.execute(`ALTER TABLE organizations DROP COLUMN name;`); } catch (_) {}
        }

        try {
            await db.execute(`ALTER TABLE organizations ADD COLUMN short_name TEXT;`);
        } catch (_) {}

        try {
            await db.execute(`ALTER TABLE organizations ADD COLUMN full_name TEXT;`);
        } catch (_) {}

        // Indexes for performance
        try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_cert_serial ON certificate_downloads(serial_number);`); } catch (_) {}
        try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_part_serial ON participants(serial_number);`); } catch (_) {}
        try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_org_category ON organizations(category);`); } catch (_) {}

        // Sync participants from Turso DB to LocalStorage and notify UI
        try {
            const dbParticipants = await db.execute("SELECT * FROM participants ORDER BY name ASC");
            if (dbParticipants.rows && dbParticipants.rows.length > 0) {
                const formattedList = dbParticipants.rows.map(row => ({
                    id: String(row.id || row.participant_id),
                    name: row.name,
                    serialNumber: row.serial_number,
                    instituteName: row.institute_name || '',
                    atariZone: row.atari_zone || '',
                    trainingDates: row.training_dates || ''
                }));
                localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(formattedList));
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('icar_db_initialized', { detail: formattedList }));
                }
            }
        } catch (e) {
            console.warn("Error syncing participants from Turso DB:", e);
        }

        console.log("Turso Database initialized successfully with all tables (downloads, participants, organizations)!");
    } catch (err) {
        console.error("Failed to initialize DB:", err);
    }
};

/**
 * Async fetch participants list directly from Turso DB to ensure fresh browser load without reload requirement
 */
export const fetchParticipantsFromTurso = async () => {
    const db = getDb();
    if (!db) return fetchParticipantsList();

    try {
        const dbParticipants = await db.execute("SELECT * FROM participants ORDER BY name ASC");
        if (dbParticipants.rows && dbParticipants.rows.length > 0) {
            const formattedList = dbParticipants.rows.map(row => ({
                id: String(row.id || row.participant_id),
                name: row.name,
                serialNumber: row.serial_number,
                instituteName: row.institute_name || '',
                atariZone: row.atari_zone || '',
                trainingDates: row.training_dates || ''
            }));
            localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(formattedList));
            return formattedList;
        }
    } catch (e) {
        console.warn("Error fetching participants from Turso DB:", e);
    }
    return fetchParticipantsList();
};

/**
 * Record a new certificate download directly to Turso DB (and mark as locked).
 */
export const recordDownloadToTurso = async (data) => {
    const istTime = getIndianStandardTime();
    // 1. Always record in LocalStorage for instant immutability lock fallback
    try {
        const localKey = `icar_cert_lock_${data.serialNumber}`;
        const lockPayload = {
            ...data,
            isLocked: true,
            downloadTime: data.downloadTime || istTime
        };
        localStorage.setItem(localKey, JSON.stringify(lockPayload));
        
        if (data.registeredName) {
            localStorage.setItem(`icar_cert_lock_user_${data.registeredName.toLowerCase()}`, JSON.stringify(lockPayload));
        }

        // Also add to local downloads log index
        const logsRaw = localStorage.getItem('icar_all_local_download_logs');
        const logs = logsRaw ? JSON.parse(logsRaw) : [];
        const existingIdx = logs.findIndex(l => l.serialNumber === data.serialNumber);
        if (existingIdx >= 0) {
            logs[existingIdx] = lockPayload;
        } else {
            logs.unshift(lockPayload);
        }
        localStorage.setItem('icar_all_local_download_logs', JSON.stringify(logs));
    } catch (e) {
        console.warn("LocalStorage lock save warning:", e);
    }

    // 2. Save into Turso Database table `certificate_downloads`
    const db = getDb();
    if (!db) return;

    try {
        await db.execute({
            sql: `INSERT OR REPLACE INTO certificate_downloads 
            (registered_name, certificate_name, salutation, email, mobile, wp_no, kvk_name, atari_zone, serial_number, is_locked, download_time) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            args: [
                data.registeredName || 'Unknown',
                data.certificateName || 'Unknown',
                data.salutation || '',
                data.email || 'N/A',
                data.mobile || 'N/A',
                data.wp || data.wp_no || 'N/A',
                data.kvkName || 'Unknown',
                data.atariZone || 'Unknown',
                data.serialNumber || 'N/A',
                istTime
            ]
        });
        console.log("Successfully saved locked certificate record with IST timestamp to Turso Database!");
    } catch (err) {
        console.error("Error saving to Turso:", err);
    }
};

/**
 * Dynamic Participant Management (Add, List, Delete, Update)
 */
export const fetchParticipantsList = () => {
    try {
        const stored = localStorage.getItem(PARTICIPANTS_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn("Error reading participants from storage:", e);
    }
    return Array.isArray(sampleParticipants) ? sampleParticipants : [];
};

export const addParticipantRecord = (newParticipant) => {
    let updatedList = [];
    try {
        const currentList = fetchParticipantsList();
        const validCurrent = Array.isArray(currentList) ? currentList : [];

        const existingIndex = validCurrent.findIndex(p => 
            p && p.serialNumber && p.serialNumber.trim().toUpperCase() === (newParticipant.serialNumber || '').trim().toUpperCase()
        );

        if (existingIndex >= 0) {
            updatedList = [...validCurrent];
            updatedList[existingIndex] = { ...updatedList[existingIndex], ...newParticipant };
        } else {
            updatedList = [newParticipant, ...validCurrent];
        }

        try {
            localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(updatedList));
        } catch (e) {
            console.error("Error saving new participant to localStorage:", e);
        }
    } catch (err) {
        console.error("Error processing participant list:", err);
    }

    try {
        const db = getDb();
        if (db) {
            (async () => {
                try {
                    await db.execute({
                        sql: `INSERT OR REPLACE INTO participants (participant_id, name, serial_number, institute_name, atari_zone, training_dates, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        args: [
                            newParticipant.id || '',
                            newParticipant.name || '',
                            newParticipant.serialNumber || '',
                            newParticipant.instituteName || '',
                            newParticipant.atariZone || '',
                            newParticipant.trainingDates || '',
                            getIndianStandardTime()
                        ]
                    });
                    console.log("Successfully inserted/updated participant with IST timestamp in Turso DB!");
                } catch (err) {
                    console.error("Error inserting participant to Turso DB:", err);
                }
            })();
        }
    } catch (dbErr) {
        console.warn("Notice executing async DB query:", dbErr);
    }

    return updatedList;
};

export const deleteParticipantRecord = (id) => {
    const currentList = fetchParticipantsList();
    const targetItem = currentList.find(p => p.id === id);
    const targetSerial = targetItem ? targetItem.serialNumber : '';
    const updatedList = currentList.filter(p => p.id !== id);
    try {
        localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
        console.error("Error deleting participant:", e);
    }

    const db = getDb();
    if (db) {
        (async () => {
            try {
                await db.execute({
                    sql: `DELETE FROM participants WHERE id = ? OR serial_number = ?`,
                    args: [id || '', targetSerial || '']
                });
                console.log("Successfully deleted participant from Turso DB!");
            } catch (err) {
                console.error("Error deleting participant from Turso DB:", err);
            }
        })();
    }

    return updatedList;
};

export const updateParticipantRecord = (id, updatedData) => {
    const currentList = fetchParticipantsList();
    let updatedParticipant = null;
    const updatedList = currentList.map(p => {
        if (p.id === id) {
            updatedParticipant = {
                ...p,
                name: updatedData.name ? updatedData.name.trim() : p.name,
                serialNumber: updatedData.serialNumber ? updatedData.serialNumber.trim() : p.serialNumber,
                instituteName: updatedData.instituteName !== undefined ? updatedData.instituteName.trim() : p.instituteName,
                atariZone: updatedData.atariZone !== undefined ? updatedData.atariZone.trim() : p.atariZone,
                trainingDates: updatedData.trainingDates !== undefined ? updatedData.trainingDates.trim() : p.trainingDates
            };
            return updatedParticipant;
        }
        return p;
    });
    try {
        localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
        console.error("Error updating participant:", e);
    }

    if (updatedParticipant) {
        const db = getDb();
        if (db) {
            (async () => {
                try {
                    await db.execute({
                        sql: `UPDATE participants SET name = ?, serial_number = ?, institute_name = ?, atari_zone = ?, training_dates = ? WHERE id = ? OR serial_number = ?`,
                        args: [
                            updatedParticipant.name || '',
                            updatedParticipant.serialNumber || '',
                            updatedParticipant.instituteName || '',
                            updatedParticipant.atariZone || '',
                            updatedParticipant.trainingDates || '',
                            id || '',
                            updatedParticipant.serialNumber || ''
                        ]
                    });
                    console.log("Successfully updated participant in Turso DB!");
                } catch (err) {
                    console.error("Error updating participant in Turso DB:", err);
                }
            })();
        }
    }

    return updatedList;
};

/**
 * Check if a certificate has already been downloaded and locked.
 */
export const checkCertificateLockStatus = async (serialNumber, registeredName) => {
    try {
        const localDataBySerial = localStorage.getItem(`icar_cert_lock_${serialNumber}`);
        if (localDataBySerial) {
            return JSON.parse(localDataBySerial);
        }

        if (registeredName) {
            const localDataByName = localStorage.getItem(`icar_cert_lock_user_${registeredName.toLowerCase()}`);
            if (localDataByName) {
                return JSON.parse(localDataByName);
            }
        }
    } catch (e) {
        console.warn("LocalStorage lock check error:", e);
    }

    const db = getDb();
    if (!db) return null;

    try {
        const result = await db.execute({
            sql: `SELECT * FROM certificate_downloads WHERE serial_number = ? OR registered_name = ? ORDER BY download_time DESC LIMIT 1`,
            args: [serialNumber || '', registeredName || '']
        });

        if (result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            return {
                registeredName: row.registered_name,
                certificateName: row.certificate_name,
                salutation: row.salutation || '',
                kvkName: row.kvk_name,
                atariZone: row.atari_zone,
                serialNumber: row.serial_number,
                email: row.email,
                mobile: row.mobile,
                wp: row.wp_no,
                isLocked: true,
                downloadTime: row.download_time
            };
        }
    } catch (err) {
        console.error("Error checking lock status in DB:", err);
    }

    return null;
};

/**
 * Update a specific user's certificate record details from Admin Panel
 */
export const updateUserCertificateRecord = async (targetSerialNumber, updatedData) => {
    // 1. Update in LocalStorage
    try {
        const localKey = `icar_cert_lock_${targetSerialNumber}`;
        const updatedPayload = {
            ...updatedData,
            serialNumber: updatedData.serialNumber || targetSerialNumber,
            isLocked: updatedData.isLocked !== undefined ? updatedData.isLocked : true,
            downloadTime: updatedData.downloadTime || new Date().toISOString()
        };

        // Remove old key if serial number changed
        if (targetSerialNumber !== updatedPayload.serialNumber) {
            localStorage.removeItem(localKey);
        }
        localStorage.setItem(`icar_cert_lock_${updatedPayload.serialNumber}`, JSON.stringify(updatedPayload));
        
        if (updatedPayload.registeredName) {
            localStorage.setItem(`icar_cert_lock_user_${updatedPayload.registeredName.toLowerCase()}`, JSON.stringify(updatedPayload));
        }

        // Update in logs index
        const logsRaw = localStorage.getItem('icar_all_local_download_logs');
        if (logsRaw) {
            const logs = JSON.parse(logsRaw);
            const idx = logs.findIndex(l => l.serialNumber === targetSerialNumber);
            if (idx >= 0) {
                logs[idx] = updatedPayload;
            } else {
                logs.unshift(updatedPayload);
            }
            localStorage.setItem('icar_all_local_download_logs', JSON.stringify(logs));
        }
    } catch (e) {
        console.warn("LocalStorage edit update warning:", e);
    }

    // 2. Update in Turso DB
    const db = getDb();
    if (!db) return true;

    try {
        await db.execute({
            sql: `UPDATE certificate_downloads SET 
                registered_name = ?, certificate_name = ?, salutation = ?, email = ?, mobile = ?, wp_no = ?, kvk_name = ?, atari_zone = ?, serial_number = ?, is_locked = ?
                WHERE serial_number = ?`,
            args: [
                updatedData.registeredName || 'Unknown',
                updatedData.certificateName || 'Unknown',
                updatedData.salutation || '',
                updatedData.email || 'N/A',
                updatedData.mobile || 'N/A',
                updatedData.wp || updatedData.wp_no || 'N/A',
                updatedData.kvkName || 'Unknown',
                updatedData.atariZone || 'Unknown',
                updatedData.serialNumber || targetSerialNumber,
                updatedData.isLocked ? 1 : 0,
                targetSerialNumber
            ]
        });
        console.log("Successfully updated certificate record in Turso DB!");
        return true;
    } catch (err) {
        console.error("Error updating DB record:", err);
        return false;
    }
};

/**
 * Unlock / Reset a Certificate record so participant can edit/regenerate
 */
export const unlockCertificateRecord = async (serialNumber, registeredName) => {
    try {
        if (serialNumber) {
            localStorage.removeItem(`icar_cert_lock_${serialNumber}`);
        }
        if (registeredName) {
            localStorage.removeItem(`icar_cert_lock_user_${registeredName.toLowerCase()}`);
        }

        const logsRaw = localStorage.getItem('icar_all_local_download_logs');
        if (logsRaw) {
            const logs = JSON.parse(logsRaw).filter(item => 
                item.serialNumber !== serialNumber && item.registeredName !== registeredName
            );
            localStorage.setItem('icar_all_local_download_logs', JSON.stringify(logs));
        }
    } catch (e) {
        console.warn("LocalStorage unlock error:", e);
    }

    const db = getDb();
    if (!db) return true;

    try {
        await db.execute({
            sql: `DELETE FROM certificate_downloads WHERE serial_number = ? OR registered_name = ?`,
            args: [serialNumber || '', registeredName || '']
        });
        console.log("Successfully unlocked certificate record in Turso DB!");
        return true;
    } catch (err) {
        console.error("Error unlocking in DB:", err);
        return false;
    }
};

/**
 * Delete a download log record permanently from DB and LocalStorage
 */
export const deleteDownloadLogRecord = async (serialNumber, registeredName) => {
    return await unlockCertificateRecord(serialNumber, registeredName);
};

/**
 * Fetch all download records for Admin Table View
 */
export const fetchAllDownloadLogs = async () => {
    const db = getDb();
    let dbLogs = [];

    if (db) {
        try {
            const result = await db.execute("SELECT * FROM certificate_downloads ORDER BY download_time DESC");
            dbLogs = result.rows.map((row) => ({
                id: row.id,
                registeredName: row.registered_name,
                certificateName: row.certificate_name,
                salutation: row.salutation || '',
                email: row.email,
                mobile: row.mobile,
                wp: row.wp_no,
                kvkName: row.kvk_name,
                atariZone: row.atari_zone,
                serialNumber: row.serial_number,
                isLocked: row.is_locked === 1 || row.is_locked === '1' || true,
                downloadTime: row.download_time
            }));
        } catch (err) {
            console.error("Error fetching DB logs:", err);
        }
    }

    try {
        const localLogsRaw = localStorage.getItem('icar_all_local_download_logs');
        const localLogs = localLogsRaw ? JSON.parse(localLogsRaw) : [];
        
        const mergedMap = new Map();
        [...dbLogs, ...localLogs].forEach(item => {
            if (item.serialNumber && !mergedMap.has(item.serialNumber)) {
                mergedMap.set(item.serialNumber, item);
            }
        });
        return Array.from(mergedMap.values());
    } catch (e) {
        return dbLogs;
    }
};

/**
 * Fetch Analytics Metrics for Admin Dashboard
 */
export const fetchAdminMetrics = async () => {
    const logs = await fetchAllDownloadLogs();
    const participantsList = fetchParticipantsList();

    const totalIssued = logs.length;
    const totalParticipants = participantsList.length;
    const remainingParticipants = Math.max(0, totalParticipants - totalIssued);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const downloadsToday = logs.filter(log => {
        if (!log.downloadTime) return false;
        const d = new Date(log.downloadTime);
        return d >= oneDayAgo;
    }).length;

    const kvkMap = {};
    logs.forEach(log => {
        const kvk = log.kvkName || 'Unspecified KVK';
        kvkMap[kvk] = (kvkMap[kvk] || 0) + 1;
    });

    const topKvks = Object.entries(kvkMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
        totalIssued,
        totalParticipants,
        remainingParticipants,
        downloadsToday,
        topKvks
    };
};



/**
 * Bulk Register Participants with fixed prefix CIWA/2026/NOGRA/ and Duplicate Error Handling
 */
export const bulkRegisterParticipants = (rawArray) => {
    const currentList = fetchParticipantsList();
    const existingSerials = new Set(currentList.map(p => p.serialNumber.trim().toUpperCase()));
    
    const FIXED_PREFIX = 'CIWA/2026/NOGRA/';
    const newlyAdded = [];
    const skippedItems = [];

    rawArray.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;

        const salutation = (item.Salutation || item.salutation || item.sal || '').toString().trim();
        const name = (item.Name || item.name || item['Participant Name'] || '').toString().trim();
        let rawSerial = (item['Serial No'] || item.serialNo || item.serial || item.id || '').toString().trim();

        if (!name || !rawSerial) {
            return;
        }

        // Standardize serial number to fixed prefix format: CIWA/2026/NOGRA/<suffix>
        let cleanSerial = rawSerial.toUpperCase();
        if (cleanSerial.startsWith('CIWA/2026/NOGRA/')) {
            // Already full prefix
        } else if (cleanSerial.startsWith('NOGRA/')) {
            cleanSerial = `CIWA/2026/${cleanSerial}`;
        } else {
            // Numeric or short suffix e.g., 255 -> CIWA/2026/NOGRA/255
            const numericSuffix = cleanSerial.replace(/[^0-9A-Z]/g, '');
            cleanSerial = `${FIXED_PREFIX}${numericSuffix}`;
        }

        // Duplicate Check
        if (existingSerials.has(cleanSerial)) {
            skippedItems.push({
                name,
                serialNumber: cleanSerial,
                reason: `Duplicate Serial Number (${cleanSerial}) already exists in Database`
            });
        } else {
            existingSerials.add(cleanSerial);
            const category = (item.Category || item.category || item['ATARI Center'] || item.atariZone || item.atari || 'KVK').toString().trim();
            const instituteName = (
                item['Institute Name'] || item['Institute / KVK Name'] || item['Institute'] || item.instituteName || item.institute || item.kvk || item['KVK Name'] || item['Organization Name'] || ''
            ).toString().trim();

            newlyAdded.push({
                id: (currentList.length + newlyAdded.length + 160).toString(),
                salutation,
                name,
                serialNumber: cleanSerial,
                category,
                instituteName,
                atariZone: (item['ATARI Center'] || item.atariZone || item.atari || category || '').toString().trim(),
                trainingDates: (item['Training Dates'] || item.trainingDates || '').toString().trim()
            });
        }
    });

    const updatedList = [...newlyAdded, ...currentList];
    try {
        localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
        console.error("Error saving bulk participants:", e);
    }

    // Also persist to Turso DB participants table asynchronously
    const db = getDb();
    if (db && newlyAdded.length > 0) {
        (async () => {
            for (const item of newlyAdded) {
                try {
                    await db.execute({
                        sql: `INSERT INTO participants (participant_id, name, serial_number, institute_name, atari_zone, training_dates, created_at)
                              VALUES (?, ?, ?, ?, ?, ?, ?)
                              ON CONFLICT(serial_number) DO NOTHING`,
                        args: [
                            item.id,
                            item.name,
                            item.serialNumber,
                            item.instituteName,
                            item.category || item.atariZone || '',
                            item.trainingDates,
                            getIndianStandardTime()
                        ]
                    });
                } catch (dbErr) {
                    console.warn("DB insert participant warning:", dbErr);
                }
            }
        })();
    }

    return {
        successCount: newlyAdded.length,
        skippedCount: skippedItems.length,
        skippedItems,
        updatedList
    };
};

/**
 * Fetch all records from Turso DB and trigger Excel download.
 */
export const exportDBToExcel = async (logsToExport = null) => {
    const logs = logsToExport || await fetchAllDownloadLogs();

    const excelData = logs.map((item, index) => ({
        'S.No': index + 1,
        'Registered Name': item.registeredName || 'N/A',
        'Certificate Name': item.certificateName || item.registeredName || 'N/A',
        'Salutation': item.salutation || 'N/A',
        'Email': item.email || 'N/A',
        'Mobile No': item.mobile || 'N/A',
        'WhatsApp No': item.wp || item.wp_no || 'N/A',
        'KVK Name': item.kvkName || 'N/A',
        'ATARI Zone': item.atariZone || 'N/A',
        'Serial Number': item.serialNumber || 'N/A',
        'Lock Status': item.isLocked ? 'Locked' : 'Unlocked',
        'Time of Download': item.downloadTime ? new Date(item.downloadTime).toLocaleString() : 'N/A'
    }));

    if (excelData.length === 0) {
        excelData.push({
            'S.No': 1,
            'Registered Name': 'No downloads yet',
            'Certificate Name': 'N/A',
            'Salutation': 'N/A',
            'Email': 'N/A',
            'Mobile No': 'N/A',
            'WhatsApp No': 'N/A',
            'KVK Name': 'N/A',
            'ATARI Zone': 'N/A',
            'Serial Number': 'N/A',
            'Lock Status': 'N/A',
            'Time of Download': 'N/A'
        });
    }

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 25 },
        { wch: 12 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 25 },
        { wch: 35 },
        { wch: 22 },
        { wch: 12 },
        { wch: 25 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Certificate Downloads');
    XLSX.writeFile(workbook, `ICAR_Certificate_Downloads_${new Date().toISOString().slice(0,10)}.xlsx`);
};

/**
 * Fetch Organizations & Categories from Turso DB (ATARI Zone, ICAR Institute, SAU, CAU, KVK)
 */
export const fetchOrganizationsList = async (categoryFilter = null) => {
    const db = getDb();
    if (!db) return [];

    try {
        let query = "SELECT id, category, short_name, is_active, created_at, full_name FROM organizations WHERE is_active = 1";
        let args = [];
        if (categoryFilter) {
            query += " AND category = ?";
            args.push(categoryFilter);
        }
        query += " ORDER BY category ASC, full_name ASC";

        const result = await db.execute({ sql: query, args });
        return result.rows.map(row => ({
            id: row.id,
            category: row.category,
            shortName: row.short_name || row.full_name || '',
            isActive: row.is_active !== undefined ? row.is_active : 1,
            createdAt: row.created_at || null,
            fullName: row.full_name || row.short_name || '',
            name: row.full_name || row.short_name || ''
        }));
    } catch (err) {
        console.error("Error fetching organizations from Turso DB:", err);
        return [];
    }
};

/**
 * Add a new Organization / Category entry to Turso DB
 */
export const addOrganizationRecord = async (orgData) => {
    const db = getDb();
    if (!db) return false;

    const fullName = (orgData.fullName || orgData.name || orgData.shortName || '').trim();
    const shortName = (orgData.shortName || orgData.name || fullName).trim();

    try {
        await db.execute({
            sql: `INSERT INTO organizations (category, short_name, is_active, full_name, created_at)
                  VALUES (?, ?, 1, ?, ?)`,
            args: [
                orgData.category ? orgData.category.trim() : 'ICAR Institute',
                shortName,
                fullName,
                getIndianStandardTime()
            ]
        });
        console.log("Successfully added new organization record with IST timestamp to Turso DB!");
        return true;
    } catch (err) {
        console.error("Error adding organization record:", err);
        return false;
    }
};

/**
 * Delete an Organization entry from Turso DB
 */
export const deleteOrganizationRecord = async (id) => {
    const db = getDb();
    if (!db) return false;

    try {
        await db.execute({
            sql: `DELETE FROM organizations WHERE id = ?`,
            args: [id]
        });
        console.log("Successfully deleted organization record from Turso DB!");
        return true;
    } catch (err) {
        console.error("Error deleting organization record:", err);
        return false;
    }
};

/**
 * Bulk Register Organizations / Institutes in Turso DB
 */
export const bulkRegisterOrganizations = async (rawArray) => {
    const db = getDb();
    if (!db || !Array.isArray(rawArray)) return { success: false, addedCount: 0, error: 'Database connection unavailable' };

    let addedCount = 0;
    for (const item of rawArray) {
        if (!item || typeof item !== 'object') continue;

        const category = (
            item.Category || item.category || item['CATEGORY'] || 'ICAR Institute'
        ).toString().trim();

        const rawShort = (
            item['Short Name'] || item.shortName || item['SHORT NAME'] || item.short || item['Short'] || ''
        ).toString().trim();

        const rawFull = (
            item['Full Name'] || item.fullName || item['FULL NAME'] || item['Full Official Name'] || item['Institute Name'] || ''
        ).toString().trim();

        const rawName = (
            item.Name || item.name || item['NAME'] || ''
        ).toString().trim();

        const finalShortName = rawShort || rawName || rawFull;
        const finalFullName = rawFull || rawName || rawShort;

        if (!finalShortName && !finalFullName) continue;

        try {
            await db.execute({
                sql: `INSERT INTO organizations (category, short_name, is_active, full_name, created_at)
                      VALUES (?, ?, 1, ?, ?)`,
                args: [
                    category,
                    finalShortName,
                    finalFullName,
                    getIndianStandardTime()
                ]
            });
            addedCount++;
        } catch (err) {
            console.warn("Error inserting organization row from Excel:", err);
        }
    }

    return { success: true, addedCount };
};

/**
 * Fetch superadmin password from Turso DB
 */
export const fetchAdminPasswordFromDB = async () => {
    const db = getDb();
    if (!db) return null;

    try {
        const res = await db.execute(`SELECT password_hash FROM admin_auth WHERE role = 'superadmin' LIMIT 1;`);
        if (res.rows && res.rows.length > 0 && res.rows[0].password_hash) {
            return res.rows[0].password_hash.toString();
        }
    } catch (e) {
        console.error("Error fetching admin password from Turso DB:", e);
    }
    return null;
};

/**
 * Update superadmin password in Turso DB
 */
export const updateAdminPasswordInDB = async (newPassword) => {
    const db = getDb();
    if (!db) return false;

    try {
        await db.execute({
            sql: `INSERT OR REPLACE INTO admin_auth (id, role, password_hash, updated_at) VALUES (1, 'superadmin', ?, ?);`,
            args: [newPassword, getIndianStandardTime()]
        });
        console.log("Successfully updated admin password in Turso DB!");
        return true;
    } catch (e) {
        console.error("Error updating admin password in Turso DB:", e);
        return false;
    }
};
