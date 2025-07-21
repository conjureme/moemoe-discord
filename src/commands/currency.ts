import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

import { logger } from '../utils/logger';

const currency: Command = {
  data: new SlashCommandBuilder()
    .setName('currency')
    .setDescription('manage server currency settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) =>
      group
        .setName('set')
        .setDescription('set currency properties')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('emoji')
            .setDescription('set the currency emoji')
            .addStringOption((option) =>
              option
                .setName('emoji')
                .setDescription('the emoji to represent your currency')
                .setRequired(true)
                .setMaxLength(50)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('name')
            .setDescription('set the currency name')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('the name of your currency')
                .setRequired(true)
                .setMaxLength(20)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('start')
            .setDescription('set the starting balance for new users')
            .addIntegerOption((option) =>
              option
                .setName('amount')
                .setDescription('the starting balance amount')
                .setRequired(true)
                .setMinValue(0)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('pat-reward')
            .setDescription('set the reward range for head pat command')
            .addIntegerOption((option) =>
              option
                .setName('min')
                .setDescription('minimum reward amount')
                .setRequired(true)
                .setMinValue(1)
            )
            .addIntegerOption((option) =>
              option
                .setName('max')
                .setDescription('maximum reward amount')
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('pat-cooldown')
            .setDescription('set the cooldown for head pat command in minutes')
            .addIntegerOption((option) =>
              option
                .setName('minutes')
                .setDescription('cooldown in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1440)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('fish-reward')
            .setDescription('set the base reward for fishing command')
            .addIntegerOption((option) =>
              option
                .setName('amount')
                .setDescription(
                  'base reward amount (multiplied by catch rarity)'
                )
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('fish-cooldown')
            .setDescription('set the cooldown for fishing command in minutes')
            .addIntegerOption((option) =>
              option
                .setName('minutes')
                .setDescription('cooldown in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1440)
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const economyService = serviceManager.getEconomyService();

    const guildId = interaction.guildId!;
    const guildName = interaction.guild!.name;
    const guildImage = interaction.guild!.iconURL({ size: 256 }) || undefined;

    try {
      if (subcommandGroup === 'set') {
        switch (subcommand) {
          case 'emoji': {
            const emoji = interaction.options.getString('emoji', true);

            const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
            const customEmojiRegex = /<a?:\w+:\d+>/;

            if (!emojiRegex.test(emoji) && !customEmojiRegex.test(emoji)) {
              await interaction.reply({
                content: 'please provide a valid emoji!',
                flags: ['Ephemeral'],
              });
              return;
            }

            const currentCurrency = economyService.getGuildEconomy(guildId)
              ?.currency || {
              name: 'curds',
              emoji: '🧀',
            };

            economyService.updateCurrency(guildId, {
              ...currentCurrency,
              emoji,
            });

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildImage,
              })
              .setTitle('currency emoji updated !')
              .setDescription(`currency emoji is now ${emoji}`);

            await interaction.reply({ embeds: [embed] });
            logger.info(`currency emoji updated in ${guildName}: ${emoji}`);
            break;
          }

          case 'name': {
            const name = interaction.options.getString('name', true);

            const currentCurrency = economyService.getGuildEconomy(guildId)
              ?.currency || {
              name: 'curds',
              emoji: '🧀',
            };

            economyService.updateCurrency(guildId, {
              ...currentCurrency,
              name,
            });

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildImage,
              })
              .setTitle('currency name updated !')
              .setDescription(`currency name is now **${name}**`);

            await interaction.reply({ embeds: [embed] });
            logger.info(`currency name updated in ${guildName}: ${name}`);
            break;
          }

          case 'start': {
            const amount = interaction.options.getInteger('amount', true);

            economyService.updateGuildSettings(guildId, {
              startingBalance: amount,
            });

            const guildEconomy = economyService.getGuildEconomy(guildId);
            const currency = guildEconomy?.currency || {
              emoji: '🧀',
              name: 'curds',
            };

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildImage,
              })
              .setTitle('starting balance updated !')
              .setDescription(
                `new users will now start with ${currency.emoji} **${amount.toLocaleString()} ${currency.name}**`
              );

            await interaction.reply({ embeds: [embed] });
            logger.info(`starting balance updated in ${guildName}: ${amount}`);
            break;
          }

          case 'pat-reward': {
            const min = interaction.options.getInteger('min', true);
            const max = interaction.options.getInteger('max', true);

            if (min > max) {
              await interaction.reply({
                content:
                  'minimum reward cannot be greater than maximum reward!',
                flags: ['Ephemeral'],
              });
              return;
            }

            economyService.updateGuildSettings(guildId, {
              patMinReward: min,
              patMaxReward: max,
            });

            const guildEconomy = economyService.getGuildEconomy(guildId);
            const currency = guildEconomy?.currency || {
              emoji: '🧀',
              name: 'curds',
            };

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildImage,
              })
              .setTitle('pat reward updated !')
              .setDescription(
                `pat rewards now range from ${currency.emoji} **${min}** to ${currency.emoji} **${max} ${currency.name}**`
              );

            await interaction.reply({ embeds: [embed] });
            logger.info(
              `pat reward range updated in ${guildName}: ${min}-${max}`
            );
            break;
          }

          case 'pat-cooldown': {
            const minutes = interaction.options.getInteger('minutes', true);

            economyService.updateGuildSettings(guildId, {
              patCooldownMinutes: minutes,
            });

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildImage,
              })
              .setTitle('pat cooldown updated !')
              .setDescription(
                `pat cooldown is now **${minutes} minute${minutes > 1 ? 's' : ''}**`
              );

            await interaction.reply({ embeds: [embed] });
            logger.info(
              `pat cooldown updated in ${guildName}: ${minutes} minutes`
            );
            break;
          }

          case 'fish-reward': {
            const amount = interaction.options.getInteger('amount', true);

            economyService.updateGuildSettings(guildId, {
              fishBaseReward: amount,
            });

            const guildEconomy = economyService.getGuildEconomy(guildId);
            const currency = guildEconomy?.currency || {
              emoji: '🧀',
              name: 'curds',
            };

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildImage,
              })
              .setTitle('fishing reward updated !')
              .setDescription(
                `base fishing reward is now ${currency.emoji} **${amount} ${currency.name}** (multiplied by catch rarity)`
              );

            await interaction.reply({ embeds: [embed] });
            logger.info(`fish base reward updated in ${guildName}: ${amount}`);
            break;
          }

          case 'fish-cooldown': {
            const minutes = interaction.options.getInteger('minutes', true);

            economyService.updateGuildSettings(guildId, {
              fishCooldownMinutes: minutes,
            });

            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setAuthor({
                name: guildName,
                iconURL: guildImage,
              })
              .setTitle('fishing cooldown updated !')
              .setDescription(
                `fishing cooldown is now **${minutes} minute${minutes > 1 ? 's' : ''}**`
              );

            await interaction.reply({ embeds: [embed] });
            logger.info(
              `fish cooldown updated in ${guildName}: ${minutes} minutes`
            );
            break;
          }
        }
      }
    } catch (error) {
      logger.error('error in currency command:', error);
      await interaction.reply({
        content: 'an error occurred while executing this command',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default currency;
