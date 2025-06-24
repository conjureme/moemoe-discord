import { Events, Message, ChannelType } from 'discord.js';
import { Event } from '../types/discord';
import { logger } from '../utils/logger';
import { serviceManager } from '../services/ServiceManager';
import { removeUnicodeEmojis } from '../utils/emojiFilter';

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

      const imageAttachments = message.attachments.filter(
        (attachment) =>
          attachment.contentType?.startsWith('image/') ||
          /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.name || '')
      );

      logger.debug(`found ${imageAttachments.size} image attachments`);
      logger.debug(
        `image attachments: ${JSON.stringify(
          Array.from(imageAttachments.values()).map((att) => ({
            url: att.url,
            type: att.contentType,
            name: att.name,
          }))
        )}`
      );

      await memoryService.addMessage({
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        author: message.author.username,
        authorId: message.author.id,
        content: message.content,
        timestamp: message.createdAt,
        isBot: false,
        attachments: imageAttachments.map((att) => ({
          url: att.url,
          type: att.contentType || 'image/unknown',
          name: att.name || 'image',
          size: att.size,
        })),
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

      // filter unicode emojis from the response
      const filteredContent = removeUnicodeEmojis(response.content);
      const filteredRawContent = response.rawContent
        ? removeUnicodeEmojis(response.rawContent)
        : filteredContent;

      if (response.functionCalls && response.functionCalls.length > 0) {
        logger.info(
          `executing ${response.functionCalls.length} function calls`
        );

        const functionResults = await aiService.executeFunctionCalls(
          response.functionCalls,
          message
        );

        // send the clean content (without function calls) to discord
        if (filteredContent && filteredContent.trim().length > 0) {
          const sentMessage = await message.reply(filteredContent);

          // store the RAW content (with function calls) in memory
          await memoryService.addMessage({
            id: sentMessage.id,
            channelId: sentMessage.channelId,
            guildId: sentMessage.guildId,
            author: sentMessage.author.username,
            authorId: sentMessage.author.id,
            content: filteredRawContent, // use filtered raw content
            timestamp: sentMessage.createdAt,
            isBot: true,
            botId: message.client.user!.id,
          });
        } else {
          // if no visible content, still store the function calls in memory
          await memoryService.addMessage({
            id: 'function-call-' + Date.now(),
            channelId: message.channelId,
            guildId: message.guildId,
            author: message.client.user!.username,
            authorId: message.client.user!.id,
            content: filteredRawContent, // store the filtered function calls
            timestamp: new Date(),
            isBot: true,
            botId: message.client.user!.id,
          });
        }

        // store function results as system messages
        for (const result of functionResults) {
          await memoryService.addSystemMessage({
            channelId: message.channelId,
            guildId: message.guildId,
            content: result,
            timestamp: new Date(),
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

        // filter emojis from follow-up response too
        const filteredFollowUp = removeUnicodeEmojis(followUpResponse.content);
        const filteredFollowUpRaw = followUpResponse.rawContent
          ? removeUnicodeEmojis(followUpResponse.rawContent)
          : filteredFollowUp;

        if (filteredFollowUp && filteredFollowUp.trim().length > 0) {
          if (!('send' in message.channel)) {
            logger.error('cannot send follow-up message in this channel type');
            return;
          }
          const followUpMessage = await message.channel.send(filteredFollowUp);

          await memoryService.addMessage({
            id: followUpMessage.id,
            channelId: followUpMessage.channelId,
            guildId: followUpMessage.guildId,
            author: followUpMessage.author.username,
            authorId: followUpMessage.author.id,
            content: filteredFollowUpRaw,
            timestamp: followUpMessage.createdAt,
            isBot: true,
            botId: message.client.user!.id,
          });
        }
      } else if (filteredContent && filteredContent.trim().length > 0) {
        const sentMessage = await message.reply(filteredContent);

        await memoryService.addMessage({
          id: sentMessage.id,
          channelId: sentMessage.channelId,
          guildId: sentMessage.guildId,
          author: sentMessage.author.username,
          authorId: sentMessage.author.id,
          content: filteredRawContent,
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
