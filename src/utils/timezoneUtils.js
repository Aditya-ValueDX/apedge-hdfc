/** 
 * Utility functions for handling timestamp formatting
 * Display dates and times exactly as stored in database
 */

// No timezone conversion - display as stored in database

/** 
 * Get current timestamp in ISO format without timezone conversion
 * @returns {string} ISO formatted timestamp as-is from database
 */
export const getCurrentTimeISOString = () => {
    const now = new Date();
    return toLocalISOString(now);
};

/** 
 * Convert a date to ISO string format without timezone conversion
 * @param {Date|string|number} date - The date to convert
 * @returns {string} ISO formatted timestamp as-is from database
 */
export const toLocalISOString = (date) => {
    if (!date) return '';
    
    let d;

    if (date instanceof Date) {
        d = date;
    }
    else if (typeof date === 'string') {
        // Handle DB strings like: "YYYY-MM-DD HH:MM:SS" or with milliseconds
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(date)) {
            d = new Date(date.replace(' ', 'T'));
        } else {
            d = new Date(date);
        }
    }
    else if (typeof date === 'number') {
        // Timestamp already absolute — do not touch it
        d = new Date(date);
    }
    else {
        d = new Date(String(date));
    }

    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
};

/** 
 * Get current date in YYYY-MM-DD format without timezone conversion
 * @returns {string} Date in YYYY-MM-DD format as-is from database
 */
export const getCurrentLocalDateString = () => {
    const now = new Date();
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

/** 
 * Format a date for UI display — no timezone conversion
 * @param {Date|string|number} date
 * @returns {string} DD/MM/YYYY HH:mm:ss
 */
export const formatISTDateTime = (date) => {
    if (!date) return '';

    let d;

    if (typeof date === 'number') {
        d = new Date(date);
    }
    else if (typeof date === 'string' &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(date)
    ) {
        d = new Date(date.replace(' ', 'T'));
    }
    else {
        d = new Date(date);
    }

    if (isNaN(d.getTime())) return '';

    const pad = n => String(n).padStart(2, '0');

    let hours = d.getUTCHours();
    const minutes = pad(d.getUTCMinutes());
    const seconds = pad(d.getUTCSeconds());

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // convert 0 -> 12

    const day = pad(d.getUTCDate());
    const month = pad(d.getUTCMonth() + 1);
    const year = d.getUTCFullYear();

    return `${day}/${month}/${year} ${pad(hours)}:${minutes}:${seconds} ${ampm}`;
};

export default {
    getCurrentTimeISOString,
    toLocalISOString,
    getCurrentLocalDateString,
    formatISTDateTime
};
