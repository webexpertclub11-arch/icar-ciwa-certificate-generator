import defaultDirectorSign from '../assets/director sign.png';
import { updateSystemConfig } from './dbTracker';

const SETTINGS_STORAGE_KEY = 'icar_certificate_global_settings';

export const getDefaultCertificateSettings = () => ({
    directorSignatureImage: defaultDirectorSign,
    directorName: 'Dr. Mridula Devi',
    directorTitle: '(Director, ICAR-CIWA)',
    trainingOrganizer: 'ICAR-Central Institute for Women in Agriculture, Bhubaneswar',
    trainingDates: 'during July 27-29, 2026.',

    // Access Control & Download Window Schedule
    downloadEnabled: true,
    scheduleEnabled: false,
    scheduleStart: '',
    scheduleEnd: '',
    closedMessage: 'Certificate downloads are currently closed by Administrator.'
});

/**
 * Get current certificate global settings
 */
export const getCertificateSettings = () => {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                ...getDefaultCertificateSettings(),
                ...parsed
            };
        }
    } catch (e) {
        console.warn("Error reading certificate settings:", e);
    }
    return getDefaultCertificateSettings();
};

/**
 * Save certificate global settings
 */
export const saveCertificateSettings = (newSettings) => {
    try {
        const current = getCertificateSettings();
        const updated = { ...current, ...newSettings };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));

        // Save to Turso asynchronously
        updateSystemConfig(updated).catch(e => console.error("Firebase sync error", e));

        // Dispatch custom event for real-time reactivity across components
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('icar_settings_updated', { detail: updated }));
        }

        return { success: true, settings: updated };
    } catch (e) {
        console.error("Error saving certificate settings:", e);
        return { success: false, message: "Failed to save settings to storage." };
    }
};

export const forceSetCertificateSettings = (newSettings) => {
    try {
        const current = getCertificateSettings();
        const updated = { ...current, ...newSettings };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('icar_settings_updated', { detail: updated }));
        }
        return { success: true, settings: updated };
    } catch (e) {
        return { success: false };
    }
};

/**
 * Check if the Certificate Download Window is currently ACTIVE
 * Returns { isActive: boolean, reason: string, start: string, end: string }
 */
export const checkDownloadWindowStatus = () => {
    const settings = getCertificateSettings();

    // 1. Check Global Emergency Stop Switch
    const isGlobalEnabled = settings.downloadEnabled === true || settings.downloadEnabled === 'true' || settings.downloadEnabled === 1;

    if (!isGlobalEnabled) {
        return {
            isActive: false,
            reason: settings.closedMessage || 'Certificate downloads are currently turned OFF by Administrator.',
            scheduleStart: settings.scheduleStart,
            scheduleEnd: settings.scheduleEnd
        };
    }

    // 2. Check Datetime Schedule Window if enabled
    const isScheduleActive = settings.scheduleEnabled === true || settings.scheduleEnabled === 'true' || settings.scheduleEnabled === 1;

    if (isScheduleActive) {
        const now = new Date();

        if (settings.scheduleStart) {
            const startDate = new Date(settings.scheduleStart);
            if (!isNaN(startDate.getTime()) && now < startDate) {
                return {
                    isActive: false,
                    reason: `Download window has not started yet. Opens at: ${startDate.toLocaleString()}`,
                    scheduleStart: settings.scheduleStart,
                    scheduleEnd: settings.scheduleEnd
                };
            }
        }

        if (settings.scheduleEnd) {
            const endDate = new Date(settings.scheduleEnd);
            if (!isNaN(endDate.getTime()) && now > endDate) {
                return {
                    isActive: false,
                    reason: `Download window closed at: ${endDate.toLocaleString()}`,
                    scheduleStart: settings.scheduleStart,
                    scheduleEnd: settings.scheduleEnd
                };
            }
        }
    }

    return {
        isActive: true,
        reason: 'Downloads are open and active.'
    };
};

const PARTICIPANT_PERMISSIONS_KEY = 'icar_participant_download_permissions';

/**
 * Get participant download permissions (disabled serials and disabled ATARI zones)
 */
export const getParticipantPermissions = () => {
    try {
        const stored = localStorage.getItem(PARTICIPANT_PERMISSIONS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Error reading participant permissions:", e);
    }
    return { disabledSerials: {}, disabledZones: {} };
};

/**
 * Save participant download permissions
 */
export const saveParticipantPermissions = (permissions) => {
    try {
        localStorage.setItem(PARTICIPANT_PERMISSIONS_KEY, JSON.stringify(permissions));
        return true;
    } catch (e) {
        console.error("Error saving participant permissions:", e);
        return false;
    }
};

/**
 * Check if a specific participant is allowed to download certificate
 * Checks global download master switch, schedule window, individual serial status, and ATARI Zone status
 */
export const isParticipantDownloadEnabled = (serialNumber = '', atariZone = '') => {
    // 0. Check Global Settings Master Download Switch & Schedule Window
    const windowStatus = checkDownloadWindowStatus();
    if (!windowStatus.isActive) {
        return false;
    }

    const permissions = getParticipantPermissions() || {};
    const cleanSerial = serialNumber ? String(serialNumber).trim().toUpperCase() : '';
    const cleanZone = atariZone ? String(atariZone).trim() : '';

    // 1. Check if individual serial is explicitly disabled
    if (cleanSerial && permissions.disabledSerials && permissions.disabledSerials[cleanSerial]) {
        return false;
    }

    // 2. Check if entire ATARI Zone is disabled
    if (cleanZone && permissions.disabledZones && permissions.disabledZones[cleanZone]) {
        return false;
    }

    return true;
};

/**
 * Toggle download status for array of serial numbers
 */
export const setParticipantDownloadStatus = (serialNumbers = [], isEnabled = true) => {
    const permissions = getParticipantPermissions();
    if (!permissions.disabledSerials) permissions.disabledSerials = {};

    serialNumbers.forEach(sNo => {
        const key = sNo.trim().toUpperCase();
        if (isEnabled) {
            delete permissions.disabledSerials[key];
        } else {
            permissions.disabledSerials[key] = true;
        }
    });

    saveParticipantPermissions(permissions);
    return permissions;
};

/**
 * Toggle download status for an entire ATARI Zone
 */
export const setZoneDownloadStatus = (atariZone = '', isEnabled = true) => {
    const permissions = getParticipantPermissions();
    if (!permissions.disabledZones) permissions.disabledZones = {};

    const key = atariZone.trim();
    if (isEnabled) {
        delete permissions.disabledZones[key];
    } else {
        permissions.disabledZones[key] = true;
    }

    saveParticipantPermissions(permissions);
    return permissions;
};

const ZONE_TRAINING_DATES_KEY = 'icar_zone_training_dates';

/**
 * Get Zone-wise Training Dates mapping { [atariZone]: "during August 01-05, 2026." }
 */
export const getZoneTrainingDates = () => {
    try {
        const stored = localStorage.getItem(ZONE_TRAINING_DATES_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Error reading zone training dates:", e);
    }
    return {};
};

/**
 * Assign or update Training Dates statement for an ATARI Zone
 */
export const setZoneTrainingDate = (atariZone = '', datesString = '') => {
    const current = getZoneTrainingDates();
    const key = atariZone ? String(atariZone).trim() : '';
    if (!key) return current;

    if (datesString && String(datesString).trim()) {
        current[key] = String(datesString).trim();
    } else {
        delete current[key];
    }

    try {
        localStorage.setItem(ZONE_TRAINING_DATES_KEY, JSON.stringify(current));
    } catch (e) {
        console.error("Error saving zone training date:", e);
    }
    return current;
};

/**
 * Dynamically resolves effective Training Dates statement in hierarchical priority:
 * 1. Participant-specific training dates
 * 2. Zone-specific training dates
 * 3. Global default certificate training dates
 */
export const getEffectiveTrainingDates = (serialNumber = '', atariZone = '', participantDates = '') => {
    const pDatesStr = participantDates ? String(participantDates).trim() : '';
    const serialStr = serialNumber ? String(serialNumber).trim() : '';
    let dbZone = atariZone ? String(atariZone).trim() : '';

    // 1. Direct participant override passed in arguments
    if (pDatesStr) {
        return pDatesStr;
    }

    // 2. Look up participant record in local database via serialNumber if participantDates not passed
    if (serialStr) {
        try {
            const rawList = localStorage.getItem('icar_registered_participants');
            if (rawList) {
                const list = JSON.parse(rawList);
                const sUpper = serialStr.toUpperCase();
                const found = Array.isArray(list) ? list.find(p => p && p.serialNumber && String(p.serialNumber).trim().toUpperCase() === sUpper) : null;
                if (found) {
                    if (found.trainingDates && String(found.trainingDates).trim()) {
                        return String(found.trainingDates).trim();
                    }
                    if (found.atariZone && !dbZone) {
                        dbZone = String(found.atariZone).trim();
                    }
                }
            }
        } catch (e) {
            console.warn("Error looking up participant for training dates:", e);
        }
    }

    // 3. Zone-wise training dates lookup (with robust/flexible zone matching)
    const activeZone = (dbZone || atariZone || '').trim();
    if (activeZone) {
        const zoneDates = getZoneTrainingDates();

        // Direct key match check
        if (zoneDates[activeZone]) {
            return zoneDates[activeZone];
        }

        // Extract Zone identifier e.g. "Zone VIII" or "Zone 8" or "Zone I"
        const zoneMatch = activeZone.match(/Zone\s+([IVX0-9]+)/i);
        const zoneNum = zoneMatch ? zoneMatch[1].toUpperCase() : null;

        for (const [key, dateVal] of Object.entries(zoneDates)) {
            if (key.trim() === activeZone) {
                return dateVal;
            }
            if (zoneNum) {
                const keyMatch = key.match(/Zone\s+([IVX0-9]+)/i);
                if (keyMatch && keyMatch[1].toUpperCase() === zoneNum) {
                    return dateVal;
                }
            }
        }
    }

    // 4. Fallback to global default certificate training dates
    const settings = getCertificateSettings();
    return settings.trainingDates || 'during July 27-29, 2026.';
};

