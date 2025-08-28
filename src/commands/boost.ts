import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';
import { AutoresponderProcessor } from '../services/autoresponder/AutoresponderProcessor';

import { logger } from '../utils/logger';

const boost: Command = {
  data: new SlashCommandBuilder()
    .setName('boost')
    .setDescription('manage boost thank you messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('set the boost thank you message')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('the boost message with placeholders')
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('test')
        .setDescription('test the boost message on yourself or another user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription(
              'user to test the boost message on (defaults to you)'
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('show the current boost message')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('remove the boost message entirely')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guildName = interaction.guild!.name;
    const guildIcon = interaction.guild!.iconURL({ size: 256 }) || undefined;

    const boostService = serviceManager.getBoostService();

    try {
      switch (subcommand) {
        case 'set': {
          const message = interaction.options.getString('message', true);

          const result = boostService.setBoostMessage(
            guildId,
            guildName,
            message,
            interaction.user.id
          );

          if (!result.success) {
            await interaction.reply({
              content: result.message,
              flags: ['Ephemeral'],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ boost message set !')
            .setDescription('server boosters will be thanked with your message')
            .addFields({
              name: 'message preview',
              value:
                message.length > 1000
                  ? message.substring(0, 1000) + '...'
                  : message,
              inline: false,
            })
            .setFooter({
              text: 'use /boost test to preview how it looks',
            });

          await interaction.reply({ embeds: [embed] });
          logger.info(
            `boost message set in ${guildName} by ${interaction.user.username}`
          );
          break;
        }

        case 'test': {
          const targetUser =
            interaction.options.getUser('user') || interaction.user;
          const targetMember =
            (interaction.options.getMember('user') as GuildMember) ||
            (interaction.member as GuildMember);

          const boostMessage = boostService.getBoostMessage(guildId);

          if (!boostMessage) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setTitle('there is no boost message !')
              .setDescription(`create a boost message using \`/boost set\``);
            await interaction.reply({
              embeds: [embed],
            });
            return;
          }

          const mockMessage = {
            author: targetUser,
            member: targetMember,
            guild: interaction.guild,
            guildId: guildId,
            channelId: interaction.channelId,
            channel: interaction.channel,
            client: interaction.client,
            content: '',
          } as any;

          const processor = AutoresponderProcessor.getInstance();

          try {
            const processedMessage = await processor.processReply(
              boostMessage.message,
              mockMessage,
              []
            );

            await interaction.reply({
              content: 'your boost message should have been sent!',
            });

            if (typeof processedMessage === 'string') {
              await interaction.followUp(processedMessage);
            } else if (processedMessage && 'embeds' in processedMessage) {
              await interaction.followUp(processedMessage);
            }

            logger.info(
              `tested boost message in ${guildName} for ${targetUser.username}`
            );
          } catch (error) {
            logger.error('error testing boost message:', error);
            await interaction.reply({
              content:
                'error processing boost message: ' +
                (error instanceof Error ? error.message : 'unknown error'),
              flags: ['Ephemeral'],
            });
          }
          break;
        }

        case 'show': {
          const boostMessage = boostService.getBoostMessage(guildId);

          if (!boostMessage) {
            const embed = new EmbedBuilder()
              .setColor(0xfaf0e7)
              .setTitle('there is no boost message !')
              .setDescription(`create a boost message using \`/boost set\``);
            await interaction.reply({
              embeds: [embed],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ current boost message !')
            .addFields({
              name: 'message',
              value:
                boostMessage.message.length > 1000
                  ? boostMessage.message.substring(0, 1000) + '...'
                  : boostMessage.message,
              inline: false,
            });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'remove': {
          const result = boostService.removeBoostMessage(guildId);

          if (!result.success) {
            await interaction.reply({
              content: result.message,
              flags: ['Ephemeral'],
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setAuthor({
              name: guildName,
              iconURL: guildIcon,
            })
            .setTitle('✦ boost message removed !')
            .setDescription('the boost message has been completely removed');

          await interaction.reply({ embeds: [embed] });
          logger.info(`boost message removed in ${guildName}`);
          break;
        }
      }
    } catch (error) {
      logger.error('error in boost command:', error);

      const errorMessage = {
        content: 'an error occurred while executing this command',
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export default boost;
