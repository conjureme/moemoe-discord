import { BaseProvider } from './providers/BaseProvider';
import { KoboldCPPProvider } from './providers/KoboldCPPProvider';

import { PromptBuilder } from './PromptBuilder';
import { ConfigService } from '../config/ConfigService';
import { MemoryMessage } from '../memory/types';
import {
  FunctionRegistry,
  FunctionCall,
} from '../../functions/FunctionRegistry';
import { FunctionContext } from '../../functions/BaseFunction';

import { AIConfig, ChatContext } from '../../types/ai';
import { logger } from '../../utils/logger';
import { Message } from 'discord.js';

export interface AIServiceResponse {
  content: string;
  functionCalls?: FunctionCall[];
  rawContent?: string;
}

export class AIService {
  private provider: BaseProvider;
  private promptBuilder: PromptBuilder;
  private configService: ConfigService;
  private functionRegistry: FunctionRegistry;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.functionRegistry = new FunctionRegistry();
    this.promptBuilder = new PromptBuilder(
      configService,
      this.functionRegistry
    );

    const aiConfig = this.configService.getAIConfig();
    const connectionConfig = this.configService.getAIConnectionConfig();

    if (!connectionConfig.apiUrl) {
      throw new Error('API_URL environment variable is required');
    }

    if (!connectionConfig.apiProvider) {
      throw new Error('API_PROVIDER environment variable is required');
    }

    const providerConfig = {
      ...aiConfig,
      apiProvider: connectionConfig.apiProvider,
      apiUrl: connectionConfig.apiUrl,
      apiKey: connectionConfig.apiKey,
    };

    this.provider = this.createProvider(providerConfig);

    logger.info(`initialized ai service with ${this.provider.getName()}`);
  }

  private createProvider(
    config: AIConfig & { apiProvider: string; apiUrl: string; apiKey?: string }
  ): BaseProvider {
    switch (config.apiProvider) {
      case 'koboldcpp':
        return new KoboldCPPProvider(config);
      default:
        throw new Error(`unsupported ai provider: ${config.apiProvider}`);
    }
  }

  async generateResponse(
    conversationHistory: MemoryMessage[],
    message?: Message
  ): Promise<AIServiceResponse> {
    try {
      const systemPrompt = this.promptBuilder.buildSystemPrompt();
      const messages = this.promptBuilder.buildMessages(conversationHistory);

      if (message?.attachments && message.attachments.size > 0) {
        const imageAttachments = message.attachments.filter((att) =>
          att.contentType?.startsWith('image/')
        );

        if (imageAttachments.size > 0) {
          const lastUserMessageIndex = messages
            .map((msg, idx) => ({ msg, idx }))
            .reverse()
            .find((item) => item.msg.role === 'user')?.idx;

          if (lastUserMessageIndex !== undefined) {
            messages[lastUserMessageIndex].images = imageAttachments.map(
              (att) => att.url
            );

            const imageCount = imageAttachments.size;
            const imageText = imageCount === 1 ? '[image attached]' : `[${imageCount} images attached]`;
            messages[lastUserMessageIndex].content += `\n${imageText}`;

            logger.debug(
              `added ${imageAttachments.size} images to current message`
            );
          }
        }
      }

      const context: ChatContext = {
        systemPrompt,
        messages,
      };

      logger.debug(
        `generating response with ${messages.length} messages in context`
      );
      const response = await this.provider.generateResponse(context);

      if (response.usage) {
        logger.debug(
          `tokens used - prompt: ${response.usage.promptTokens}, completion: ${response.usage.completionTokens}`
        );
      }

      // clean the response - remove bot name prefix if present
      let cleanedContent = this.cleanBotResponse(response.content);

      const functionCalls =
        this.functionRegistry.parseFunctionCalls(cleanedContent);
      const contentWithoutFunctions =
        this.functionRegistry.removeFunctionCalls(cleanedContent);

      if (functionCalls.length > 0) {
        logger.info(
          `detected ${functionCalls.length} function calls in response`
        );
      }

      return {
        content: contentWithoutFunctions,
        rawContent: cleanedContent,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      };
    } catch (error) {
      logger.error('failed to generate ai response:', error);
      throw error;
    }
  }

  private cleanBotResponse(response: string): string {
    const botConfig = this.configService.getBotConfig();
    const botName = botConfig.name;

    // remove bot name prefix patterns
    const patterns = [
      new RegExp(`^${botName}:\\s*`, 'i'), // "moemoe: "
      new RegExp(`^\\*${botName}\\*:\\s*`, 'i'), // "*moemoe*: "
      new RegExp(`^\\*\\*${botName}\\*\\*:\\s*`, 'i'), // "**moemoe**: "
      new RegExp(`^\\[${botName}\\]:\\s*`, 'i'), // "[moemoe]: "
    ];

    let cleaned = response;
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  async executeFunctionCalls(
    functionCalls: FunctionCall[],
    message: Message
  ): Promise<string[]> {
    const results: string[] = [];

    const context: FunctionContext = {
      message,
      channelId: message.channelId,
      guildId: message.guildId,
      authorId: message.author.id,
      authorName: message.author.username,
    };

    for (const call of functionCalls) {
      const result = await this.functionRegistry.executeFunction(
        call.name,
        context,
        call.args
      );

      const resultMessage = result.success
        ? `[FUNCTION: ${call.name} - ${result.message}]`
        : `[FUNCTION: ${call.name} failed - ${result.message}]`;

      results.push(resultMessage);
    }

    return results;
  }

  validateConfiguration(): boolean {
    return this.provider.validateConfig();
  }

  getProviderName(): string {
    return this.provider.getName();
  }

  getFunctionRegistry(): FunctionRegistry {
    return this.functionRegistry;
  }
}
