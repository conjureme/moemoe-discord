# moemoe 🌸

a super customizable discord bot with personalities, memory, and a variety of other stuff. built for conversation and seamless server integration.

<p align="center">
  <img src="https://img.shields.io/badge/discord.js-v14-blue?style=flat-square&logo=discord" alt="Discord.js">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/status-early%20development-orange?style=flat-square" alt="Status">
</p>

## ✨ Features

- **customization** - create unique bot personalities with custom prompts, traits, and dialogue styles
- **conversation memories** - maintains context across messages with intelligent memory management
- **multiple AI providers** - support for OpenAI API, local models (via KoboldCPP), and more coming soon
- **function calling** - extensible function system for enhanced interactions (DMs, server actions, etc.)
- **per-channel memory** - separate conversation contexts for each channel
- **permission configuration** - granular command permissions and moderation tools

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- discord bot token ([create one here](https://discord.com/developers/applications))
- AI backend (one of):
  - OpenAI API key
  - local model with [KoboldCPP](https://github.com/LostRuins/koboldcpp)
  - other compatible API endpoints

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/conjureme/moemoe.git
   cd moemoe
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   # discord config
   BOT_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here  # optional: for guild-specific commands

   # AI config
   AI_PROVIDER=local  # or 'openai'
   AI_API_URL=http://localhost:5000  # local models
   # OPENAI_API_KEY=sk-...  # OpenAI endpoint
   ```

4. **Run the bot**

   ```bash
   # deploy commands to discord
   npm run deploy-commands

   # start the bot
   npm run dev
   ```

## 🎮 Usage

### Basic Interaction

- **mention the bot** or **DM it** to start a conversation
- the bot maintains conversation context within each channel
- responds with its configured personality and style

### Commands

more coming soon

## 🎨 Customization

### Creating Your Own Persona

1. navigate to `config/` directory
2. edit `bot.json` to define your character:

### AI Configuration

Configure model parameters in `config/ai.json`:

- temperature, top_p, repetition penalty
- max tokens and response length
- custom stop sequences
- and much more!

## 🗺️ Roadmap

### Current Focus

- [x] core discord bot functionality
- [x] basic memory system
- [x] configurable personas
- [x] model functions & tooling
- [ ] web dashboard for configuration
- [ ] multiple AI provider support

### Planned Features

- [ ] voice channel support
- [ ] image understanding (vision models)
- [ ] lorebook system for extended context
- [ ] character card imports
- [ ] RAG
- [ ] multi-bot conversations
- [ ] webhook integrations

## 🏗️ Architecture

```
moemoe/
├── src/
│   ├── bot/           # discord bot core
│   ├── commands/      # slash commands
│   ├── events/        # discord event handlers
│   ├── services/      # business logic
│   │   ├── ai/        # AI providers & prompting
│   │   ├── memory/    # conversation memory
│   │   └── config/    # configuration management
│   └── functions/     # extensible bot functions
├── config/            # user configuration files
└── data/              # runtime data (memory, logs)
```

## 🤝 Contributing

contributions are more than welcome! feel free to:

- 🐛 report bugs
- 💡 suggest features
- 🔧 submit pull requests
- 📖 improve documentation
- 🎨 share custom personas

## 📝 License

the moemoe project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- built with [discord.js](https://discord.js.org/)
- massive thanks to the open-source AI community

---

<p align="center">
  made with 💜 by tyler
</p>
