import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';

import { logger } from '../../utils/logger';
import { VoiceConnectionManager } from '../../services/voice/VoiceConnectionManager';

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
      const connectionInfo = voiceManager.getConnection(context.guildId);

      if (!connectionInfo) {
        return {
          success: false,
          message: 'i am not in a voice channel',
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
      return {
        success: false,
        message: `failed to leave voice channel: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
