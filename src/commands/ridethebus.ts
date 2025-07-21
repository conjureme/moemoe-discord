import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

const ridethebus: Command = {
  data: new SlashCommandBuilder()
    .setName('ridethebus')
    .setDescription(
      'play ride the bus - guess your way through 4 card challenges'
    )
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('amount to bet')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const bet = interaction.options.getInteger('bet', true);
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const userId = interaction.user.id;

      if (!guildId || !guildName) {
        await interaction.reply({
          content: 'this command can only be used in a server!',
          flags: ['Ephemeral'],
        });
        return;
      }

      const economyService = serviceManager.getEconomyService();
      const userBalance = await economyService.getBalance(
        guildId,
        guildName,
        userId
      );

      if (userBalance.balance < bet) {
        const guildEconomy = economyService.getGuildEconomy(guildId);
        const currency = guildEconomy?.currency || {
          emoji: '🧀',
          name: 'curds',
        };

        await interaction.reply({
          content: `you don't have enough ${currency.name}! you only have ${currency.emoji} **${userBalance.balance.toLocaleString()}**`,
          flags: ['Ephemeral'],
        });
        return;
      }

      // TODO: implement game logic here
      const embed = new EmbedBuilder()
        .setColor(0x4169e1)
        .setTitle('✦ ride the bus time !')
        .setDescription(
          `welcome aboard! bet: **${bet}**\n\n` +
            `**how to play:**\n` +
            `1. red or black?\n` +
            `2. higher or lower?\n` +
            `3. between or outside?\n` +
            `4. suit guess?\n\n` +
            `get all 4 right to win big!\n\n` +
            `*game logic coming soon!*`
        )
        .setFooter({
          text: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });

      logger.info(
        `${interaction.user.username} started ride the bus with bet ${bet} in ${guildName}`
      );
    } catch (error) {
      logger.error('error in ridethebus command:', error);

      const errorMessage = {
        content: 'an error occurred while boarding the bus!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default ridethebus;
