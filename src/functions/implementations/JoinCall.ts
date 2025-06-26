import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';

import { logger } from '../../utils/logger';
import { ChannelType, VoiceChannel, StageChannel } from 'discord.js';

import {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';

import { VoiceConnectionManager } from '../../services/voice/VoiceConnectionManager';

export class JoinCallFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'join_call',
    description: 'join a voice or stage channel',
    parameters: [
      {
        name: 'channel_id',
        type: 'string',
        required: false,
        description:
          'the ID of the voice channel to join (defaults to the channel the user is in)',
      },
    ],
  };

  async execute(
    context: FunctionContext,
    args: Record<string, any>
  ): Promise<FunctionResult> {
    const validationError = this.validateArgs(args);
    if (validationError) {
      return {
        success: false,
        message: validationError,
      };
    }

    const { channel_id } = args;

    try {
      let targetChannel: VoiceChannel | StageChannel | null = null;

      if (channel_id) {
        const cleanChannelId = channel_id.replace(/[<#>]/g, '');
        const channel = await context.message.client.channels
          .fetch(cleanChannelId)
          .catch(() => null);

        if (!channel) {
          return {
            success: false,
            message: `channel with ID ${cleanChannelId} not found`,
          };
        }

        if (
          channel.type !== ChannelType.GuildVoice &&
          channel.type !== ChannelType.GuildStageVoice
        ) {
          return {
            success: false,
            message: `channel ${cleanChannelId} is not a voice channel`,
          };
        }

        targetChannel = channel as VoiceChannel | StageChannel;
      } else {
        if (!context.guildId) {
          return {
            success: false,
            message: 'cannot join voice channels in DMs',
          };
        }

        const guild = await context.message.client.guilds
          .fetch(context.guildId)
          .catch(() => null);

        if (!guild) {
          return {
            success: false,
            message: 'guild not found',
          };
        }

        const member = await guild.members
          .fetch(context.authorId)
          .catch(() => null);

        if (!member) {
          return {
            success: false,
            message: 'could not find you in the server',
          };
        }

        if (!member.voice.channel) {
          return {
            success: false,
            message: 'you are not in a voice channel',
          };
        }

        targetChannel = member.voice.channel;
      }

      // check bot permissions
      const botMember = targetChannel.guild.members.cache.get(
        context.message.client.user!.id
      );

      if (!botMember) {
        return {
          success: false,
          message: 'bot is not a member of the server',
        };
      }

      const permissions = targetChannel.permissionsFor(botMember);
      if (!permissions?.has('Connect')) {
        return {
          success: false,
          message: `i don't have permission to join ${targetChannel.name}`,
        };
      }

      if (!permissions?.has('Speak')) {
        return {
          success: false,
          message: `i don't have permission to speak in ${targetChannel.name}`,
        };
      }

      const existingConnection = getVoiceConnection(targetChannel.guild.id);

      if (existingConnection) {
        if (existingConnection.joinConfig.channelId === targetChannel.id) {
          return {
            success: false,
            message: `i'm already in ${targetChannel.name}`,
          };
        }

        // destroy existing connection to join new channel
        existingConnection.destroy();
        logger.info(`left voice channel to join ${targetChannel.name}`);
      }

      const connection = joinVoiceChannel({
        channelId: targetChannel.id,
        guildId: targetChannel.guild.id,
        adapterCreator: targetChannel.guild.voiceAdapterCreator,
        selfDeaf: false, // don't self-deafen for future voice capture
        selfMute: false, // don't self-mute for future TTS playback
      });

      // wait for connection to be ready
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      } catch (error) {
        connection.destroy();
        return {
          success: false,
          message: 'failed to connect to voice channel within 30 seconds',
        };
      }

      // store connection info for future use
      const voiceManager = VoiceConnectionManager.getInstance();
      voiceManager.setConnection(
        targetChannel.guild.id,
        connection,
        targetChannel
      );

      logger.info(
        `joined voice channel ${targetChannel.name} (${targetChannel.id}) in ${targetChannel.guild.name}`
      );

      return {
        success: true,
        message: `joined ${targetChannel.name}`,
        data: {
          channelName: targetChannel.name,
          channelId: targetChannel.id,
          guildName: targetChannel.guild.name,
          guildId: targetChannel.guild.id,
          memberCount: targetChannel.members.size,
        },
      };
    } catch (error) {
      logger.error('error in join_call function:', error);
      return {
        success: false,
        message: `failed to join voice channel: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
