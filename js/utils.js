// --- SHARED UTILITIES ---

// --- AUDIO UTILITIES ---
export function createAudioContext() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContext();
        if (context.state === 'suspended') {
            context.resume().catch(e => console.error("Error resuming AudioContext:", e));
        }
        return context;
    } catch (e) {
        console.error('Web Audio API is not supported in this browser.');
        console.error("Failed to create AudioContext:", e);
        return null;
    }
}

export const MIN_DB = -60;
export const MAX_DB = 0;

/**
 * Converts a linear volume value (0.0 to 1.0) to decibels (dB).
 * Uses MIN_DB and MAX_DB defined in this module.
 * @param {number} linearValue - The linear volume value.
 * @returns {number} The volume in dB.
 */
export function linearToDb(linearValue) {
    if (linearValue <= 0) return MIN_DB;
    // Threshold for practical silence.
    // If linearValue is very small, ensure it maps to MIN_DB after rounding.
    // dbToLinear(MIN_DB + 0.5) is the linear value that would round up to MIN_DB+1.
    if (linearValue < dbToLinear(MIN_DB + 0.5) && linearValue > 0) {
        return MIN_DB;
    }
    let db = 20 * Math.log10(linearValue);
    db = Math.max(MIN_DB, db); // Clamp to MIN_DB
    return Math.round(db);   // Round to nearest integer
}

/**
 * Converts a volume in decibels (dB) to a linear value (0.0 to 1.0).
 * Uses MIN_DB and MAX_DB defined in this module.
 * @param {number} dbValue - The volume in dB.
 * @returns {number} The linear volume value.
 */
export function dbToLinear(dbValue) {
    if (dbValue <= MIN_DB) return 0;
    if (dbValue >= MAX_DB) return 1;
    return Math.pow(10, dbValue / 20);
}

// --- TIME FORMATTING UTILITIES ---
/**
 * Formats time in milliseconds to HH:MM:SS.mmm string.
 * @param {number} milliseconds - The time in milliseconds.
 * @returns {string} Formatted time string.
 */
export function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor(milliseconds % 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Formats time in seconds to MM:SS string.
 * @param {number} timeInSeconds - The time in seconds.
 * @returns {string} Formatted time string.
 */
export function formatAudioTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- ARRAY UTILITIES ---
/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array<any>} array - The array to shuffle.
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- GENERAL PAGE UTILITIES ---
/**
 * Logs a greeting message with the current time in a specific timezone.
 */
export function logCurrentTime() {
    try {
        // Using Brazil/Blumenau time zone, current time
        const options = { timeZone: 'America/Sao_Paulo', hour12: false, year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        // Get current time in Blumenau, SC, Brazil
        const now = new Date();
        const dateTimeString = formatter.format(now);
        // Adjust based on the current time for greeting
        const hour = now.getHours(); // Use local hour for greeting logic
        let greeting = "ready";
        if (hour < 12) {
            greeting = "ready this morning";
        } else if (hour < 18) {
            greeting = "ready this afternoon";
        } else {
            greeting = "ready this evening";
        }
        console.log(`Multi-project page ${greeting}. Current time: ${dateTimeString} in Blumenau, SC, Brazil.`);

    } catch (e) {
        console.error("Error formatting date/time:", e);
        console.log(`Multi-project page ready via separate files.`);
    }
}
