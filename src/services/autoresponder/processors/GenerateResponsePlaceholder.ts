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

    let processedPrompt = prompt;

    // handle placeholders iwthin the prompt
    // surely this will be perfect and bug free
    processedPrompt = await this.processNestedPlaceholders(
      processedPrompt,
      context
    );

    const formattedPrompt = `[SYSTEM: generate_response - ${processedPrompt}]`;

    // create a minimal context with just the prompt as a system message
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

  private async processNestedPlaceholders(
    text: string,
    context: ProcessorContext
  ): Promise<string> {
    let processed = text;

    // all placeholders inside will use square brackets.
    // will probably be unique to only this
    processed = processed.replace(
      /\[user\]/gi,
      context.message.author.toString()
    );
    processed = processed.replace(
      /\[username\]/gi,
      context.message.author.username
    );
    processed = processed.replace(
      /\[displayname\]/gi,
      context.message.author.displayName
    );
    processed = processed.replace(/\[user_id\]/gi, context.message.author.id);
    processed = processed.replace(
      /\[user_nickname\]/gi,
      context.member?.nickname || context.message.author.username
    );

    // process server placeholders
    processed = processed.replace(
      /\[server_name\]/gi,
      context.guild?.name || 'this server'
    );
    processed = processed.replace(
      /\[server_id\]/gi,
      context.guild?.id || 'unknown'
    );
    processed = processed.replace(
      /\[server_membercount\]/gi,
      context.guild?.memberCount.toString() || '0'
    );

    // process channel placeholders
    processed = processed.replace(
      /\[channel\]/gi,
      context.message.channel.toString()
    );
    processed = processed.replace(
      /\[channel_id\]/gi,
      context.message.channelId
    );

    logger.debug(`processed nested placeholders: "${text}" -> "${processed}"`);
    return processed;
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
