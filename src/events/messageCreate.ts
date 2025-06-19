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

      // log current state before adding message
      logger.debug(`processing message in channel ${message.channelId}`);
      const beforeContext = await memoryService.getChannelContext(
        message.channelId,
        message.guildId
      );
      logger.debug(
        `messages in memory before adding: ${beforeContext.messages.length}`
      );

      // add user message to memory
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

      // get conversation context
      const context = await memoryService.getChannelContext(
        message.channelId,
        message.guildId
      );

      logger.debug(
        `messages in context after adding: ${context.messages.length}`
      );
      if (context.messages.length > 0) {
        logger.debug(
          `first message in context: ${context.messages[0]?.content.substring(0, 50)}...`
        );
        logger.debug(
          `last message in context: ${context.messages[context.messages.length - 1]?.content.substring(0, 50)}...`
        );
      }

      // generate ai response
      const response = await aiService.generateResponse(context.messages);

      if (response && response.trim().length > 0) {
        const sentMessage = await message.reply(response);

        // add bot response to memory with proper tagging
        await memoryService.addMessage({
          id: sentMessage.id,
          channelId: sentMessage.channelId,
          guildId: sentMessage.guildId,
          author: sentMessage.author.username,
          authorId: sentMessage.author.id,
          content: response,
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
