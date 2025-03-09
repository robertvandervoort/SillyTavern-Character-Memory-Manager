/**
 * Memory Manager Module
 * Handles checking for new information and updating character notes
 */

import { saveSettingsDebounced, callPopup, characters } from '../../../../script.js';
import { formatDate } from './script.js';

/**
 * Check if the summary contains new information not already in character notes
 * @param {string} summary - The chat summary
 * @param {string} characterNotes - Current character notes
 * @param {string} userPersona - User persona information
 * @returns {string|null} - New information if found, null otherwise
 */
export function isNewInformation(summary, characterNotes, userPersona) {
    if (!summary || summary.trim().length === 0) {
        console.log('Memory Manager: No summary provided');
        return null;
    }
    
    // If there are no existing notes, all information is new
    if (!characterNotes || characterNotes.trim().length === 0) {
        return summary;
    }
    
    // Simple heuristic: Check if any sentences in the summary are not in the notes
    // This is a basic implementation that could be improved with more sophisticated NLP
    const summaryItems = summary.split(/\.\s+|\n+/).filter(item => 
        item && item.trim().length > 10  // Only consider meaningful sentences
    );
    
    const newItems = summaryItems.filter(item => {
        // Check if this information is already in the notes
        const itemLower = item.toLowerCase().trim();
        const notesLower = characterNotes.toLowerCase();
        
        // If the exact sentence or something very similar exists in notes, skip it
        return !notesLower.includes(itemLower) && 
               !notesLower.includes(itemLower.substring(0, itemLower.length - 5));
    });
    
    if (newItems.length === 0) {
        return null;
    }
    
    // Format the new information with bullet points and a date
    const date = formatDate(new Date());
    let newInformation = `\n\n--- Memory Update (${date}) ---\n`;
    
    newItems.forEach(item => {
        newInformation += `• ${item.trim()}.\n`;
    });
    
    return newInformation;
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
        if (!characterId || !newInformation) {
            console.error('Memory Manager: Missing character ID or new information');
            return false;
        }
        
        // Find the character in the current character array
        const character = characters.find(char => char.avatar === characterId);
        
        if (!character) {
            console.error(`Memory Manager: Character with ID ${characterId} not found`);
            return false;
        }
        
        // Update the character notes
        const updatedNotes = currentNotes ? currentNotes + newInformation : newInformation;
        
        // Update character data
        if (!character.data) {
            character.data = {};
        }
        
        character.data.character_notes = updatedNotes;
        
        // Save the character file
        await updateCharacter(character);
        
        return true;
    } catch (error) {
        console.error('Memory Manager: Error updating character notes', error);
        return false;
    }
}

/**
 * Update the character file
 * @param {object} character - Character object to update
 * @returns {Promise<void>}
 */
async function updateCharacter(character) {
    try {
        // Check if the saveCharacterDebounced function exists
        if (typeof saveCharacterDebounced === 'function') {
            await saveCharacterDebounced();
        } else {
            // Fallback to manual character saving via API
            await callPopup('Character notes updated. Please save the character manually.', 'text');
        }
    } catch (error) {
        console.error('Memory Manager: Error saving character', error);
        throw error;
    }
}