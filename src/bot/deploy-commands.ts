import { REST, Routes } from 'discord.js';
import { commandRegistry } from '../commands';
import * as dotenv from 'dotenv';

dotenv.config();

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!BOT_TOKEN || !CLIENT_ID) {
  console.error('missing environment variables BOT_TOKEN or CLIENT_ID');
  process.exit(1);
}

async function deployCommands() {
  const commands: any[] = [];

  await commandRegistry.loadCommands();
  const loadedCommands = commandRegistry.getAllCommands();

  for (const [name, command] of loadedCommands) {
    if (command.data?.toJSON) {
      commands.push(command.data.toJSON());
      console.log(`loaded: ${name}`);
    }
  }

  const rest = new REST().setToken(BOT_TOKEN!);

  try {
    console.log(
      `starting refresh of ${commands.length} application (/) commands.`
    );

    let data;
    if (GUILD_ID) {
      data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID),
        { body: commands }
      );
      console.log(
        `successfully deployed ${Array.isArray(data) ? data.length : 0} guild commands`
      );
    } else {
      data = await rest.put(Routes.applicationCommands(CLIENT_ID!), {
        body: commands,
      });
      console.log(
        `successfully deployed ${Array.isArray(data) ? data.length : 0} global commands`
      );
    }
  } catch (error) {
    console.error('error deploying commands:', error);
  }
}

const args = process.argv.slice(2);

if (args.includes('--global')) {
  delete process.env.GUILD_ID;
  console.log('forcing global command deployment...');
}

const guildIndex = args.indexOf('--guild');
if (guildIndex !== -1 && args[guildIndex + 1]) {
  process.env.GUILD_ID = args[guildIndex + 1];
  console.log(`deploying to guild: ${process.env.GUILD_ID}`);
}

deployCommands();
