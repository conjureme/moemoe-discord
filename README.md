<div align="center">
  <img src="https://github.com/user-attachments/assets/db6fb2fc-f917-4bd5-801f-7a8994ac22a0" alt="moemoe logo" width="200">
  <p><strong>a conversational discord bot with a bunch of cool stuff like function calling, character card importing, and other things!</strong></p>
  <p>
    <img src="https://img.shields.io/badge/discord.js-v14-blue?style=flat-square&logo=discord" alt="Discord.js">
    <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  </p>
</div>

## what is moemoe?

moemoe is the name of the multi-faceted discord bot built for my server! unlike traditional command-based bots, moemoe is able to engage in conversations while maintaining context and personality across messages and channels. it's cable to perform actions autonomously through function calling- sending DMs, updating its own status, joining voice channels, and much more- all within the flow of conversation. moemoe is also capable of running its own slash commands!

### key features

- **conversational first** - mention or DM the bot for chat interaction
- **persistent memory** - maintains conversation context per channel with intelligent token management
- **autonomous actions** - can execute discord actions (send messages, join calls, etc.) and slash commands
- **customizable personality** - define unique traits, dialogue styles, and behaviors via JSON or future character card importing/dashboard
- **multi-provider support** - works with local models (such as [KoboldCPP](https://github.com/LostRuins/koboldcpp)) or cloud-provider APIs
- **response filtering** - customizable word filter to ensure responses stay aligned with your own server and use case

## quick start

### prerequisites

- Node.js 18+ and npm
- discord bot token ([create one here](https://discord.com/developers/applications))
- AI backend:
  - local model with [KoboldCPP](https://github.com/LostRuins/koboldcpp) (recommended)
  - OpenAI API (coming soon)

### setup

```bash
# clone and install
git clone https://github.com/conjureme/moemoe.git
cd moemoe
npm install

# configure environment
cp .env.example .env
# edit .env with your bot token and AI settings

# deploy discord commands
npm run deploy

# start the bot
npm run dev
```

### basic configuration

edit `config/bot.json` to customize your bot's personality:

```json
{
  "name": "your_bot_name",
  "description": "bot description (traits, dialogue style, etc.)",
  "data": {
    "system_prompt": "how the bot should behave",
    "first_mes": "greeting message",
    "mes_example": "example responses"
  }
}
```

## usage

### chatting

- **mention** `@moemoe` in any channel to start talking
- **DM** the bot for conversations
- each channel maintains its own conversation history

### commands

- `/memory clear` - clear conversation history in current channel
- `/memory stats` - view memory usage statistics
- `/embed` - create custom discord embeds

### function examples

just ask naturally in conversation:

- "send a dm to @user saying hello"
- "update your status to playing minecraft"
- "join the voice channel i'm in"
- "change your bio to something cool"

## file structure

```
src/
├── bot/          # discord client and initialization
├── commands/     # slash command handlers
├── events/       # discord event handlers
├── services/     # core services
│   ├── ai/       # AI providers and prompt building
│   ├── memory/   # conversation persistence
│   └── config/   # configuration management
├── functions/    # bot action implementations
└── utils/        # shared utilities
```

## advanced configuration

a web dashboard is in the works for easier configuration and imports

### AI settings (`config/ai.json`)

- sampler settings (temperature, top_p, etc.)
- instruction formatting (ChatML, Mistral, etc.)
- context templates

### memory settings (`config/memory.json`)

- message retention limits
- token context windows
- user message formatting

### filter settings (`config/filter.json`)

- content moderation
- blacklisted words
- replacement tags

## development

```bash
# run in development mode
npm run dev

# deploy commands globally
npm run deploy:global

# deploy to specific guild
npm run deploy -- --guild GUILD_ID
```

## roadmap

### completed

- [x] core bot functionality
- [x] memory system with persistence
- [x] configurable personas
- [x] function calling
- [x] word filtering
- [x] image understanding (for vision models)

- [x] currency system
- [x] minigames/gambling

### in progress

- [ ] voice channel audio support
- [ ] web dashboard for configuration
- [ ] character card imports

**discord-bot specific:**

- [ ] autoresponder

### planned

- [ ] full provider support
- [ ] lorebook system for extended context
- [ ] RAG (retrieval augmented generation)
- [ ] multi-bot conversations
- [ ] webhook integrations

### considering

- [ ] swipes and message regeneration
- [ ] support for longer, more "story" based conversation
- [ ] websearch utility

### absolutely not happening

- image generation

## contributing

contributions welcome! feel free to:

- report bugs or request features
- submit pull requests
- share custom personas
- improve documentation

## license

MIT - see [LICENSE](LICENSE) for details

---

<p align="center">made with 💜 by tyler</p>
