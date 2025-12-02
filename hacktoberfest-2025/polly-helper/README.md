# Pollinations Helper Bot 🌸

A Discord bot that helps users with Pollinations.AI API questions and automatically creates GitHub issues for server-side problems.

## ⚠️ Important: API Migration

This bot uses **enter.pollinations.ai** (the new API gateway). The old endpoints (`image.pollinations.ai` and `text.pollinations.ai`) are deprecated.

**You need an API key** to run this bot. Get one at https://enter.pollinations.ai

## Features

- 🤖 **AI-Powered Help**: Uses enter.pollinations.ai to answer user questions about the API
- 📝 **Automatic Issue Creation**: Detects server-side issues and creates GitHub issues
- 🔔 **Issue Resolution Notifications**: DMs users when their reported issues are closed
- 📊 **API Status Check**: Quick command to check Pollinations API health
- 💬 **Conversation Context**: Maintains conversation history for better responses
- ⚡ **Deprecation Warnings**: Informs users about migrating to enter.pollinations.ai

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Enable these Privileged Gateway Intents:
   - Message Content Intent (required - the bot needs to read message contents to respond)
5. Copy the bot token

### 2. Invite the Bot to Your Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select permissions:
   - Read Messages/View Channels
   - Send Messages
   - Send Messages in Threads
   - Embed Links
   - Read Message History
4. Copy the generated URL and open it to invite the bot

### 3. Get Channel ID

1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click the channel you want the bot to operate in
3. Click "Copy ID"

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DISCORD_TOKEN=your_discord_bot_token
# Set HELPER_CHANNEL_ID to a numeric channel ID to limit the bot to one channel.
# Set HELPER_CHANNEL_ID=0 to allow the bot to respond in any channel (for testing).
HELPER_CHANNEL_ID=your_channel_id_or_0
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=pollinations/pollinations
POLLINATIONS_API_KEY=your_api_key  # Required! Get from https://enter.pollinations.ai
```

### 5. Install Dependencies

```bash
pip install -r requirements.txt
```

### 6. Run the Bot

```bash
python bot.py
```

## Usage

### Automatic Help

Simply type your question in the designated helper channel, and the bot will respond:

```
User: How do I generate an image with the Pollinations API?

Bot: To generate an image with Pollinations API, you can use a simple GET request...
```

### Commands

| Command | Description |
|---------|-------------|
| `!status` | Check the health of Pollinations API services |
| `!clear` | Clear your conversation history with the bot |
| `!help_api` | Show quick API reference |

### Server-Side Issues

When the bot detects a server-side issue (API bugs, outages, etc.), it will:

1. Explain the issue to the user
2. Automatically create a GitHub issue
3. Track the issue and DM the user when it's resolved

### Unsolvable or Complex Issues
When the bot cannot provide a solution (for example, unclear or complex errors), it will automatically create a GitHub issue and notify the user. The bot will prefix the AI response with `[CREATE_ISSUE]` in such cases. You can still file the issue manually if preferred.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Your Discord bot token |
| `HELPER_CHANNEL_ID` | Yes | The channel ID where the bot operates |
| `GITHUB_TOKEN` | No | GitHub PAT for creating issues (needs `repo` scope) |
| `GITHUB_REPO` | No | Target repo for issues (default: `pollinations/pollinations`) |
| `POLLINATIONS_API_KEY` | **Yes** | API key from https://enter.pollinations.ai (required for bot to work) |

### Customization

Edit `config.py` to customize:
- `ISSUE_CHECK_INTERVAL`: How often to check for closed issues (default: 300 seconds)
- `SYSTEM_PROMPT`: The AI's behavior and knowledge base

## File Structure

```
pollinations-helper-bot/
├── bot.py              # Main bot file with Discord handlers
├── config.py           # Configuration and constants
├── pollinations_client.py  # Pollinations API integration
├── github_manager.py   # GitHub issue management
├── requirements.txt    # Python dependencies
├── .env.example        # Example environment file
└── README.md           # This file
```

## Development

### Testing the Pollinations API Connection

```python
import asyncio
from pollinations_client import pollinations_client

async def test():
    response = await pollinations_client.get_ai_response("How do I generate an image?")
    print(response)

asyncio.run(test())
```

### Running Tests

```bash
python test_api.py
```

## Troubleshooting

### Bot not responding
- Check that `HELPER_CHANNEL_ID` matches your channel
- Ensure Message Content Intent is enabled in Discord Developer Portal
- Verify the bot has permissions in the channel

### GitHub issues not creating
- Verify `GITHUB_TOKEN` has `repo` scope
- Check the token isn't expired
- Ensure the repository exists and you have access

### API timeouts
- The Pollinations API may take time for complex requests
- Check API status with `!status` command

## License

MIT License - See the main Pollinations repository for details.