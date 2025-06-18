import { Events, Interaction } from 'discord.js';
import { Event } from '../types/discord';
import { logger } from '../utils/logger';

const interactionCreate: Event = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`no command found for: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(
        `error executing command ${interaction.commandName}:`,
        error
      );

      const errorMessage = {
        content: 'oops! something went wrong while executing this command.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default interactionCreate;
