// We'll access these functions through the global window object instead of imports
// This ensures better compatibility with SillyTavern's extension system

/**
 * Check if the summary contains information not already in character notes or user persona
 * @param {string} summary - The summary of recent chat messages
 * @param {string} characterNotes - Existing character notes
 * @param {string} userPersona - User persona description
 * @returns {string|null} - New information to be added, or null if no new info
 */
export function isNewInformation(summary, characterNotes, userPersona) {
    if (!summary || !summary.trim()) {
        return null;
    }

    // For a very basic check, split summary into sentences
    const summaryPoints = summary.split(/\.\s+/);
    let newInfo = [];

    // Check each point in the summary
    for (const point of summaryPoints) {
        if (!point.trim()) continue;
        
        // If this point is not in character notes and not in user persona, it's new
        if (!characterNotes.toLowerCase().includes(point.toLowerCase()) && 
            !userPersona.toLowerCase().includes(point.toLowerCase())) {
            newInfo.push(point.trim());
        }
    }

    if (newInfo.length === 0) {
        return null;
    }

    // Format the new information
    const formattedInfo = `\n\n--- Memory Update (${new Date().toLocaleString()}) ---\n${newInfo.map(info => `• ${info}`).join('\n')}`;
    
    return formattedInfo;
}

/**
 * Update character notes with new information
 * @param {string} characterId - ID of the character to update
 * @param {string} currentNotes - Current character notes
 * @param {string} newInformation - New information to add
 * @returns {Promise<boolean>} - Whether update was successful
 */
export async function updateCharacterNotes(characterId, currentNotes, newInformation) {
    try {
        // Append new information to current notes
        const updatedNotes = currentNotes + newInformation;
        
        // Get the current character data
        const response = await fetch(`/api/characters/get`, {
            method: 'POST',
            headers: window.getRequestHeaders ? window.getRequestHeaders() : { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: characterId }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get character data: ${response.statusText}`);
        }
        
        const characterData = await response.json();
        
        // Update the character notes
        characterData.data.character_notes = updatedNotes;
        
        // Save the updated character
        const saveResponse = await fetch('/api/characters/edit', {
            method: 'PUT',
            headers: window.getRequestHeaders ? window.getRequestHeaders() : { 'Content-Type': 'application/json' },
            body: JSON.stringify(characterData),
        });
        
        if (!saveResponse.ok) {
            throw new Error(`Failed to save character data: ${saveResponse.statusText}`);
        }
        
        // Update the UI if the character is currently loaded
        if (window.getCurrentChatId() === characterId) {
            const textarea = document.getElementById('character_notes');
            if (textarea) {
                textarea.value = updatedNotes;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error updating character notes:', error);
        return false;
    }
}
