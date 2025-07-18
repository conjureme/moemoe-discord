import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

const modifybalance: Command = {
  data: new SlashCommandBuilder()
    .setName('modifybalance')
    .setDescription('modify user balance')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription("set a user's balance to a specific amount")
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('the new balance amount')
            .setRequired(true)
            .setMinValue(0)
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('the user to modify (defaults to yourself)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription("add to a user's balance")
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('the amount to add')
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('the user to modify (defaults to yourself)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription("remove from a user's balance")
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('the amount to remove')
            .setRequired(true)
            .setMinValue(1)
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('the user to modify (defaults to yourself)')
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const economyService = serviceManager.getEconomyService();
    const guildId = interaction.guildId!;
    const guildName = interaction.guild!.name;

    try {
      const targetUser =
        interaction.options.getUser('user') || interaction.user;
      const amount = interaction.options.getInteger('amount', true);

      const targetUserImage = targetUser.displayAvatarURL({ size: 256 });

      const guildEconomy = economyService.getGuildEconomy(guildId);
      const currency = guildEconomy?.currency || {
        emoji: '🧀',
        name: 'curds',
      };

      switch (subcommand) {
        case 'set': {
          const userBalance = await economyService.setBalance(
            guildId,
            guildName,
            targetUser.id,
            amount
          );

          const embed = new EmbedBuilder()
            .setColor(0xd4e6d4)
            .setAuthor({
              name: targetUser.username,
              iconURL: targetUserImage,
            })
            .setTitle('balance updated !')
            .setDescription(
              `${targetUser === interaction.user ? 'your' : `${targetUser}'s`} balance is now ${currency.emoji} **${userBalance.balance.toLocaleString()} ${currency.name}** !`
            );

          await interaction.reply({ embeds: [embed] });
          logger.info(
            `balance set for ${targetUser.username} in ${guildName}: ${amount} (by ${interaction.user.username})`
          );
          break;
        }

        case 'add': {
          const userBalance = await economyService.addBalance(
            guildId,
            guildName,
            targetUser.id,
            amount,
            `added by ${interaction.user.username}`
          );

          const embed = new EmbedBuilder()
            .setColor(0xd4e6d4)
            .setAuthor({
              name: targetUser.username,
              iconURL: targetUserImage,
            })
            .setTitle('balance updated !')
            .setDescription(
              `added ${currency.emoji} **${amount.toLocaleString()}** to ${targetUser === interaction.user ? 'your' : `${targetUser}'s`} balance\n` +
                `new balance: ${currency.emoji} **${userBalance.balance.toLocaleString()} ${currency.name}**`
            );

          await interaction.reply({ embeds: [embed] });
          logger.info(
            `balance added for ${targetUser.username} in ${guildName}: +${amount} (by ${interaction.user.username})`
          );
          break;
        }

        case 'remove': {
          const currentBalance = await economyService.getBalance(
            guildId,
            guildName,
            targetUser.id
          );

          if (currentBalance.balance < amount) {
            await interaction.reply({
              content: `${targetUser === interaction.user ? 'you only have' : `${targetUser.username} only has`} ${currency.emoji} **${currentBalance.balance.toLocaleString()} ${currency.name}**. cannot remove ${currency.emoji} **${amount.toLocaleString()}**`,
              flags: ['Ephemeral'],
            });
            return;
          }

          const userBalance = await economyService.addBalance(
            guildId,
            guildName,
            targetUser.id,
            -amount,
            `removed by ${interaction.user.username}`
          );

          const embed = new EmbedBuilder()
            .setColor(0xd4e6d4)
            .setAuthor({
              name: targetUser.username,
              iconURL: targetUserImage,
            })
            .setTitle('balance updated')
            .setDescription(
              `removed ${currency.emoji} **${amount.toLocaleString()}** from ${targetUser === interaction.user ? 'your' : `${targetUser}'s`} balance\n` +
                `new balance: ${currency.emoji} **${userBalance.balance.toLocaleString()} ${currency.name}**`
            );

          await interaction.reply({ embeds: [embed] });
          logger.info(
            `balance removed for ${targetUser.username} in ${guildName}: -${amount} (by ${interaction.user.username})`
          );
          break;
        }
      }
    } catch (error) {
      logger.error('error in modifybalance command:', error);
      await interaction.reply({
        content: 'an error occurred while executing this command',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default modifybalance;
