import { BaseProvider } from './providers/BaseProvider';
import { LocalProvider } from './providers/LocalProvider';
import { PromptBuilder } from './PromptBuilder';
import { ConfigService } from '../config/ConfigService';
import { MemoryMessage } from '../memory/types';

import { AIConfig, AIResponse, ChatContext } from '../../types/ai';
import { logger } from '../../utils/logger';

export class AIService {
  private provider: BaseProvider;
  private promptBuilder: PromptBuilder;
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.promptBuilder = new PromptBuilder(configService);

    const aiConfig = this.configService.getAIConfig();
    this.provider = this.createProvider(aiConfig);

    logger.info(`initialized ai service with ${this.provider.getName()}`);
  }

  private createProvider(config: AIConfig): BaseProvider {
    switch (config.provider) {
      case 'local':
        return new LocalProvider(config);
      default:
        throw new Error(`unsupported ai provider: ${config.provider}`);
    }
  }

  async generateResponse(
    conversationHistory: MemoryMessage[]
  ): Promise<string> {
    try {
      // build context
      const systemPrompt = this.promptBuilder.buildSystemPrompt();
      const messages = this.promptBuilder.buildMessages(conversationHistory);

      const context: ChatContext = {
        systemPrompt,
        messages,
      };

      // generate response
      logger.debug(
        `generating response with ${messages.length} messages in context`
      );
      const response = await this.provider.generateResponse(context);

      if (response.usage) {
        logger.debug(
          `tokens used - prompt: ${response.usage.promptTokens}, completion: ${response.usage.completionTokens}`
        );
      }

      return response.content;
    } catch (error) {
      logger.error('failed to generate ai response:', error);
      throw error;
    }
  }

  validateConfiguration(): boolean {
    return this.provider.validateConfig();
  }

  getProviderName(): string {
    return this.provider.getName();
  }
}
