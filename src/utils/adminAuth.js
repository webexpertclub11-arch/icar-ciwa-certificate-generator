/**
 * Admin Authentication & Security Management (Database Integration)
 */
import { fetchAdminPasswordFromDB, updateAdminPasswordInDB } from './dbTracker';

const ADMIN_PASSWORD_KEY = 'icar_admin_master_password';

let cachedDbPassword = null;

// Initial sync with Database
fetchAdminPasswordFromDB().then(dbPass => {
    if (dbPass) {
        cachedDbPassword = dbPass;
        try { localStorage.setItem(ADMIN_PASSWORD_KEY, dbPass); } catch (_) {}
    }
}).catch(() => {});

/**
 * Get current admin master password (from DB / cache / localStorage)
 */
export const getAdminPassword = () => {
    if (cachedDbPassword) return cachedDbPassword;
    try {
        return localStorage.getItem(ADMIN_PASSWORD_KEY) || '';
    } catch (e) {
        return '';
    }
};

/**
 * Verify input password against current admin master password in Database
 */
export const verifyAdminPassword = async (inputPassword) => {
    if (!inputPassword) return false;
    const cleanInput = inputPassword.trim();

    try {
        const dbPass = await fetchAdminPasswordFromDB();
        if (dbPass) {
            cachedDbPassword = dbPass;
            try { localStorage.setItem(ADMIN_PASSWORD_KEY, dbPass); } catch (_) {}
            return cleanInput === dbPass;
        }
    } catch (e) {
        console.warn("Notice verifying DB password:", e);
    }

    const currentPassword = getAdminPassword();
    return currentPassword ? cleanInput === currentPassword : false;
};

/**
 * Update admin master password in Database & local storage
 */
export const updateAdminPassword = async (newPassword) => {
    if (!newPassword || newPassword.trim().length < 4) {
        return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const cleanPass = newPassword.trim();

    try {
        localStorage.setItem(ADMIN_PASSWORD_KEY, cleanPass);
    } catch (e) {
        console.warn("Notice saving local password:", e);
    }

    const dbSuccess = await updateAdminPasswordInDB(cleanPass);
    cachedDbPassword = cleanPass;

    if (dbSuccess) {
        return { success: true, message: 'Admin password updated and secured in Database!' };
    } else {
        return { success: true, message: 'Admin password updated locally.' };
    }
};
