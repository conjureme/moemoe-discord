import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

const roulette: Command = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('place a bet on the roulette wheel')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('amount to bet')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('type of bet to place')
        .setRequired(true)
        .addChoices(
          { name: 'red', value: 'red' },
          { name: 'black', value: 'black' },
          { name: 'green (0/00)', value: 'green' },
          { name: 'odd', value: 'odd' },
          { name: 'even', value: 'even' },
          { name: 'low (1-18)', value: 'low' },
          { name: 'high (19-36)', value: 'high' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('number')
        .setDescription('specific number to bet on (0-36, optional)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(36)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const bet = interaction.options.getInteger('bet', true);
      const betType = interaction.options.getString('type', true);
      const number = interaction.options.getInteger('number');
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
      let betDescription = `betting on **${betType}**`;
      if (number !== null) {
        betDescription += ` and number **${number}**`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xdc143c)
        .setTitle('✦ roulette time !')
        .setDescription(
          `${betDescription} with bet: **${bet}**\n\n*spinning the wheel...*\n\n*game logic coming soon!*`
        )
        .setFooter({
          text: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });

      logger.info(
        `${interaction.user.username} started roulette with bet ${bet} on ${betType}${number ? ` and number ${number}` : ''} in ${guildName}`
      );
    } catch (error) {
      logger.error('error in roulette command:', error);

      const errorMessage = {
        content: 'an error occurred while spinning the roulette wheel!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default roulette;
