import { BaseProcessor, ProcessorContext } from './Base';
import { logger } from '../../../utils/logger';

export class GenerateResponsePlaceholder extends BaseProcessor {
  name = 'generate-response-placeholder';
  pattern = /\{generate_response:([^}]+)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const prompt = match[1];

    try {
      if (!context.services.ai) {
        logger.warn('AI service not available for generate_response');
        return match[0];
      }

      const response = await this.generateAIResponse(prompt, context);

      if (!context.metadata) {
        context.metadata = {};
      }
      context.metadata.generatedResponse = response;

      logger.debug(`generated AI response: "${response}"`);

      return '';
    } catch (error) {
      logger.error(
        `error generating AI response for prompt "${prompt}":`,
        error
      );
      return match[0];
    }
  }

  private async generateAIResponse(
    prompt: string,
    context: ProcessorContext
  ): Promise<string> {
    const aiService = context.services.ai!;

    // process nested placeholders in the prompt first
    let processedPrompt = prompt;
    if (context.processNested) {
      processedPrompt = await context.processNested(prompt);
    }

    const formattedPrompt = `[SYSTEM: generate_response - ${processedPrompt}]`;

    // create a minimal context with just the prompt as a system message
    // this way we get a direct response without conversation history
    const systemMessage = {
      id: `generate-${Date.now()}`,
      channelId: context.message.channelId,
      guildId: context.message.guildId,
      author: 'System',
      authorId: 'system',
      content: formattedPrompt,
      timestamp: new Date(),
      isBot: false,
      isSystem: true,
    };

    const response = await aiService.generateResponse(
      [systemMessage],
      context.message
    );

    return response.content || '';
  }
}

export class GeneratedResponseVariable extends BaseProcessor {
  name = 'generated-response-variable';
  pattern = /\[response\]/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    if (context.metadata?.generatedResponse) {
      return context.metadata.generatedResponse;
    }

    logger.debug('no generated response found for [response] placeholder');
    return '';
  }
}
