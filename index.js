import { eventSource, event_types, saveSettingsDebounced, getContext } from '../../../../script.js';
import { registerSlashCommand } from '../../../slash-commands.js';
import { extension_settings } from '../../../extensions.js';
import { summarizeChat } from './summarization-service.js';
import { updateCharacterNotes, isNewInformation } from './memory-manager.js';

/**
 * Character Memory Manager Extension
 * A SillyTavern extension that creates intelligent, persistent character memories
 * by dynamically summarizing chat interactions and maintaining evolving character notes.
 */

// Extension name needs to match directory name EXACTLY
const extensionName = 'SillyTavern-Character-Memory-Manager';
const displayName = 'Character Memory Manager';

// Initialize settings
if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = {
        enabled: true,
        messagesBeforeSummarize: 20,
        showNotifications: true,
        useSeparateModel: false,
        separateModelEndpoint: "",
        separateModelApiKey: "",
        summarizationPrompt: "Pause your chat with the user and summarize the last {{count}} messages in this array. Provide a summarized listicle of any interesting events, relationship dynamics, promises made or deeds performed including summaries of any noteworthy conversations between {{user}} and {{char}}."
    };
}

// Variables
let messageCounter = 0;
let processingMemory = false;
let settings = extension_settings[extensionName];
let notificationTimeout;

// Functions
function createNotificationElement() {
    const existingNotification = document.getElementById('memory-manager-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'memory-manager-notification';
    notification.className = 'memory-manager-notification';
    notification.style.display = 'none';
    document.body.appendChild(notification);
    return notification;
}

function showNotification(message, isError = false) {
    try {
        const notification = document.getElementById('memory-manager-notification');
        if (notification) {
            clearTimeout(notificationTimeout);
            notification.textContent = message;
            notification.classList.remove('error', 'success');
            notification.classList.add(isError ? 'error' : 'success');
            notification.style.display = 'block';
            
            notificationTimeout = setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error(`${displayName} notification error:`, error);
    }
}

/**
 * Main logic to check and update memories
 */
async function checkAndUpdateMemories() {
    // Prevent multiple simultaneous runs
    if (processingMemory || !settings.enabled) {
        return;
    }
    
    try {
        // Get chat context from SillyTavern
        const context = getContext();
        if (!context || !context.chat || !context.chat.length) {
            return;
        }
        
        // Increment message counter
        messageCounter++;
        
        // Check if we've reached threshold
        if (messageCounter >= settings.messagesBeforeSummarize) {
            processingMemory = true;
            
            // Show notification
            if (settings.showNotifications) {
                showNotification("Updating character memories...");
            }
            
            try {
                // Get messages to summarize
                const lastMessages = context.chat.slice(-settings.messagesBeforeSummarize);
                
                // Get character and user names
                const characterName = context.name2;
                const userName = context.name1;
                
                // Generate summary
                const summarizedChat = await summarizeChat(
                    lastMessages, 
                    characterName, 
                    userName, 
                    settings.summarizationPrompt,
                    settings.useSeparateModel,
                    settings.separateModelEndpoint,
                    settings.separateModelApiKey
                );
                
                console.log(`${displayName}: Generated summary:`, summarizedChat);
                
                // Get character info to check against existing notes
                const characterInfo = context.characters[context.characterId];
                const characterNotes = characterInfo?.data?.character_notes || "";
                const userPersona = context.persona_description || "";
                
                // See if we have new information
                const newInformation = isNewInformation(summarizedChat, characterNotes, userPersona);
                
                if (newInformation) {
                    // Update the character notes
                    await updateCharacterNotes(context.characterId, characterNotes, newInformation);
                    
                    // Success notification
                    if (settings.showNotifications) {
                        showNotification("Character memories updated with new information!");
                    }
                } else {
                    // No new info notification
                    if (settings.showNotifications) {
                        showNotification("No new information to add to character memories.");
                    }
                }
                
                // Reset counter
                messageCounter = 0;
            } catch (error) {
                console.error(`${displayName} memory update error:`, error);
                if (settings.showNotifications) {
                    showNotification("Failed to update character memories: " + error.message, true);
                }
            } finally {
                processingMemory = false;
            }
        }
    } catch (error) {
        console.error(`${displayName} checkAndUpdateMemories error:`, error);
        processingMemory = false;
    }
}

// Listen for new messages
eventSource.on(event_types.MESSAGE_SENT, async () => {
    if (settings.enabled) {
        await checkAndUpdateMemories();
    }
});

// Slash command for manual memory update
registerSlashCommand('memoryupdate', async (args) => {
    if (!settings.enabled) {
        return `${displayName} is disabled. Enable it in the extensions settings first.`;
    }
    
    // Force memory update by setting message counter to threshold
    messageCounter = settings.messagesBeforeSummarize;
    await checkAndUpdateMemories();
    
    return "Memory update process triggered.";
}, [], "Trigger memory update for the current character");

// Settings UI
function renderSettings() {
    const settingsHtml = `
    <div id="memory_manager_settings">
        <div class="memory-manager-block">
            <label class="checkbox_label">
                <input id="memory-manager-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''} />
                <span>Enable Character Memory Manager</span>
            </label>
        </div>
        
        <div class="memory-manager-block">
            <label for="memory-manager-message-count">Number of messages before summarization:</label>
            <input id="memory-manager-message-count" type="number" min="5" max="100" value="${settings.messagesBeforeSummarize}" />
        </div>
        
        <div class="memory-manager-block">
            <label class="checkbox_label">
                <input id="memory-manager-notifications" type="checkbox" ${settings.showNotifications ? 'checked' : ''} />
                <span>Show notifications</span>
            </label>
        </div>
        
        <div class="memory-manager-block">
            <label class="checkbox_label">
                <input id="memory-manager-separate-model" type="checkbox" ${settings.useSeparateModel ? 'checked' : ''} />
                <span>Use separate model for summarization</span>
            </label>
        </div>
        
        <div id="memory-manager-separate-model-settings" class="memory-manager-block" style="display: ${settings.useSeparateModel ? 'block' : 'none'}">
            <label for="memory-manager-model-endpoint">Model Endpoint URL:</label>
            <input id="memory-manager-model-endpoint" type="text" value="${settings.separateModelEndpoint}" placeholder="https://api.example.com/v1/chat/completions" />
            
            <label for="memory-manager-model-api-key">API Key (optional):</label>
            <input id="memory-manager-model-api-key" type="password" value="${settings.separateModelApiKey}" placeholder="API Key" />
        </div>
        
        <div class="memory-manager-block">
            <label for="memory-manager-summarization-prompt">Summarization Prompt:</label>
            <textarea id="memory-manager-summarization-prompt" rows="4">${settings.summarizationPrompt}</textarea>
            <div class="memory-manager-hint">Use {{user}} for user name, {{char}} for character name, and {{count}} for number of messages</div>
        </div>
    </div>`;
    
    return settingsHtml;
}

// Settings handlers
$(document).on('click', '#memory-manager-enabled', function() {
    settings.enabled = !!$(this).prop('checked');
    saveSettingsDebounced();
});

$(document).on('change', '#memory-manager-message-count', function() {
    settings.messagesBeforeSummarize = Number($(this).val());
    saveSettingsDebounced();
});

$(document).on('click', '#memory-manager-notifications', function() {
    settings.showNotifications = !!$(this).prop('checked');
    saveSettingsDebounced();
});

$(document).on('click', '#memory-manager-separate-model', function() {
    settings.useSeparateModel = !!$(this).prop('checked');
    $('#memory-manager-separate-model-settings').toggle(settings.useSeparateModel);
    saveSettingsDebounced();
});

$(document).on('input', '#memory-manager-model-endpoint', function() {
    settings.separateModelEndpoint = $(this).val();
    saveSettingsDebounced();
});

$(document).on('input', '#memory-manager-model-api-key', function() {
    settings.separateModelApiKey = $(this).val();
    saveSettingsDebounced();
});

$(document).on('input', '#memory-manager-summarization-prompt', function() {
    settings.summarizationPrompt = $(this).val();
    saveSettingsDebounced();
});

// Initialize the extension
jQuery(async () => {
    createNotificationElement();
    console.log(`${displayName} extension loaded`);
});

// This is the main export for SillyTavern to recognize the extension
export { renderSettings };