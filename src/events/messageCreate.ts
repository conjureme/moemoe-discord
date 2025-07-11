import { Events, Message, ChannelType } from 'discord.js';
import { Event } from '../types/discord';

import { serviceManager } from '../services/ServiceManager';
import { MessageFormatter } from '../utils/MessageFormatter';
import { initializeWordFilter, getWordFilter } from '../utils/wordFilter';
import { FunctionCall } from '../functions/FunctionRegistry';

import { logger } from '../utils/logger';

const messageCreate: Event = {
  name: Events.MessageCreate,
  once: false,

  async execute(message: Message) {
    if (message.author.bot) return;

    const shouldProcess =
      message.mentions.has(message.client.user!) ||
      message.channel.type === ChannelType.DM;

    if (!shouldProcess) return;

    try {
      await processMessage(message);
    } catch (error) {
      logger.error('error handling message:', error);
      await sendErrorReply(message);
    }
  },
};

async function processMessage(message: Message): Promise<void> {
  startTyping(message);

  const services = getServices();
  const wordFilter = getOrInitializeWordFilter(services.config);

  logger.debug(`processing message in channel ${message.channelId}`);

  // store user message
  await storeUserMessage(message, services);

  // generate ai response
  const context = await services.memory.getChannelContext(
    message.channelId,
    message.guildId
  );

  logger.debug(`messages in context: ${context.messages.length}`);

  const response = await services.ai.generateResponse(
    context.messages,
    message
  );

  // handle response
  if (response.functionCalls?.length) {
    await handleFunctionCalls(message, response, services, wordFilter);
  } else if (response.content?.trim()) {
    await handleSimpleResponse(message, response.content, services, wordFilter);
  }
}

async function storeUserMessage(
  message: Message,
  services: ReturnType<typeof getServices>
): Promise<void> {
  const formattedContent = MessageFormatter.formatUserMessage(
    message,
    message.content,
    services.config.getMemoryConfig()
  );

  const imageAttachments = getImageAttachments(message);

  await services.memory.addMessage({
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
}

async function handleSimpleResponse(
  message: Message,
  content: string,
  services: ReturnType<typeof getServices>,
  wordFilter: ReturnType<typeof getWordFilter>
): Promise<void> {
  const { filteredContent, wasFiltered, matchedWords } = filterContent(
    content,
    wordFilter
  );

  const sentMessage = await message.reply(filteredContent);

  await storeBotMessage(sentMessage, wasFiltered ? content : content, services);

  if (wasFiltered) {
    await storeFilterNotification(message, matchedWords, services);
  }
}

async function handleFunctionCalls(
  message: Message,
  response: {
    content: string;
    functionCalls?: FunctionCall[];
    rawContent?: string;
  },
  services: ReturnType<typeof getServices>,
  wordFilter: ReturnType<typeof getWordFilter>
): Promise<void> {
  logger.info(`executing ${response.functionCalls!.length} function calls`);

  const functionResults = await services.ai.executeFunctionCalls(
    response.functionCalls!,
    message
  );

  // determine what content to store in memory
  // rawContent includes function calls, content is without them
  const contentToStore = response.rawContent || response.content;

  let sentMessage: Message | null = null;
  if (response.content?.trim()) {
    const { filteredContent, wasFiltered, matchedWords } = filterContent(
      response.content,
      wordFilter
    );
    sentMessage = await message.reply(filteredContent);

    if (wasFiltered) {
      await storeFilterNotification(message, matchedWords, services);
    }
  }

  await storeBotMessage(
    sentMessage || createSyntheticMessage(message),
    contentToStore,
    services
  );

  await storeFunctionResults(functionResults, message, services);

  await generateFollowUp(message, services, wordFilter);
}

async function generateFollowUp(
  message: Message,
  services: ReturnType<typeof getServices>,
  wordFilter: ReturnType<typeof getWordFilter>
): Promise<void> {
  const updatedContext = await services.memory.getChannelContext(
    message.channelId,
    message.guildId
  );

  const followUpResponse = await services.ai.generateResponse(
    updatedContext.messages,
    message
  );

  if (!followUpResponse.content?.trim()) return;

  const { filteredContent, wasFiltered } = filterContent(
    followUpResponse.content,
    wordFilter
  );

  if (!('send' in message.channel)) {
    logger.error('cannot send follow-up message in this channel type');
    return;
  }

  const followUpMessage = await message.channel.send(filteredContent);

  await storeBotMessage(
    followUpMessage,
    wasFiltered
      ? followUpResponse.content
      : followUpResponse.rawContent || followUpResponse.content,
    services
  );

  if (wasFiltered) {
    await storeFilterNotification(message, [], services);
  }
}

// helper functions

interface SyntheticMessage {
  id: string;
  channelId: string;
  guildId: string | null;
  author: { username: string; id: string };
  createdAt: Date;
  client: { user: { id: string } | null };
}

function createSyntheticMessage(originalMessage: Message): SyntheticMessage {
  return {
    id: `synthetic-${Date.now()}`,
    channelId: originalMessage.channelId,
    guildId: originalMessage.guildId,
    author: originalMessage.client.user!,
    createdAt: new Date(),
    client: originalMessage.client,
  };
}

function getServices() {
  return {
    memory: serviceManager.getMemoryService(),
    ai: serviceManager.getAIService(),
    config: serviceManager.getConfigService(),
  };
}

function getOrInitializeWordFilter(
  configService: ReturnType<typeof serviceManager.getConfigService>
) {
  let wordFilter = getWordFilter();
  if (!wordFilter) {
    const filterConfig = configService.getFilterConfig();
    if (filterConfig.enabled) {
      wordFilter = initializeWordFilter(filterConfig);
    }
  }
  return wordFilter;
}

function startTyping(message: Message): void {
  if ('send' in message.channel) {
    message.channel.sendTyping();
  }
}

function getImageAttachments(message: Message) {
  return message.attachments.filter(
    (attachment) =>
      attachment.contentType?.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.name || '')
  );
}

function filterContent(
  content: string,
  wordFilter: ReturnType<typeof getWordFilter>
): { filteredContent: string; wasFiltered: boolean; matchedWords: string[] } {
  if (!wordFilter || !content) {
    return { filteredContent: content, wasFiltered: false, matchedWords: [] };
  }

  const filterResult = wordFilter.checkMessage(content);

  return {
    filteredContent: filterResult.isFiltered
      ? filterResult.filteredContent || '[filtered]'
      : content,
    wasFiltered: filterResult.isFiltered,
    matchedWords: filterResult.matchedWords || [],
  };
}

async function storeBotMessage(
  message: Message | SyntheticMessage,
  originalContent: string,
  services: ReturnType<typeof getServices>
): Promise<void> {
  await services.memory.addMessage({
    id: message.id,
    channelId: message.channelId,
    guildId: message.guildId,
    author: message.author.username,
    authorId: message.author.id,
    content: originalContent,
    timestamp: message.createdAt,
    isBot: true,
    botId: message.client.user!.id,
  });
}

async function storeFilterNotification(
  message: Message,
  matchedWords: string[],
  services: ReturnType<typeof getServices>
): Promise<void> {
  const content =
    matchedWords.length > 0
      ? `[FILTER: Response was filtered. Matched words: ${matchedWords.join(', ')}.]`
      : `[FILTER: Response was filtered.]`;

  await services.memory.addSystemMessage({
    channelId: message.channelId,
    guildId: message.guildId,
    content,
    timestamp: new Date(),
  });
}

async function storeFunctionResults(
  results: string[],
  message: Message,
  services: ReturnType<typeof getServices>
): Promise<void> {
  for (const result of results) {
    await services.memory.addSystemMessage({
      channelId: message.channelId,
      guildId: message.guildId,
      content: result,
      timestamp: new Date(),
    });
  }
}

async function sendErrorReply(message: Message): Promise<void> {
  try {
    await message.reply(
      'sorry, i encountered an error while processing your message.'
    );
  } catch (replyError) {
    logger.error('failed to send error message:', replyError);
  }
}

export default messageCreate;
