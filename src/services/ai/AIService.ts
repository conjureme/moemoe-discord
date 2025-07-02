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
    this.provider = this.createProvider(aiConfig);

    logger.info(`initialized ai service with ${this.provider.getName()}`);
  }

  private createProvider(config: AIConfig): BaseProvider {
    switch (config.provider) {
      case 'koboldcpp':
        return new KoboldCPPProvider(config);
      default:
        throw new Error(`unsupported ai provider: ${config.provider}`);
    }
  }

  async generateResponse(
    conversationHistory: MemoryMessage[],
    message?: Message
  ): Promise<AIServiceResponse> {
    try {
      const systemPrompt = this.promptBuilder.buildSystemPrompt();
      const messages = this.promptBuilder.buildMessages(conversationHistory);

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
