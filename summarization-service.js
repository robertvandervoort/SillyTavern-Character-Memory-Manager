/**
 * Summarization Service
 * Handles generating summaries of chat conversations
 */

import { callPopup } from '../../../../script.js';

/**
 * Summarize a chat conversation
 * @param {Array} messages - Array of chat messages
 * @param {string} characterName - Name of the character
 * @param {string} userName - Name of the user
 * @param {string} promptTemplate - Template for the summarization prompt
 * @param {boolean} useSeparateModel - Whether to use a separate model
 * @param {string} modelEndpoint - Endpoint for the separate model
 * @param {string} apiKey - API key for the separate model
 * @returns {Promise<string>} - Summarized chat
 */
export async function summarizeChat(
    messages, 
    characterName, 
    userName, 
    promptTemplate,
    useSeparateModel = false,
    modelEndpoint = '',
    apiKey = ''
) {
    try {
        // Format the messages for the summary
        const formattedMessages = messages.map(msg => {
            const speaker = msg.is_user ? userName : characterName;
            return `${speaker}: ${msg.mes}`;
        }).join('\n');
        
        // Create the system message
        const systemMessage = promptTemplate
            .replace(/{{char}}/g, characterName)
            .replace(/{{user}}/g, userName)
            .replace(/{{count}}/g, messages.length);
        
        // Decide which method to use for summarization
        if (useSeparateModel && modelEndpoint) {
            return await callExternalModel(systemMessage, formattedMessages, modelEndpoint, apiKey);
        } else {
            return await callCurrentModel(systemMessage, formattedMessages);
        }
    } catch (error) {
        console.error('Memory Manager: Summarization error', error);
        throw error;
    }
}

/**
 * Call the currently loaded model in SillyTavern
 * @param {string} systemMessage - System message for the model
 * @param {string} userMessage - User message containing the conversation
 * @returns {Promise<string>} - Summarized chat
 */
async function callCurrentModel(systemMessage, userMessage) {
    try {
        // Check if the ST API function exists
        if (typeof generateQuietPrompt !== 'function') {
            console.warn('Memory Manager: generateQuietPrompt not available, using fallback');
            // Fallback: show a popup asking the user to summarize
            const result = await callPopup(
                `<h3>Memory Manager needs to summarize recent messages</h3>
                <p>System Instruction: ${systemMessage}</p>
                <p>Please summarize:</p>
                <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">${userMessage}</div>
                <textarea id="summary_input" style="width: 100%; height: 100px;"></textarea>`,
                'input'
            );
            return result || '';
        }
        
        // Use SillyTavern's API to generate a summarization
        const messages = [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
        ];
        
        // Call the ST API (may vary depending on ST version)
        const response = await generateQuietPrompt(messages, null, 2000);
        return response.generation || '';
    } catch (error) {
        console.error('Memory Manager: Error calling current model', error);
        return '';
    }
}

/**
 * Call an external model API for summarization
 * @param {string} systemMessage - System message for the model
 * @param {string} userMessage - User message containing the conversation
 * @param {string} modelEndpoint - API endpoint for the model
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<string>} - Summarized chat
 */
async function callExternalModel(systemMessage, userMessage, modelEndpoint, apiKey) {
    try {
        // Create the request body
        const requestBody = {
            model: 'gpt-3.5-turbo', // Default model, can be overridden by the API
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: userMessage }
            ],
            max_tokens: 500,
            temperature: 0.7
        };
        
        // Make the API request
        const response = await fetch(modelEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey ? `Bearer ${apiKey}` : undefined
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle different API response formats
        if (data.choices && data.choices.length > 0) {
            if (data.choices[0].message) {
                return data.choices[0].message.content;
            } else if (data.choices[0].text) {
                return data.choices[0].text;
            }
        }
        
        throw new Error('Unexpected API response format');
    } catch (error) {
        console.error('Memory Manager: External model API error', error);
        throw error;
    }
}