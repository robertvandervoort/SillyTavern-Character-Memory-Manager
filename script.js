/**
 * Character Memory Manager - Utility Functions
 */

// Export version for manifest compatibility
export const version = '1.0.0';

/**
 * Helper function to format a date into a consistent format
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month}/${day}/${year} ${hours}:${minutes}`;
}

/**
 * Extracts names from the message text
 * @param {string} text - Message text
 * @returns {Array} - Array of detected names
 */
export function extractNames(text) {
    const matches = text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || [];
    return [...new Set(matches)]; // Deduplicate names
}

/**
 * Adds timestamp and formatting to memory entries
 * @param {string} text - Memory text
 * @returns {string} - Formatted memory entry
 */
export function formatMemoryEntry(text) {
    if (!text || text.trim().length === 0) {
        return '';
    }
    
    const date = formatDate(new Date());
    return `[${date}] ${text}`;
}

/**
 * Parses a summarized list and returns an array of memory items
 * @param {string} summary - The summarized text
 * @returns {Array} - Array of memory items
 */
export function parseMemoryItems(summary) {
    if (!summary) return [];
    
    // Look for bullet points, numbers, or line breaks as separators
    const lines = summary.split(/\n|•|\*|(?:\d+\.)/);
    
    return lines
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

/**
 * Returns a JSON-safe copy of an object
 * @param {object} obj - Object to copy
 * @returns {object} - JSON-safe copy
 */
export function safeClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}