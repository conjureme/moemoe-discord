import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';

import { logger } from '../../utils/logger';
import { ChannelType, TextChannel, NewsChannel } from 'discord.js';
import { serviceManager } from '../../services/ServiceManager';

export class SendChannelMessageFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'send_channel_message',
    description: 'send a message to a specific channel by ID',
    parameters: [
      {
        name: 'channel_id',
        type: 'string',
        required: true,
        description: 'the ID of the channel to send the message to',
      },
      {
        name: 'message',
        type: 'string',
        required: true,
        description: 'the message content to send',
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

    const { channel_id, message } = args;

    try {
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
        channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildNews &&
        channel.type !== ChannelType.PublicThread &&
        channel.type !== ChannelType.PrivateThread
      ) {
        return {
          success: false,
          message: `channel ${cleanChannelId} is not a text channel`,
        };
      }

      const textChannel = channel as TextChannel | NewsChannel;

      if (context.guildId && textChannel.guildId !== context.guildId) {
        return {
          success: false,
          message: `channel ${textChannel.name} is not in the current server`,
        };
      }

      const botMember = textChannel.guild.members.cache.get(
        context.message.client.user!.id
      );

      if (!botMember) {
        return {
          success: false,
          message: 'bot is not a member of the target server',
        };
      }

      const permissions = textChannel.permissionsFor(botMember);
      if (!permissions?.has('SendMessages')) {
        return {
          success: false,
          message: `bot doesn't have permission to send messages in #${textChannel.name}`,
        };
      }

      if (!permissions?.has('ViewChannel')) {
        return {
          success: false,
          message: `bot doesn't have permission to view #${textChannel.name}`,
        };
      }

      try {
        const sentMessage = await textChannel.send(message);
        logger.info(
          `sent message to #${textChannel.name} (${textChannel.id}) in ${textChannel.guild.name}`
        );

        const memoryService = serviceManager.getMemoryService();

        await memoryService.addMessage({
          id: sentMessage.id,
          channelId: sentMessage.channelId,
          guildId: sentMessage.guildId,
          author: sentMessage.author.username,
          authorId: sentMessage.author.id,
          content: message,
          timestamp: sentMessage.createdAt,
          isBot: true,
          botId: context.message.client.user!.id,
        });

        return {
          success: true,
          message: `sent message to #${textChannel.name}`,
          data: {
            channelName: textChannel.name,
            channelId: textChannel.id,
            guildName: textChannel.guild.name,
            guildId: textChannel.guild.id,
            messageId: sentMessage.id,
            messageLength: message.length,
          },
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Missing Permissions')
        ) {
          return {
            success: false,
            message: `missing permissions to send message in #${textChannel.name}`,
          };
        }
        throw error;
      }
    } catch (error) {
      logger.error('error in send_channel_message function:', error);
      return {
        success: false,
        message: `failed to send message: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
