/**
 * Security Guard Manager - Defeats Windows Snipping Tool (Win+Shift+S), PrintScreen & Copying
 */

export const initSecurityGuard = (onSecurityViolation, onBlurStateChange) => {
    // DEVELOPER MODE ENABLED: Security bypassed
    // Return empty cleanup function
    return () => { };
};
