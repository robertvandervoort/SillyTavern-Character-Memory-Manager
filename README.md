# SillyTavern Character Memory Manager

A SillyTavern extension that creates intelligent, persistent character memories by dynamically summarizing chat interactions and maintaining evolving character notes.

![Character Memory Manager](memory-manager-preview.png)

## Features

- **Automatic Chat Summarization**: Periodically summarizes conversations at configurable intervals.
- **Intelligent Memory Update**: Extracts new information from summaries and adds it to character notes.
- **Timestamped Memory Entries**: Each memory update is clearly timestamped for easy reference.
- **Customizable Settings**: Configure summarization frequency, notifications, and more.
- **External Model Support**: Optional support for using external AI models for summarization.
- **Slash Command**: Use `/memoryupdate` to manually trigger the memory update process.

## Installation

### Option 1: Install from SillyTavern's Extensions Installer
1. Go to Extensions tab in SillyTavern
2. Find "Character Memory Manager" in the list
3. Click "Install"
4. Restart SillyTavern

### Option 2: Manual Installation
1. Clone this repository into the `public/scripts/extensions/third-party/` folder of your SillyTavern installation:
   ```
   cd public/scripts/extensions/third-party/
   git clone https://github.com/robertvandervoort/SillyTavern-Character-Memory-Manager.git
   ```
2. Restart SillyTavern
3. Enable the extension in the Extensions tab

## Usage

1. Enable the extension in SillyTavern's Extensions settings
2. Configure your preferred settings:
   - **Enabled**: Turn the memory manager on/off
   - **Messages Before Summarization**: How many messages should pass before triggering a summary (default: 20)
   - **Show Notifications**: Enable/disable on-screen notifications when memories are updated
   - **Use Separate Model**: Toggle to use an external API for summarization
   - **Summarization Prompt**: Customize the prompt used for generating summaries

3. Chat with your character as normal - memories will automatically update based on your configured message count
4. Use the `/memoryupdate` slash command anytime to force a memory update

## How It Works

1. After a configured number of messages, the extension triggers a summarization process.
2. Recent messages are analyzed and summarized using either SillyTavern's current model or an external API.
3. The summary is compared to existing character notes to identify new information.
4. New information is formatted with timestamps and bullet points, then appended to character notes.
5. The updated notes are saved to the character card, ensuring persistence across chat sessions.

## Customizing the Summarization Prompt

The default prompt is designed to extract key information from conversations, but you can customize it to focus on specific aspects you want to capture. Use these placeholders in your custom prompt:

- `{{user}}` - Will be replaced with the user's name
- `{{char}}` - Will be replaced with the character's name
- `{{count}}` - Will be replaced with the number of messages being summarized

## External Model Configuration

For better summarization results, you can configure the extension to use an external AI model:

1. Enable "Use separate model for summarization"
2. Enter the API endpoint (e.g., for OpenAI: `https://api.openai.com/v1/chat/completions`)
3. Enter your API key if required
4. The extension will then use this model for generating summaries

## License

MIT

## Credits

- Created by Robert Vandervoort
- Built for the SillyTavern community