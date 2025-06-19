import { Events, Message, ChannelType } from 'discord.js';
import { Event } from '../types/discord';
import { logger } from '../utils/logger';
import { serviceManager } from '../services/ServiceManager';

const messageCreate: Event = {
  name: Events.MessageCreate,
  once: false,

  async execute(message: Message) {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(message.client.user!);
    const isDM = message.channel.type === ChannelType.DM;

    if (!isMentioned && !isDM) return;

    try {
      if ('send' in message.channel) {
        message.channel.sendTyping();
      }

      const memoryService = serviceManager.getMemoryService();
      const aiService = serviceManager.getAIService();

      logger.debug(`processing message in channel ${message.channelId}`);

      await memoryService.addMessage({
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        author: message.author.username,
        authorId: message.author.id,
        content: message.content,
        timestamp: message.createdAt,
        isBot: false,
      });

      const context = await memoryService.getChannelContext(
        message.channelId,
        message.guildId
      );

      logger.debug(`messages in context: ${context.messages.length}`);

      const response = await aiService.generateResponse(
        context.messages,
        message
      );

      if (response.functionCalls && response.functionCalls.length > 0) {
        logger.info(
          `executing ${response.functionCalls.length} function calls`
        );

        const functionResults = await aiService.executeFunctionCalls(
          response.functionCalls,
          message
        );

        if (response.content && response.content.trim().length > 0) {
          const sentMessage = await message.reply(response.content);
          await memoryService.addMessage({
            id: sentMessage.id,
            channelId: sentMessage.channelId,
            guildId: sentMessage.guildId,
            author: sentMessage.author.username,
            authorId: sentMessage.author.id,
            content: response.content,
            timestamp: sentMessage.createdAt,
            isBot: true,
            botId: message.client.user!.id,
          });
        }

        for (const result of functionResults) {
          await memoryService.addMessage({
            id: 'function-result-' + Date.now(),
            channelId: message.channelId,
            guildId: message.guildId,
            author: 'System',
            authorId: 'system',
            content: result,
            timestamp: new Date(),
            isBot: true,
            botId: message.client.user!.id,
          });
        }

        const updatedContext = await memoryService.getChannelContext(
          message.channelId,
          message.guildId
        );

        const followUpResponse = await aiService.generateResponse(
          updatedContext.messages,
          message
        );

        if (
          followUpResponse.content &&
          followUpResponse.content.trim().length > 0
        ) {
          if (!('send' in message.channel)) {
            logger.error('cannot send follow-up message in this channel type');
            return;
          }
          const followUpMessage = await message.channel.send(
            followUpResponse.content
          );

          await memoryService.addMessage({
            id: followUpMessage.id,
            channelId: followUpMessage.channelId,
            guildId: followUpMessage.guildId,
            author: followUpMessage.author.username,
            authorId: followUpMessage.author.id,
            content: followUpResponse.content,
            timestamp: followUpMessage.createdAt,
            isBot: true,
            botId: message.client.user!.id,
          });
        }
      } else if (response.content && response.content.trim().length > 0) {
        const sentMessage = await message.reply(response.content);

        await memoryService.addMessage({
          id: sentMessage.id,
          channelId: sentMessage.channelId,
          guildId: sentMessage.guildId,
          author: sentMessage.author.username,
          authorId: sentMessage.author.id,
          content: response.content,
          timestamp: sentMessage.createdAt,
          isBot: true,
          botId: message.client.user!.id,
        });
      }
    } catch (error) {
      logger.error('error handling message:', error);

      try {
        await message.reply(
          'sorry, i encountered an error while processing your message.'
        );
      } catch (replyError) {
        logger.error('failed to send error message:', replyError);
      }
    }
  },
};

export default messageCreate;
