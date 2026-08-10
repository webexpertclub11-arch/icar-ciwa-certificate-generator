import { getDb } from './dbTracker';

const ANNOUNCEMENTS_STORAGE_KEY = 'icar_training_announcements_v1';



export const getAnnouncements = async () => {
    // Try Database First
    const db = getDb();
    if (db) {
        try {
            const result = await db.execute("SELECT * FROM training_announcements ORDER BY date DESC");
            if (result.rows && result.rows.length > 0) {
                const dbAnnouncements = result.rows.map(row => ({
                    id: String(row.id),
                    title: row.title,
                    description: row.description,
                    status: row.status,
                    date: row.date
                }));
                // sync to localstorage
                saveAnnouncementsLocal(dbAnnouncements);
                return dbAnnouncements;
            }
        } catch (e) {
            console.warn("Error reading announcements from db:", e);
        }
    }

    // Fallback to localstorage
    try {
        const stored = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Error reading announcements:", e);
    }
    return [];
};

const saveAnnouncementsLocal = (announcements) => {
    try {
        localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
        return true;
    } catch (e) {
        console.error("Error saving announcements:", e);
        return false;
    }
};

export const saveAnnouncements = async (announcements) => {
    saveAnnouncementsLocal(announcements);
    return true;
};

export const addAnnouncement = async (newAnnouncement) => {
    const list = await getAnnouncements();
    const item = {
        id: Date.now().toString(),
        title: (newAnnouncement.title || '').trim(),
        description: (newAnnouncement.description || newAnnouncement.message || '').trim(),
        status: newAnnouncement.status || 'live',
        date: new Date().toISOString()
    };
    const updated = [item, ...list];
    saveAnnouncementsLocal(updated);

    // Save to Database
    const db = getDb();
    if (db) {
        try {
            await db.execute({
                sql: `INSERT OR REPLACE INTO training_announcements (id, title, description, status, date) VALUES (?, ?, ?, ?, ?)`,
                args: [item.id, item.title, item.description, item.status, item.date]
            });
        } catch (e) {
            console.error("Error inserting announcement to DB:", e);
        }
    }

    return updated;
};

export const updateAnnouncement = async (id, updatedFields) => {
    const list = await getAnnouncements();
    const updated = list.map(item => item.id === id ? { ...item, ...updatedFields } : item);
    saveAnnouncementsLocal(updated);

    // It's uncommon to use this but adding DB support safely
    const db = getDb();
    if (db) {
        const target = updated.find(item => item.id === id);
        if (target) {
            try {
                await db.execute({
                    sql: `UPDATE training_announcements SET title=?, description=?, status=? WHERE id=?`,
                    args: [target.title, target.description, target.status, id]
                });
            } catch (e) {
                console.error("Error updating announcement in DB:", e);
            }
        }
    }
    return updated;
};

export const deleteAnnouncement = async (id) => {
    const list = await getAnnouncements();
    const updated = list.filter(item => item.id !== id);
    saveAnnouncementsLocal(updated);

    // Delete from Database
    const db = getDb();
    if (db) {
        try {
            await db.execute({
                sql: `DELETE FROM training_announcements WHERE id = ?`,
                args: [id]
            });
        } catch (e) {
            console.error("Error deleting announcement from DB:", e);
        }
    }

    return updated;
};
