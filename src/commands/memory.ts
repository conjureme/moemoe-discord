import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';

import { Command } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';

const memory: Command = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('manage bot memory')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('clear memory for this channel')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear-dm')
        .setDescription('clear all your dm memories with the bot')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stats').setDescription('show memory statistics')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('show memory info for this channel')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const memoryService = serviceManager.getMemoryService();

    try {
      switch (subcommand) {
        case 'clear': {
          // check permissions only in guild channels
          if (interaction.channel?.type !== ChannelType.DM) {
            const member = interaction.member;
            if (!member || typeof member.permissions === 'string') {
              await interaction.reply({
                content: 'unable to verify permissions',
                flags: ['Ephemeral'],
              });
              return;
            }

            // check if user has manage messages permission in guilds
            if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
              await interaction.reply({
                content:
                  'you need the "manage messages" permission to clear channel memory',
                flags: ['Ephemeral'],
              });
              return;
            }
          }

          await memoryService.clearChannel(
            interaction.channelId,
            interaction.guildId
          );

          await interaction.reply({
            content: 'my memory for this channel has been cleared!',
          });
          break;
        }

        case 'clear-dm': {
          const clearedCount = await memoryService.clearAllUserDMs(
            interaction.user.id
          );

          if (clearedCount > 0) {
            await interaction.reply({
              content: `cleared ${clearedCount} dm conversation${clearedCount > 1 ? 's' : ''} with you`,
              flags: ['Ephemeral'],
            });
          } else {
            await interaction.reply({
              content: 'no dm conversations found to clear',
              flags: ['Ephemeral'],
            });
          }
          break;
        }

        case 'stats': {
          const stats = memoryService.getStats();

          const embed = {
            title: 'memory statistics',
            fields: [
              {
                name: 'total channels',
                value: stats.totalChannels.toString(),
                inline: true,
              },
              {
                name: 'total messages',
                value: stats.totalMessages.toString(),
                inline: true,
              },
              {
                name: 'dm channels',
                value: stats.dmChannels.toString(),
                inline: true,
              },
              {
                name: 'guild channels',
                value: stats.guildChannels.toString(),
                inline: true,
              },
            ],
            color: 0x5865f2,
            timestamp: new Date().toISOString(),
          };

          await interaction.reply({
            embeds: [embed],
            flags: ['Ephemeral'],
          });
          break;
        }

        case 'info': {
          const context = await memoryService.getChannelContext(
            interaction.channelId,
            interaction.guildId
          );

          const embed = {
            title: 'channel memory info',
            fields: [
              {
                name: 'messages in memory',
                value: context.messages.length.toString(),
                inline: true,
              },
              {
                name: 'total messages stored',
                value: context.messageCount.toString(),
                inline: true,
              },
            ],
            color: 0x5865f2,
            timestamp: new Date().toISOString(),
          };

          if (context.messages.length > 0) {
            const latest = context.messages[context.messages.length - 1];
            embed.fields.push({
              name: 'latest message',
              value: `**${latest.author}**: ${
                latest.content.length > 100
                  ? latest.content.substring(0, 100) + '...'
                  : latest.content
              }`,
              inline: false,
            });
          }

          await interaction.reply({
            embeds: [embed],
            flags: ['Ephemeral'],
          });
          break;
        }
      }
    } catch (error) {
      await interaction.reply({
        content: 'an error occurred while executing this command',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default memory;
