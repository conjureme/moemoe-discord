<div align="center">
  <img src="https://github.com/user-attachments/assets/db6fb2fc-f917-4bd5-801f-7a8994ac22a0" alt="moemoe logo" width="200">
  <p><strong>a conversational discord bot with function calling, autoresponder, economy, and other things!</strong></p>
  <p>
    <img src="https://img.shields.io/badge/discord.js-v14-blue?style=flat-square&logo=discord" alt="Discord.js">
    <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  </p>
</div>

## what is moemoe-discord?

moemoe-discord is the discord module for moemoe. this serves as a way for moemoe to interact with users in my server along with providing other abilities like embed building, autoresponses, economy, and gambling.

while it was built for my own project, it's fully customizable (more intuitive customization systems are in progress) so that you can add it to your own server and tailor it to your own use. it serves almost as a bridge for an LLM to interact with your server in ways a real user could through functions that allow it to execute commands, send DMs, seeing user activity statuses, and even joining voice calls and chatting.

> [!NOTE]
>
> moemoe is still early on in her development. while this discord module is fully functional, there are many areas that need polishing or bug-checking.
>
> i'm also only one person, so changes and updates may be slow to progress and this project is purely passion. i would greatly appreciate feedback, critiques, and suggestions if you use it. it's also perfectly fine if you are not familiar with TypeScript, discord.js, or coding in general—any and all feedback is helpful!
>
> i'll also be looking for artists to commission for moemoe-related art such as emotes, character sheets, among other things.
>
> if you're interested in interacting with moemoe, feel free to join my [discord](https://discord.gg/rn9j69ApJQ) where you can chat with her or interact with some of the discord bot features, or share your art! you're also more than welcome to ask me for techincal support for running your own 'moemoe' or best practices for bringing your server mascot to "life" through an LLM.

### key features

- **conversational first** - mention or DM the bot for chat interaction
- **persistent memory** - maintains conversation context guild-wide or optionally channel-specific
- **autonomous actions** - can execute discord actions (send messages, join calls, etc.) and slash commands
- **customizable personality** - define unique traits, dialogue styles, and behaviors via JSON or future character card importing/dashboard
- **multi-provider support** - works with local models (such as [KoboldCPP](https://github.com/LostRuins/koboldcpp)) or cloud-provider APIs
- **response filtering** - customizable (optional) word filter to ensure responses stay aligned with your own server and use case

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
git clone https://github.com/conjureme/moemoe-discord.git
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

edit `config/bot.json` to customize your bot's personality. there's default configs if you need inspriation or guidance for making your own persona

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

### advanced config

depending on the model you use, the default `ai.json` settings may not work. currently you can change the sequence and suffix tags along with any sampler settings, but it's all through JSON. a web dashboard for configuring everything will be made soon.

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

## usage

### chatting

- **mention** `@moemoe` in any channel to start talking
- **DM** the bot for conversations
- you can use `/memory type mode:` to switch between channel separated and guild wide memory

### commands

> a docs site will be published soon containing every command, function, and autoresponder feature. the commands below are the most important.

- `/memory clear` - clears conversation history (guild or channel depending on mode)
- `/autoresponder create` - creates an autoresponder where you can set the trigger and reply. this supports placeholder variables and functions.
- `/embed create` - creates an embed with a modal form builder or optional JSON pasting from popular services such as [glitchii](https://glitchii.github.io/embedbuilder/) or [discohook](https://discohook.org)
- `/currency` - configure your server's currency: emoji, name, starting balance, and rewards for currency commands.
- `/blackjack` - very important command

### function examples

just ask naturally in conversation:

- "send a dm to @user saying hello" => `{{send_dm(user_id="860733331532808213", message="hello tyler!")}}`
- "update your status to playing minecraft" => `{{update_status(activity_type="playing", activity_text="Minecraft")}}`
- "join the voice channel i'm in" => `{{join_call()}}`
- "change your bio to something cool" => this one was temporarily disabled because moemoe continued updating it to nonsense
- "tell me what i'm listening to" => `{{get_user_activity(user_id="860733331532808213")}}` (listening to Jeremy Soule's "Wings of Kynareth" as of writing this btw)

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

### discord bot

- [x] core bot functionality
- [x] word filtering
- [x] currency system
- [x] minigames/gambling
- [x] autoresponder
- [x] voice channel audio support

### AI model

- [x] memory system with persistence
- [x] configurable personas
- [x] function calling
- [x] image understanding (for vision models)
- [ ] full provider support
- [ ] multi-bot conversations
- [ ] lorebook system for extended context
- [ ] RAG (retrieval augmented generation)

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
