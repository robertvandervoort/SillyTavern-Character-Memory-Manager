import { summarizeChat } from "./summarization-service.js";
import { updateCharacterNotes, isNewInformation } from "./memory-manager.js";

// =========================================
// Character Memory Manager Extension
// =========================================

// Extension configuration
const extensionName = "character_memory_manager";
const displayName = "Character Memory Manager";

// Extension variables
let messageCounter = 0;
let processingMemory = false;
let notificationTimeout;
let extension = null;

// =========================================
// Extension Definition
// =========================================

/**
 * This object contains all the extension methods and properties
 */
const CharacterMemoryManager = {
    name: extensionName,
    
    // Default settings
    settings: {
        enabled: true,
        messagesBeforeSummarize: 20,
        showNotifications: true,
        useSeparateModel: false,
        separateModelEndpoint: "",
        separateModelApiKey: "",
        summarizationPrompt: "Pause your chat with the user and summarize the last {{count}} messages in this array. Provide a summarized listicle of any interesting events, relationship dynamics, promises made or deeds performed including summaries of any noteworthy conversations between {{user}} and {{char}}."
    },
    
    // HTML elements for the UI
    elements: {
        notification: null
    },
    
    /**
     * Initialize the extension
     */
    init() {
        // Create notification element
        this.createNotificationElement();
        this.registerSlashCommands();
        
        // Hook message event
        this.hookMessageEvent();
        
        console.log(`${displayName} extension initialized`);
    },
    
    /**
     * Create the notification element
     */
    createNotificationElement() {
        const notification = document.createElement('div');
        notification.id = 'memory-manager-notification';
        notification.className = 'memory-manager-notification';
        notification.style.display = 'none';
        document.body.appendChild(notification);
        this.elements.notification = notification;
    },
    
    /**
     * Register slash commands
     */
    registerSlashCommands() {
        // Register slash command for manual memory update
        if (window.registerSlashCommand) {
            window.registerSlashCommand('memoryupdate', async (args) => {
                if (!this.settings.enabled) {
                    return `${displayName} is disabled. Enable it in the extensions settings first.`;
                }
                
                messageCounter = this.settings.messagesBeforeSummarize; // Force update
                await this.checkAndUpdateMemories();
                return "Memory update process triggered.";
            }, [], "Trigger memory update process for the current character");
            
            console.log(`${displayName} slash command registered`);
        } else {
            console.error(`${displayName} could not register slash command - registerSlashCommand not available`);
        }
    },
    
    /**
     * Hook into the message sending event
     */
    hookMessageEvent() {
        const self = this;
        const originalSendMessageFunction = window.sendMessageOriginal || window.sendMessage;
        
        window.sendMessageOriginal = originalSendMessageFunction;
        window.sendMessage = async function(...args) {
            const result = await originalSendMessageFunction.apply(this, args);
            if (self.settings.enabled) {
                self.checkAndUpdateMemories();
            }
            return result;
        };
    },
    
    /**
     * Show a notification message
     * @param {string} message - The message to show
     * @param {boolean} isError - Whether it's an error notification
     */
    showNotification(message, isError = false) {
        const notification = this.elements.notification;
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
    },
    
    /**
     * Generate settings HTML for the extension
     * @returns {string} HTML for the settings UI
     */
    getSettingsHtml() {
        const settings = this.settings;
        
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
    },
    
    /**
     * Handle settings changes
     * @param {HTMLElement} settingsDiv - The settings container element
     */
    onSettingsChange(settingsDiv) {
        // Update settings from DOM
        this.settings.enabled = $('#memory-manager-enabled', settingsDiv).prop('checked');
        this.settings.messagesBeforeSummarize = Number($('#memory-manager-message-count', settingsDiv).val());
        this.settings.showNotifications = $('#memory-manager-notifications', settingsDiv).prop('checked');
        this.settings.useSeparateModel = $('#memory-manager-separate-model', settingsDiv).prop('checked');
        this.settings.separateModelEndpoint = $('#memory-manager-model-endpoint', settingsDiv).val();
        this.settings.separateModelApiKey = $('#memory-manager-model-api-key', settingsDiv).val();
        this.settings.summarizationPrompt = $('#memory-manager-summarization-prompt', settingsDiv).val();
        
        // Show/hide separate model settings based on checkbox
        $('#memory-manager-separate-model-settings', settingsDiv).toggle(this.settings.useSeparateModel);
        
        // Save the settings to extension
        if (window.saveSettingsDebounced) {
            window.saveSettingsDebounced();
        }
    },
    
    /**
     * Initialize settings UI elements
     * @param {HTMLElement} settingsDiv - The settings container element
     */
    settingsInit(settingsDiv) {
        const self = this;
        
        // Set up event handlers
        $('#memory-manager-separate-model', settingsDiv).on('change', function() {
            $('#memory-manager-separate-model-settings', settingsDiv).toggle($(this).prop('checked'));
        });
        
        // Add other event listeners if needed
        console.log(`${displayName} settings initialized`);
    },
    
    /**
     * Main function to check and update character memories
     */
    async checkAndUpdateMemories() {
        // Avoid running if already processing
        if (processingMemory) {
            return;
        }
        
        // Get context from SillyTavern
        const context = window.getContext ? window.getContext() : null;
        if (!context || !context.chat || !context.chat.length) {
            return;
        }
        
        messageCounter++;
        
        if (messageCounter >= this.settings.messagesBeforeSummarize) {
            processingMemory = true;
            
            // Show notification
            if (this.settings.showNotifications) {
                this.showNotification("Updating character memories...");
            }
            
            try {
                // Get the last X messages
                const lastMessages = context.chat.slice(-this.settings.messagesBeforeSummarize);
                
                // Get character and user info
                const characterName = context.name2;
                const userName = context.name1;
                
                // Summarize the chat
                const summarizedChat = await summarizeChat(
                    lastMessages, 
                    characterName, 
                    userName, 
                    this.settings.summarizationPrompt,
                    this.settings.useSeparateModel,
                    this.settings.separateModelEndpoint,
                    this.settings.separateModelApiKey
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
                    if (this.settings.showNotifications) {
                        this.showNotification("Character memories updated with new information!");
                    }
                } else {
                    // Show no updates notification
                    if (this.settings.showNotifications) {
                        this.showNotification("No new information to add to character memories.");
                    }
                }
                
                // Reset counter
                messageCounter = 0;
            } catch (error) {
                console.error(`${displayName} error:`, error);
                if (this.settings.showNotifications) {
                    this.showNotification("Failed to update character memories: " + error.message, true);
                }
            } finally {
                processingMemory = false;
            }
        }
    }
};

// =========================================
// Extension Registration
// =========================================

/**
 * Register the extension with SillyTavern
 */
(function() {
    // This is the standard way SillyTavern extensions are defined
    // Store the extension object in global scope
    extension = CharacterMemoryManager;
    
    // If the extension has settings functionality:
    if (window.extensionSettings) {
        if (!window.extensionSettings[extension.name]) {
            window.extensionSettings[extension.name] = {};
        }
        // Copy the default settings
        for (const key in extension.settings) {
            if (!Object.hasOwn(window.extensionSettings[extension.name], key)) {
                window.extensionSettings[extension.name][key] = extension.settings[key];
            }
        }
        // Use the saved settings
        extension.settings = window.extensionSettings[extension.name];
    }
    
    // Once the page has loaded
    $(document).ready(function() {
        // Initialize the extension
        extension.init();
        
        // Register settings if available
        if (window.addSettings) {
            window.addSettings({
                name: displayName,
                id: extension.name,
                settings: extension.getSettingsHtml(),
                onSettingsChange: extension.onSettingsChange.bind(extension),
                init: extension.settingsInit.bind(extension)
            });
            console.log(`${displayName} settings registered`);
        } else {
            console.log(`${displayName} couldn't register settings - addSettings not available`);
        }
    });
})();
