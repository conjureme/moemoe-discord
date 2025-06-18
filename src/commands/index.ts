import { Collection } from 'discord.js';
import { Command } from '../types/discord';
import { logger } from '../utils/logger';

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

export class CommandRegistry {
  private commands: Collection<string, Command> = new Collection();

  async loadCommands(): Promise<Collection<string, Command>> {
    const commandsPath = __dirname;

    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
      .filter((file) => file !== 'index.js' && file !== 'index.ts');

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        const command = await import(pathToFileURL(filePath).href);

        const commandData = command.default || command[Object.keys(command)[0]];

        if (this.isValidCommand(commandData)) {
          this.commands.set(commandData.data.name, commandData);
          logger.debug(`registered command: ${commandData.data.name}`);
        } else {
          logger.warn(`invalid command in ${file}`);
        }
      } catch (error) {
        logger.error(`failed to load command ${file}:`, error);
      }
    }

    return this.commands;
  }

  private isValidCommand(command: any): command is Command {
    return (
      command &&
      typeof command === 'object' &&
      command.data &&
      typeof command.data.name === 'string' &&
      typeof command.execute === 'function'
    );
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): Collection<string, Command> {
    return this.commands;
  }

  getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }
}

export const commandRegistry = new CommandRegistry();
