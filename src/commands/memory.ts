import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';

import { Command } from '../types/discord';
import { MemoryService } from '../services/memory/MemoryService';
import { ConfigService } from '../services/config/ConfigService';

const configService = new ConfigService();
const memoryService = new MemoryService(configService);

const memory: Command = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('manage bot memory')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('clear memory for this channel')
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

    try {
      switch (subcommand) {
        case 'clear': {
          await memoryService.clearChannel(
            interaction.channelId,
            interaction.guildId
          );

          await interaction.reply({
            content: 'memory cleared for this channel',
            flags: ['Ephemeral'],
          });
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
