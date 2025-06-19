import {
  Collection,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ClientEvents,
} from 'discord.js';

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface Event {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => void | Promise<void>;
}

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}
