import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

const coinflip: Command = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('flip a coin and bet on the outcome')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('the amount to bet')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName('choice')
        .setDescription('heads or tails')
        .setRequired(true)
        .addChoices(
          { name: 'heads', value: 'heads' },
          { name: 'tails', value: 'tails' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const amount = interaction.options.getInteger('amount', true);
      const choice = interaction.options.getString('choice', true) as
        | 'heads'
        | 'tails';
      const guildId = interaction.guildId!;
      const guildName = interaction.guild!.name;
      const userId = interaction.user.id;

      const economyService = serviceManager.getEconomyService();

      const userBalance = await economyService.getBalance(
        guildId,
        guildName,
        userId
      );

      if (userBalance.balance < amount) {
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

      // deduct bet amount
      await economyService.addBalance(
        guildId,
        guildName,
        userId,
        -amount,
        `coinflip bet`
      );

      // create flip animation embed
      const guildEconomy = economyService.getGuildEconomy(guildId);
      const currency = guildEconomy?.currency || { emoji: '🧀', name: 'curds' };

      const animationEmbed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🪙 coin flip')
        .setDescription(
          `betting ${currency.emoji} **${amount.toLocaleString()} ${currency.name}** on **${choice}**\n\nflipping...`
        )
        .setFooter({
          text: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [animationEmbed] });

      // animate the flip
      const animations = ['🪙', '⚪', '🪙', '⚫', '🪙'];
      for (let i = 0; i < animations.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));

        animationEmbed.setDescription(
          `betting ${currency.emoji} **${amount.toLocaleString()} ${currency.name}** on **${choice}**\n\n${animations[i]}`
        );

        await interaction.editReply({ embeds: [animationEmbed] });
      }

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = result === choice;

      const resultEmbed = new EmbedBuilder()
        .setTitle(`🪙 ${result}!`)
        .setFooter({
          text: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      if (won) {
        const winnings = amount * 2;
        await economyService.addBalance(
          guildId,
          guildName,
          userId,
          winnings,
          `coinflip win`
        );

        const newBalance = await economyService.getBalance(
          guildId,
          guildName,
          userId
        );

        resultEmbed
          .setColor(0xd4e6d4)
          .setDescription(
            `⸝⸝ **you won !**\n\n` +
              `you guessed **${choice}** and it was **${result}**!\n` +
              `winnings: ${currency.emoji} **${amount.toLocaleString()} ${currency.name}**\n\n` +
              `new balance: ${currency.emoji} **${newBalance.balance.toLocaleString()} ${currency.name}**`
          );

        logger.info(
          `${interaction.user.username} won ${amount} in coinflip (${guildName})`
        );
      } else {
        const newBalance = await economyService.getBalance(
          guildId,
          guildName,
          userId
        );

        resultEmbed
          .setColor(0xf87171)
          .setDescription(
            `⸝⸝ **you lost !**\n\n` +
              `you guessed **${choice}** but it was **${result}**\n` +
              `lost: ${currency.emoji} **${amount.toLocaleString()} ${currency.name}**\n\n` +
              `new balance: ${currency.emoji} **${newBalance.balance.toLocaleString()} ${currency.name}**`
          );

        logger.info(
          `${interaction.user.username} lost ${amount} in coinflip (${guildName})`
        );
      }

      // add play again button
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('coinflip_again')
          .setLabel('flip again')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
      );

      await interaction.editReply({
        embeds: [resultEmbed],
        components: [row],
      });

      // handle play again button
      const collector = interaction.channel?.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
        filter: (i) =>
          i.user.id === interaction.user.id && i.customId === 'coinflip_again',
      });

      collector?.on('collect', async (i) => {
        await i.reply({
          content: `use </coinflip:${interaction.commandId}> to play again!`,
          flags: ['Ephemeral'],
        });
      });

      collector?.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
    } catch (error) {
      logger.error('error in coinflip command:', error);

      const errorMessage = {
        content: 'an error occurred during the coinflip!',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default coinflip;
