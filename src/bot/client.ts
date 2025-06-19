import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { Command } from '../types/discord';
import { logger } from '../utils/logger';
import { commandRegistry } from '../commands';
import { eventRegistry } from '../events';

export class ExtendedClient extends Client {
  public commands: Collection<string, Command>;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });

    this.commands = new Collection();
  }

  public async loadCommands(): Promise<void> {
    try {
      this.commands = await commandRegistry.loadCommands();
      logger.success(`loaded ${this.commands.size} commands`);
    } catch (error) {
      logger.error('failed to load commands:', error);
      throw error;
    }
  }

  public async loadEvents(): Promise<void> {
    try {
      const events = await eventRegistry.loadEvents();

      for (const [name, event] of events) {
        if (event.once) {
          this.once(event.name, (...args) => event.execute(...args));
        } else {
          this.on(event.name, (...args) => event.execute(...args));
        }
      }

      logger.success(`loaded ${events.size} events`);
    } catch (error) {
      logger.error('failed to load events:', error);
      throw error;
    }
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('initializing bot client...');

      await this.loadCommands();
      await this.loadEvents();

      logger.success('client initialized successfully');
    } catch (error) {
      logger.error('failed to initialize client:', error);
      throw error;
    }
  }
}
