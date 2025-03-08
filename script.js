// This file serves as a bridge between the SillyTavern API and our extension
// It's kept separate to allow for easier maintenance and updates

// Export any globally needed functions or variables
export const version = '1.0.0';

/**
 * Helper function to format a date into a consistent format
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    });
}

/**
 * Extracts names from the message text
 * @param {string} text - Message text
 * @returns {Array} - Array of detected names
 */
export function extractNames(text) {
    // Simple regex to find capitalized words that might be names
    const nameRegex = /\b[A-Z][a-z]+\b/g;
    return [...new Set(text.match(nameRegex) || [])];
}
