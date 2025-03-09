/**
 * Character Memory Manager
 * Creates persistent character memories by automatically summarizing chats
 * and updating character notes with new information.
 */

// Import utility functions
import { summarizeChat } from "./summarization-service.js";
import { updateCharacterNotes, isNewInformation } from "./memory-manager.js";

// Define our extension name and display name
const extensionName = "character_memory_manager";
const displayName = "Character Memory Manager";

// Tracking variables
let messageCounter = 0;
let processingMemory = false;
let notificationTimeout;

// Create the extension object for ST
window[extensionName] = {
    // Extension metadata - should match manifest.json
    name: extensionName,
    version: "1.0.0",
    
    // Default settings
    defaultSettings: {
        enabled: true,
        messagesBeforeSummarize: 20,
        showNotifications: true,
        useSeparateModel: false,
        separateModelEndpoint: "",
        separateModelApiKey: "",
        summarizationPrompt: "Pause your chat with the user and summarize the last {{count}} messages in this array. Provide a summarized listicle of any interesting events, relationship dynamics, promises made or deeds performed including summaries of any noteworthy conversations between {{user}} and {{char}}."
    },
    
    // This will hold the user's settings once loaded
    settings: {},
    
    // Elements
    elements: {
        notification: null
    },
    
    // Initialize the extension
    async init() {
        // Load settings from browser storage
        if (Object.keys(this.settings).length === 0) {
            // Initialize with default settings if none exist
            console.log(`${displayName}: initializing settings`);
            this.settings = this.defaultSettings;
            
            // If extension settings exist in the browser
            if (window.extension_settings && !window.extension_settings[extensionName]) {
                window.extension_settings[extensionName] = this.defaultSettings;
            }
            
            // If they exist, use those settings
            if (window.extension_settings && window.extension_settings[extensionName]) {
                this.settings = window.extension_settings[extensionName];
            }
        }
        
        // Create UI notification element
        this.createNotificationElement();
        
        // Register slash commands
        this.registerSlashCommands();
        
        // Hook into message sending
        this.hookMessageEvent();
        
        console.log(`${displayName} v1.0.0 loaded`);
    },
    
    /**
     * Create notification element
     */
    createNotificationElement() {
        const existingNotification = document.getElementById('memory-manager-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
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
        try {
            // We need to use the ST registerSlashCommand function
            if (window.registerSlashCommand) {
                window.registerSlashCommand('memoryupdate', async (args) => {
                    if (!this.settings.enabled) {
                        return `${displayName} is disabled. Enable it in the extensions settings first.`;
                    }
                    
                    // Force update by setting the counter
                    messageCounter = this.settings.messagesBeforeSummarize;
                    await this.checkAndUpdateMemories();
                    return "Memory update process triggered.";
                }, [], "Trigger memory update process for the current character");
                
                console.log(`${displayName} slash command registered`);
            } else {
                console.warn(`${displayName} could not register slash commands - function not available`);
            }
        } catch (error) {
            console.error(`${displayName} error registering slash commands:`, error);
        }
    },
    
    /**
     * Hook into message sending event
     */
    hookMessageEvent() {
        try {
            // Store original function and reference to this
            const self = this;
            const originalSendMessageFunction = window.sendMessageOriginal || window.sendMessage;
            
            if (typeof originalSendMessageFunction !== 'function') {
                console.warn(`${displayName} could not hook into message send event - function not available`);
                return;
            }
            
            // Preserve the original and create our wrapper
            window.sendMessageOriginal = originalSendMessageFunction;
            window.sendMessage = async function(...args) {
                // Call original first
                const result = await originalSendMessageFunction.apply(this, args);
                
                // Then do our memory check if enabled
                if (self.settings.enabled) {
                    self.checkAndUpdateMemories();
                }
                
                return result;
            };
            
            console.log(`${displayName} hooked into message send event`);
        } catch (error) {
            console.error(`${displayName} error hooking message event:`, error);
        }
    },
    
    /**
     * Display a notification to the user
     */
    showNotification(message, isError = false) {
        try {
            const notification = this.elements.notification;
            if (notification) {
                // Clear any existing timer
                clearTimeout(notificationTimeout);
                
                // Set content and style
                notification.textContent = message;
                notification.classList.remove('error', 'success');
                notification.classList.add(isError ? 'error' : 'success');
                notification.style.display = 'block';
                
                // Auto-hide after delay
                notificationTimeout = setTimeout(() => {
                    notification.style.display = 'none';
                }, 3000);
            }
        } catch (error) {
            console.error(`${displayName} notification error:`, error);
        }
    },
    
    /**
     * Main logic to check and update memories
     */
    async checkAndUpdateMemories() {
        // Prevent multiple simultaneous runs
        if (processingMemory) {
            return;
        }
        
        try {
            // Get chat context from SillyTavern
            const context = window.getContext ? window.getContext() : null;
            if (!context || !context.chat || !context.chat.length) {
                return;
            }
            
            // Increment message counter
            messageCounter++;
            
            // Check if we've reached threshold
            if (messageCounter >= this.settings.messagesBeforeSummarize) {
                processingMemory = true;
                
                // Show notification
                if (this.settings.showNotifications) {
                    this.showNotification("Updating character memories...");
                }
                
                try {
                    // Get messages to summarize
                    const lastMessages = context.chat.slice(-this.settings.messagesBeforeSummarize);
                    
                    // Get character and user names
                    const characterName = context.name2;
                    const userName = context.name1;
                    
                    // Generate summary
                    const summarizedChat = await summarizeChat(
                        lastMessages, 
                        characterName, 
                        userName, 
                        this.settings.summarizationPrompt,
                        this.settings.useSeparateModel,
                        this.settings.separateModelEndpoint,
                        this.settings.separateModelApiKey
                    );
                    
                    // Get character info to check against existing notes
                    const characterInfo = context.characters[context.characterId];
                    const characterNotes = characterInfo?.data?.character_notes || "";
                    const userPersona = context.personalUserName ? context.persona_description || "" : "";
                    
                    // See if we have new information
                    const newInformation = isNewInformation(summarizedChat, characterNotes, userPersona);
                    
                    if (newInformation) {
                        // Update the character notes
                        await updateCharacterNotes(context.characterId, characterNotes, newInformation);
                        
                        // Success notification
                        if (this.settings.showNotifications) {
                            this.showNotification("Character memories updated with new information!");
                        }
                    } else {
                        // No new info notification
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
        } catch (error) {
            console.error(`${displayName} checkAndUpdateMemories error:`, error);
            processingMemory = false;
        }
    },
    
    /**
     * Create settings HTML
     */
    getSettings() {
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
     * Handle settings changes from UI
     */
    onSettingsChange() {
        try {
            // Update settings from UI inputs
            this.settings.enabled = $('#memory-manager-enabled').prop('checked');
            this.settings.messagesBeforeSummarize = Number($('#memory-manager-message-count').val());
            this.settings.showNotifications = $('#memory-manager-notifications').prop('checked');
            this.settings.useSeparateModel = $('#memory-manager-separate-model').prop('checked');
            this.settings.separateModelEndpoint = $('#memory-manager-model-endpoint').val();
            this.settings.separateModelApiKey = $('#memory-manager-model-api-key').val();
            this.settings.summarizationPrompt = $('#memory-manager-summarization-prompt').val();
            
            // Toggle visibility of model settings
            $('#memory-manager-separate-model-settings').toggle(this.settings.useSeparateModel);
            
            // Save to ST's extension_settings
            if (window.extension_settings) {
                window.extension_settings[extensionName] = this.settings;
            }
            
            // Trigger ST's save
            if (window.saveSettingsDebounced) {
                window.saveSettingsDebounced();
            }
        } catch (error) {
            console.error(`${displayName} settings save error:`, error);
        }
    }
};

// This is the entry point for SillyTavern extensions
jQuery(async () => {
    try {
        // Initialize the extension
        await window[extensionName].init();
        
        // Add the settings UI
        const settingsHtml = window[extensionName].getSettings();
        
        // Register our extension with SillyTavern's settings system
        const settingsConfig = {
            order: 10,
            text: displayName,
            onOpen: function() {
                // Update UI with current settings
                $('#memory-manager-enabled').prop('checked', window[extensionName].settings.enabled);
                $('#memory-manager-message-count').val(window[extensionName].settings.messagesBeforeSummarize);
                $('#memory-manager-notifications').prop('checked', window[extensionName].settings.showNotifications);
                $('#memory-manager-separate-model').prop('checked', window[extensionName].settings.useSeparateModel);
                $('#memory-manager-model-endpoint').val(window[extensionName].settings.separateModelEndpoint);
                $('#memory-manager-model-api-key').val(window[extensionName].settings.separateModelApiKey);
                $('#memory-manager-summarization-prompt').val(window[extensionName].settings.summarizationPrompt);
                
                // Show/hide the model settings
                $('#memory-manager-separate-model-settings').toggle(window[extensionName].settings.useSeparateModel);
            },
            html: settingsHtml,
        };
        
        // Register event handlers
        $('#memory-manager-enabled').on('change', () => window[extensionName].onSettingsChange());
        $('#memory-manager-message-count').on('change', () => window[extensionName].onSettingsChange());
        $('#memory-manager-notifications').on('change', () => window[extensionName].onSettingsChange());
        $('#memory-manager-separate-model').on('change', () => window[extensionName].onSettingsChange());
        $('#memory-manager-model-endpoint').on('input', () => window[extensionName].onSettingsChange());
        $('#memory-manager-model-api-key').on('input', () => window[extensionName].onSettingsChange());
        $('#memory-manager-summarization-prompt').on('input', () => window[extensionName].onSettingsChange());
        
        // Register with SillyTavern
        if (window.registerExtensionSettings) {
            window.registerExtensionSettings(extensionName, settingsConfig);
            console.log(`${displayName} registered extension settings`);
        } else {
            console.warn(`${displayName} could not register extension settings - function not available`);
        }
    } catch (error) {
        console.error(`${displayName} initialization error:`, error);
    }
});
