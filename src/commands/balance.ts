import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

const balance: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription("check your balance or another user's balance")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('the user to check balance for')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // defer reply for better UX
      await interaction.deferReply();

      const targetUser =
        interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name || 'Unknown Guild';

      if (!guildId) {
        await interaction.editReply({
          content: 'this command can only be used in a server!',
        });
        return;
      }

      const economyService = serviceManager.getEconomyService();
      const userBalance = await economyService.getBalance(
        guildId,
        guildName,
        targetUser.id
      );

      // get guild economy info for currency
      const guildEconomy = economyService.getGuildEconomy(guildId);
      const currency = guildEconomy?.currency || { emoji: '🧀', name: 'curds' };

      const embed = new EmbedBuilder()
        .setColor(0xfff140)
        .setAuthor({
          name: `${targetUser.username}`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setDescription(
          `${currency.emoji} **${userBalance.balance.toLocaleString()} ${currency.name}**`
        );

      // add rank if checking own balance
      if (targetUser.id === interaction.user.id) {
        const topBalances = await economyService.getTopBalances(guildId, 100);
        const rank =
          topBalances.findIndex((b) => b.userId === targetUser.id) + 1;

        if (rank > 0) {
          embed.setFooter({
            text: `#${rank} in ${guildName}`,
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });

      logger.debug(
        `balance checked for ${targetUser.username} in ${guildName}: ${userBalance.balance}`
      );
    } catch (error) {
      logger.error('error in balance command:', error);

      const errorMessage = {
        content: 'an error occurred while checking the balance!',
      };

      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default balance;
