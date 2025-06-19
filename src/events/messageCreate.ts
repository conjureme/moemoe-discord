import { Events, Message, ChannelType } from 'discord.js';
import { Event } from '../types/discord';
import { logger } from '../utils/logger';
import { AIService } from '../services/ai/AIService';
import { MemoryService } from '../services/memory/MemoryService';
import { ConfigService } from '../services/config/ConfigService';

const configService = new ConfigService();
const memoryService = new MemoryService(configService);
const aiService = new AIService(configService);

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
