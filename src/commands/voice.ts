import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { Command } from '../types/discord';
import { VoiceConnectionManager } from '../services/voice/VoiceConnectionManager';

import { logger } from '../utils/logger';

const voice: Command = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('manage voice features')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('listen')
        .setDescription('start listening to your voice for commands')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('stop listening to your voice')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('check voice listening status')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const voiceManager = VoiceConnectionManager.getInstance();

    if (!interaction.guildId) {
      await interaction.reply({
        content: 'this command can only be used in a server!',
        flags: ['Ephemeral'],
      });
      return;
    }

    const member = interaction.member;
    if (!member || typeof member.permissions === 'string') {
      await interaction.reply({
        content: 'unable to verify your voice state',
        flags: ['Ephemeral'],
      });
      return;
    }

    try {
      switch (subcommand) {
        case 'listen': {
          if (!voiceManager.isInVoiceChannel(interaction.guildId)) {
            await interaction.reply({
              content:
                'i need to be in a voice channel first! use `/join_call`',
              flags: ['Ephemeral'],
            });
            return;
          }

          const guild = interaction.guild!;
          const botMember = guild.members.cache.get(
            interaction.client.user!.id
          );
          const userMember = guild.members.cache.get(interaction.user.id);

          if (!userMember?.voice.channel) {
            await interaction.reply({
              content: 'you need to be in a voice channel!',
              flags: ['Ephemeral'],
            });
            return;
          }

          if (botMember?.voice.channelId !== userMember.voice.channelId) {
            await interaction.reply({
              content: 'we need to be in the same voice channel!',
              flags: ['Ephemeral'],
            });
            return;
          }

          const success = voiceManager.startListeningToUser(
            interaction.guildId,
            interaction.user.id
          );

          if (success) {
            const embed = new EmbedBuilder()
              .setColor(0xd4e6d4)
              .setTitle('✦ voice capture started !')
              .setDescription(
                `now listening to ${interaction.user.username}'s voice\n\n` +
                  `speak naturally and i'll transcribe what you say!`
              )
              .setFooter({
                text: 'use /voice stop to stop listening',
              });

            await interaction.reply({ embeds: [embed] });

            logger.info(
              `started voice capture for ${interaction.user.username} in ${guild.name}`
            );
          } else {
            await interaction.reply({
              content: 'failed to start voice capture',
              flags: ['Ephemeral'],
            });
          }
          break;
        }

        case 'stop': {
          const wasListening = voiceManager.isListeningToUser(
            interaction.guildId,
            interaction.user.id
          );

          if (!wasListening) {
            await interaction.reply({
              content: "i wasn't listening to your voice",
              flags: ['Ephemeral'],
            });
            return;
          }

          voiceManager.stopListeningToUser(
            interaction.guildId,
            interaction.user.id
          );

          const embed = new EmbedBuilder()
            .setColor(0xfaf0e7)
            .setTitle('✦ voice capture stopped')
            .setDescription(
              `stopped listening to ${interaction.user.username}'s voice`
            );

          await interaction.reply({ embeds: [embed] });

          logger.info(`stopped voice capture for ${interaction.user.username}`);
          break;
        }

        case 'status': {
          const connectionInfo = voiceManager.getConnection(
            interaction.guildId
          );

          if (!connectionInfo) {
            await interaction.reply({
              content: "i'm not in a voice channel",
              flags: ['Ephemeral'],
            });
            return;
          }

          const listeningUsers = voiceManager.getListeningUsers(
            interaction.guildId
          );
          const isListeningToUser = voiceManager.isListeningToUser(
            interaction.guildId,
            interaction.user.id
          );

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('✦ voice status')
            .addFields(
              {
                name: 'channel',
                value: connectionInfo.channel.name,
                inline: true,
              },
              {
                name: 'voice capture active',
                value: connectionInfo.captureEnabled ? 'yes' : 'no',
                inline: true,
              },
              {
                name: 'listening to you',
                value: isListeningToUser ? 'yes' : 'no',
                inline: true,
              }
            );

          if (listeningUsers.length > 0) {
            embed.addFields({
              name: 'currently listening to',
              value: listeningUsers
                .map((userId) => {
                  const guild = interaction.guild!;
                  const member = guild.members.cache.get(userId);
                  return member ? member.user.username : `user ${userId}`;
                })
                .join(', '),
              inline: false,
            });
          }

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      logger.error('error in voice command:', error);

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

export default voice;
