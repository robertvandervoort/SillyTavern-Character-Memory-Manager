import { extension_settings, getContext, saveSettingsDebounced } from "../../../script.js";
import { callPopup, getRequestHeaders } from "../../../../script.js";
import { summarizeChat } from "./summarization-service.js";
import { updateCharacterNotes, isNewInformation } from "./memory-manager.js";
import { registerSlashCommand } from "../../../slash-commands.js";

// Initialize extension settings
if (!extension_settings.characterMemoryManager) {
    extension_settings.characterMemoryManager = {
        enabled: true,
        messagesBeforeSummarize: 20,
        showNotifications: true,
        useSeparateModel: false,
        separateModelEndpoint: "",
        separateModelApiKey: "",
        summarizationPrompt: "Pause your chat with the user and summarize the last X messages in this array. Provide a summarized listicle of any interesting events, relationship dynamics, promises made or deeds performed including summaries of any noteworthy conversations between {{user}} and {{char}}."
    };
}

const settings = extension_settings.characterMemoryManager;
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
registerSlashCommand('memoryupdate', async (args) => {
    if (!settings.enabled) {
        return "Character Memory Manager is disabled. Enable it in the extensions settings first.";
    }

    messageCounter = settings.messagesBeforeSummarize; // Force update
    await checkAndUpdateMemories();
    return "Memory update process triggered.";
});

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

// Create the HTML elements for the extension
function createUI() {
    const settingsHtml = document.createElement('div');
    settingsHtml.className = 'memory-manager-settings';
    settingsHtml.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Character Memory Manager</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
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
                    <div class="memory-manager-hint">Use {{user}} for user name and {{char}} for character name</div>
                </div>
            </div>
        </div>
    `;

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'memory-manager-notification';
    notification.className = 'memory-manager-notification';
    notification.style.display = 'none';
    document.body.appendChild(notification);

    // Add settings UI to extensions menu
    document.getElementById('extensions_settings').appendChild(settingsHtml);

    // Event listeners for settings
    document.getElementById('memory-manager-enabled').addEventListener('change', function() {
        settings.enabled = this.checked;
        saveSettingsDebounced();
    });

    document.getElementById('memory-manager-message-count').addEventListener('change', function() {
        settings.messagesBeforeSummarize = parseInt(this.value) || 20;
        saveSettingsDebounced();
    });

    document.getElementById('memory-manager-notifications').addEventListener('change', function() {
        settings.showNotifications = this.checked;
        saveSettingsDebounced();
    });

    document.getElementById('memory-manager-separate-model').addEventListener('change', function() {
        settings.useSeparateModel = this.checked;
        document.getElementById('memory-manager-separate-model-settings').style.display = this.checked ? 'block' : 'none';
        saveSettingsDebounced();
    });

    document.getElementById('memory-manager-model-endpoint').addEventListener('change', function() {
        settings.separateModelEndpoint = this.value;
        saveSettingsDebounced();
    });

    document.getElementById('memory-manager-model-api-key').addEventListener('change', function() {
        settings.separateModelApiKey = this.value;
        saveSettingsDebounced();
    });

    document.getElementById('memory-manager-summarization-prompt').addEventListener('change', function() {
        settings.summarizationPrompt = this.value;
        saveSettingsDebounced();
    });
    
    // Setup drawer toggle behavior
    settingsHtml.querySelector('.inline-drawer-toggle').addEventListener('click', function() {
        const icon = this.querySelector('.inline-drawer-icon');
        const content = this.nextElementSibling;
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.classList.remove('fa-circle-chevron-down');
            icon.classList.add('fa-circle-chevron-up');
        } else {
            content.style.display = 'none';
            icon.classList.remove('fa-circle-chevron-up');
            icon.classList.add('fa-circle-chevron-down');
        }
    });
}

// Hook into SillyTavern events
function onSendMessage() {
    if (settings.enabled) {
        checkAndUpdateMemories();
    }
}

// Initialize the extension
jQuery(async () => {
    createUI();
    
    // Hook into the message sending event
    const originalSendMessageFunction = window.sendMessageOriginal || window.sendMessage;
    
    window.sendMessageOriginal = originalSendMessageFunction;
    window.sendMessage = async function(...args) {
        const result = await originalSendMessageFunction.apply(this, args);
        onSendMessage();
        return result;
    };
});
