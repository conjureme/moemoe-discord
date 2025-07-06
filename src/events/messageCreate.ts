import { Events, Message, ChannelType } from 'discord.js';
import { Event } from '../types/discord';

import { serviceManager } from '../services/ServiceManager';
import { removeUnicodeEmojis } from '../utils/emojiFilter';
import { MessageFormatter } from '../utils/MessageFormatter';
import { initializeWordFilter, getWordFilter } from '../utils/wordFilter';

import { logger } from '../utils/logger';

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
      const configService = serviceManager.getConfigService();

      let wordFilter = getWordFilter();
      if (!wordFilter) {
        const filterConfig = configService.getFilterConfig();
        if (filterConfig.enabled) {
          wordFilter = initializeWordFilter(filterConfig);
        }
      }

      logger.debug(`processing message in channel ${message.channelId}`);

      const imageAttachments = message.attachments.filter(
        (attachment) =>
          attachment.contentType?.startsWith('image/') ||
          /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.name || '')
      );

      // logger.debug(`found ${imageAttachments.size} image attachments`);
      // logger.debug(
      //   `image attachments: ${JSON.stringify(
      //     Array.from(imageAttachments.values()).map((att) => ({
      //       url: att.url,
      //       type: att.contentType,
      //       name: att.name,
      //     }))
      //   )}`
      // );

      // format user message content before storing
      const memoryConfig = configService.getMemoryConfig();
      const formattedContent = MessageFormatter.formatUserMessage(
        message,
        message.content,
        memoryConfig
      );

      await memoryService.addMessage({
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        author: message.author.username,
        authorId: message.author.id,
        content: formattedContent,
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

      let wasFiltered = false;
      let originalContent = response.content;
      let matchedWords: string[] = [];

      if (wordFilter && response.content) {
        const filterResult = wordFilter.checkMessage(response.content);
        if (filterResult.isFiltered) {
          wasFiltered = true;
          originalContent = response.content;
          matchedWords = filterResult.matchedWords || [];
          response.content = filterResult.filteredContent || '[filtered]';
        }
      }

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

        let sentMessage: Message | null = null;

        // only send discord message if there's actual content to display
        if (filteredContent && filteredContent.trim().length > 0) {
          sentMessage = await message.reply(filteredContent);
        }

        const messageToStore = {
          id: sentMessage?.id || `synthetic-${Date.now()}`,
          channelId: message.channelId,
          guildId: message.guildId,
          author: message.client.user!.username,
          authorId: message.client.user!.id,
          content: wasFiltered ? originalContent : filteredRawContent,
          timestamp: sentMessage?.createdAt || new Date(),
          isBot: true,
          botId: message.client.user!.id,
        };

        await memoryService.addMessage(messageToStore);

        if (wasFiltered && sentMessage) {
          await memoryService.addSystemMessage({
            channelId: message.channelId,
            guildId: message.guildId,
            content: `[FILTER: Response was filtered. Matched words: ${matchedWords.join(', ')}.]`,
            timestamp: new Date(),
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

        // get updated context for follow-up
        const updatedContext = await memoryService.getChannelContext(
          message.channelId,
          message.guildId
        );

        const followUpResponse = await aiService.generateResponse(
          updatedContext.messages,
          message
        );

        // check if follow-up should be filtered too
        let followUpFiltered = false;
        let followUpOriginal = followUpResponse.content;
        if (wordFilter && followUpResponse.content) {
          const followUpFilterResult = wordFilter.checkMessage(
            followUpResponse.content
          );
          if (followUpFilterResult.isFiltered) {
            followUpFiltered = true;
            followUpOriginal = followUpResponse.content;
            followUpResponse.content =
              followUpFilterResult.filteredContent || '[filtered]';
          }
        }

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
            content: followUpFiltered ? followUpOriginal : filteredFollowUpRaw,
            timestamp: followUpMessage.createdAt,
            isBot: true,
            botId: message.client.user!.id,
          });

          if (followUpFiltered) {
            await memoryService.addSystemMessage({
              channelId: message.channelId,
              guildId: message.guildId,
              content: `[FILTER: Follow-up response was filtered.]`,
              timestamp: new Date(),
            });
          }
        }
      } else if (filteredContent && filteredContent.trim().length > 0) {
        const sentMessage = await message.reply(filteredContent);

        await memoryService.addMessage({
          id: sentMessage.id,
          channelId: sentMessage.channelId,
          guildId: sentMessage.guildId,
          author: sentMessage.author.username,
          authorId: sentMessage.author.id,
          content: wasFiltered ? originalContent : filteredRawContent,
          timestamp: sentMessage.createdAt,
          isBot: true,
          botId: message.client.user!.id,
        });

        if (wasFiltered) {
          await memoryService.addSystemMessage({
            channelId: message.channelId,
            guildId: message.guildId,
            content: `[FILTER: Response was filtered. Matched words: ${matchedWords.join(', ')}.]`,
            timestamp: new Date(),
          });
        }
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
