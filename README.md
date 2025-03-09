# Character Memory Manager for SillyTavern

A SillyTavern extension that creates intelligent, persistent character memories by dynamically summarizing chat interactions and maintaining evolving character notes.

## Features

- **Automatic Summarization**: Periodically summarizes conversations to extract important details
- **Smart Memory Integration**: Detects new information and adds it to character notes
- **Configurable Intervals**: Choose how often to update character memories
- **Manual Updates**: Trigger memory updates on demand with the `/memoryupdate` command
- **Notification System**: Get informed when memories are updated
- **Custom Prompts**: Configure the summarization prompt to your liking
- **External API Support**: Use your own API for summarization

## Installation

1. Download this repository as a ZIP file
2. Extract the folder to `SillyTavern/public/scripts/extensions/third-party/`
3. Rename the extracted folder to `SillyTavern-Character-Memory-Manager` if necessary
4. Restart SillyTavern
5. Enable the extension in SillyTavern's Extensions menu

## Usage

1. Configure the extension settings:
   - Set the message count threshold for automatic summarization
   - Toggle notifications
   - Enable/disable separate model for summarization
   - Customize the summarization prompt

2. Start chatting with your character! The extension will automatically:
   - Track messages
   - Summarize conversations when the threshold is reached
   - Update character notes with new information

3. Use the `/memoryupdate` slash command to manually trigger a memory update at any time.

## Configuration

### Basic Settings

- **Enable/Disable**: Turn the extension on or off
- **Message Count**: Number of messages before triggering summarization (default: 20)
- **Show Notifications**: Display notification popups when memories are updated

### Advanced Settings

- **Use Separate Model**: Use an external API for summarization instead of the current SillyTavern model
- **Model Endpoint**: URL to your chat completions API (OpenAI-compatible format)
- **API Key**: Your API key for authentication
- **Summarization Prompt**: Template for how summaries should be generated

## How It Works

1. **Monitoring**: The extension counts messages as you chat
2. **Summarization**: When the threshold is reached, it generates a summary of the recent conversation
3. **Analysis**: It checks if the summary contains new information not already in character notes
4. **Update**: If new information is found, it adds it to the character's notes with a timestamp
5. **Persistence**: The updated character notes are saved to the character card

## License

MIT License