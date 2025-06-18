import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/discord';

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('checks if the bot is online'),

  async execute(interaction: ChatInputCommandInteraction) {
    const latencyStart = Date.now();

    await interaction.reply({
      content: `ping started!`,
      flags: ['Ephemeral'],
    });

    const latencyEnd = Date.now();
    const responseTime = latencyEnd - latencyStart;

    await interaction.editReply({
      content: `hiya, i'm alive!\nresponse: ${responseTime}ms!`,
    });
  },
};

export default ping;
