import { getContext, getRequestHeaders, callPopup, saveSettingsDebounced, registerSlashCommand, extensionSettings, addSettings, getExtensionPrompt } from "../../../../script.js";
import { summarizeChat } from "./summarization-service.js";
import { updateCharacterNotes, isNewInformation } from "./memory-manager.js";

// Extension settings object - use a consistent naming convention
const extension_name = 'character_memory_manager';
if (!extensionSettings[extension_name]) {
    extensionSettings[extension_name] = {
        enabled: true,
        messagesBeforeSummarize: 20,
        showNotifications: true,
        useSeparateModel: false,
        separateModelEndpoint: "",
        separateModelApiKey: "",
        summarizationPrompt: "Pause your chat with the user and summarize the last {{count}} messages in this array. Provide a summarized listicle of any interesting events, relationship dynamics, promises made or deeds performed including summaries of any noteworthy conversations between {{user}} and {{char}}."
    };
}

// Use the unified naming convention for settings
const settings = extensionSettings[extension_name];
let messageCounter = 0;
let processingMemory = false;

// Main function to check and update character memories
async function checkAndUpdateMemories() {
    // Avoid running if already processing
    if (processingMemory) {
        return;
    }

    const context = getContext();
    if (!context.chat || !context.chat.length) {
        return;
    }

    messageCounter++;

    if (messageCounter >= settings.messagesBeforeSummarize) {
        processingMemory = true;
        
        // Show notification
        if (settings.showNotifications) {
            showNotification("Updating character memories...");
        }

        try {
            // Get the last X messages
            const lastMessages = context.chat.slice(-settings.messagesBeforeSummarize);
            
            // Get character and user info
            const characterName = context.name2;
            const userName = context.name1;
            
            // Summarize the chat
            const summarizedChat = await summarizeChat(
                lastMessages, 
                characterName, 
                userName, 
                settings.summarizationPrompt,
                settings.useSeparateModel,
                settings.separateModelEndpoint,
                settings.separateModelApiKey
            );
            
            // Get character description and persona info
            const characterInfo = context.characters[context.characterId];
            const characterNotes = characterInfo?.data?.character_notes || "";
            const userPersona = context.personalUserName ? context.persona_description || "" : "";
            
            // Check if the summary contains new information not in notes
            const newInformation = isNewInformation(summarizedChat, characterNotes, userPersona);
            
            if (newInformation) {
                // Update character notes with new information
                await updateCharacterNotes(context.characterId, characterNotes, newInformation);
                
                // Show success notification
                if (settings.showNotifications) {
                    showNotification("Character memories updated with new information!");
                }
            } else {
                // Show no updates notification
                if (settings.showNotifications) {
                    showNotification("No new information to add to character memories.");
                }
            }
            
            // Reset counter
            messageCounter = 0;
        } catch (error) {
            console.error("Error in character memory manager:", error);
            if (settings.showNotifications) {
                showNotification("Failed to update character memories: " + error.message, true);
            }
        } finally {
            processingMemory = false;
        }
    }
}

// Register a slash command to force memory update
registerSlashCommand('memoryupdate', (args) => {
    if (!settings.enabled) {
        return "Character Memory Manager is disabled. Enable it in the extensions settings first.";
    }

    messageCounter = settings.messagesBeforeSummarize; // Force update
    checkAndUpdateMemories();
    return "Memory update process triggered.";
}, [], "Trigger memory update process for the current character");

// Notification system
let notificationTimeout;
function showNotification(message, isError = false) {
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
}

// Empty - we've replaced this with addSettings

// Create settings HTML
function getSettingsHTML() {
    return `
        <div class="memory-manager-block">
            <label class="checkbox_label" for="memory-manager-enabled">
                <input id="memory-manager-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''} />
                <span>Enable Character Memory Manager</span>
            </label>
        </div>
        
        <div class="memory-manager-block">
            <label for="memory-manager-message-count">Number of messages before summarization:</label>
            <input id="memory-manager-message-count" type="number" min="5" max="100" value="${settings.messagesBeforeSummarize}" />
        </div>
        
        <div class="memory-manager-block">
            <label class="checkbox_label" for="memory-manager-notifications">
                <input id="memory-manager-notifications" type="checkbox" ${settings.showNotifications ? 'checked' : ''} />
                <span>Show notifications</span>
            </label>
        </div>
        
        <div class="memory-manager-block">
            <label class="checkbox_label" for="memory-manager-separate-model">
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
    `;
}

// Register the settings and add them to the UI
jQuery(async () => {
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'memory-manager-notification';
    notification.className = 'memory-manager-notification';
    notification.style.display = 'none';
    document.body.appendChild(notification);

    // Add settings using SillyTavern's API
    addSettings({
        name: 'Character Memory Manager',
        id: extension_name,
        settings: getSettingsHTML(),
        onSettingsChange: function(settingsDiv) {
            // Update settings from DOM
            settings.enabled = $('#memory-manager-enabled').prop('checked');
            settings.messagesBeforeSummarize = Number($('#memory-manager-message-count').val());
            settings.showNotifications = $('#memory-manager-notifications').prop('checked');
            settings.useSeparateModel = $('#memory-manager-separate-model').prop('checked');
            settings.separateModelEndpoint = $('#memory-manager-model-endpoint').val();
            settings.separateModelApiKey = $('#memory-manager-model-api-key').val();
            settings.summarizationPrompt = $('#memory-manager-summarization-prompt').val();
            
            // Show/hide separate model settings based on checkbox
            $('#memory-manager-separate-model-settings').toggle(settings.useSeparateModel);
            
            // Save the settings
            saveSettingsDebounced();
        },
        init: function(settingsDiv) {
            // Set up the event handlers
            $('#memory-manager-separate-model', settingsDiv).on('change', function() {
                $('#memory-manager-separate-model-settings').toggle($(this).prop('checked'));
            });
        }
    });
    
    console.log('Character Memory Manager: Extension initialized');
    
    // Hook into the message sending event
    const originalSendMessageFunction = window.sendMessageOriginal || window.sendMessage;
    
    window.sendMessageOriginal = originalSendMessageFunction;
    window.sendMessage = async function(...args) {
        const result = await originalSendMessageFunction.apply(this, args);
        if (settings.enabled) {
            checkAndUpdateMemories();
        }
        return result;
    };
});
