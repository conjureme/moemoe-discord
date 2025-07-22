import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';

import { logger } from '../../utils/logger';
import { VoiceConnectionManager } from '../../services/voice/VoiceConnectionManager';

import { getVoiceConnection } from '@discordjs/voice';

export class LeaveCallFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'leave_call',
    description: 'leave the current voice channel',
    parameters: [],
  };

  async execute(
    context: FunctionContext,
    args: Record<string, any>
  ): Promise<FunctionResult> {
    try {
      if (!context.guildId) {
        return {
          success: false,
          message: 'this command can only be used in a server',
        };
      }

      const voiceManager = VoiceConnectionManager.getInstance();
      let connectionInfo = voiceManager.getConnection(context.guildId);

      if (!connectionInfo) {
        const discordConnection = getVoiceConnection(context.guildId);

        if (!discordConnection) {
          return {
            success: false,
            message: 'i am not in a voice channel',
          };
        }

        logger.warn(
          `found orphaned voice connection in guild ${context.guildId}, cleaning up`
        );
        discordConnection.destroy();

        return {
          success: true,
          message: 'left voice channel (cleaned up orphaned connection)',
          data: {
            channelName: 'unknown',
            duration: 0,
          },
        };
      }

      const channelName = connectionInfo.channel.name;
      const duration = new Date().getTime() - connectionInfo.joinedAt.getTime();
      const durationMinutes = Math.floor(duration / 60000);

      voiceManager.removeConnection(context.guildId);

      logger.info(
        `left voice channel ${channelName} in guild ${context.guildId}`
      );

      return {
        success: true,
        message: `left ${channelName}`,
        data: {
          channelName,
          duration: durationMinutes,
        },
      };
    } catch (error) {
      logger.error('error in leave_call function:', error);

      // fallback- try to force disconnect any existing connection
      try {
        if (context.guildId) {
          const discordConnection = getVoiceConnection(context.guildId);
          if (discordConnection) {
            discordConnection.destroy();
            logger.info(
              `force disconnected from voice channel in guild ${context.guildId}`
            );
            return {
              success: true,
              message: 'force disconnected from voice channel',
            };
          }
        }
      } catch (fallbackError) {
        logger.error('error in fallback disconnect:', fallbackError);
      }

      return {
        success: false,
        message: `failed to leave voice channel: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
