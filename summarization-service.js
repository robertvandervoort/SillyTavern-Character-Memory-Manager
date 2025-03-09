import { getRequestHeaders } from "../../../../script.js";

/**
 * Summarize chat messages using the configured model
 * @param {Array} messages - Array of chat messages
 * @param {string} characterName - Name of the character
 * @param {string} userName - Name of the user
 * @param {string} promptTemplate - Template for the summarization prompt
 * @param {boolean} useSeparateModel - Whether to use a separate model for summarization
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
        // Format messages for prompt
        const formattedMessages = messages.map(msg => {
            const name = msg.name === characterName ? characterName : userName;
            return `${name}: ${msg.mes}`;
        }).join('\n');
        
        // Create the summarization prompt
        const prompt = promptTemplate
            .replace('{{user}}', userName)
            .replace('{{char}}', characterName)
            .replace('{{count}}', messages.length);
            
        // Prepare the system message and content
        const systemMessage = `You are a summarization assistant. Your task is to extract key information from conversations. ${prompt}`;
        const userMessage = `Recent conversation:\n${formattedMessages}`;
        
        if (useSeparateModel && modelEndpoint) {
            // Use separate model with its own endpoint
            return await callExternalModel(systemMessage, userMessage, modelEndpoint, apiKey);
        } else {
            // Use the currently loaded model in SillyTavern
            return await callCurrentModel(systemMessage, userMessage);
        }
    } catch (error) {
        console.error('Error summarizing chat:', error);
        throw new Error('Failed to summarize chat: ' + error.message);
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
        // Use SillyTavern's current API to generate a response
        const response = await fetch('/api/extra/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                prompt: userMessage,
                system: systemMessage,
                max_tokens: 500,
                temperature: 0.7,
                stop: [],
                top_p: 1,
                top_k: 0,
                frequency_penalty: 0.01,
                presence_penalty: 0.01,
            }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        return data.text || data.response || '';
    } catch (error) {
        console.error('Error calling current model:', error);
        throw error;
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
        const headers = {
            'Content-Type': 'application/json',
        };
        
        // Add API key if provided
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        // Most APIs follow a similar format, assuming OpenAI-like API structure
        const payload = {
            model: "gpt-3.5-turbo", // Default model, could be overridden by API
            messages: [
                {
                    role: "system",
                    content: systemMessage
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            max_tokens: 500,
            temperature: 0.7,
        };
        
        const response = await fetch(modelEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`External API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        // Handle different API response formats
        if (data.choices && data.choices[0]) {
            return data.choices[0].message?.content || '';
        } else if (data.output) {
            return data.output;
        } else if (data.response) {
            return data.response;
        } else if (data.text) {
            return data.text;
        } else {
            console.warn('Unexpected API response format:', data);
            return JSON.stringify(data); // Return raw output if format is unknown
        }
    } catch (error) {
        console.error('Error calling external model:', error);
        throw error;
    }
}
