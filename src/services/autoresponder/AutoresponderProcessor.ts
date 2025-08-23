import { Message } from 'discord.js';

import {
  BaseProcessor,
  ProcessorContext,
  ConstraintNotMetError,
} from './processors/Base';

import { UserPlaceholderProcessor } from './processors/UserPlaceholder';
import { ServerPlaceholderProcessor } from './processors/ServerPlaceholder';
import { ChannelPlaceholderProcessor } from './processors/ChannelPlaceholder';
import { EconomyPlaceholderProcessor } from './processors/EconomyPlaceholder';

import { serviceManager } from '../ServiceManager';
import { logger } from '../../utils/logger';

export class AutoresponderProcessor {
  private processors: BaseProcessor[] = [];
  private static instance: AutoresponderProcessor;

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): AutoresponderProcessor {
    if (!AutoresponderProcessor.instance) {
      AutoresponderProcessor.instance = new AutoresponderProcessor();
    }
    return AutoresponderProcessor.instance;
  }

  private registerDefaults(): void {
    this.processors = [
      new UserPlaceholderProcessor(),
      new ServerPlaceholderProcessor(),
      new ChannelPlaceholderProcessor(),
      new EconomyPlaceholderProcessor(),
    ];

    logger.debug(
      `registered ${this.processors.length} autoresponder processors`
    );
  }

  async processReply(
    reply: string,
    message: Message,
    triggerArgs?: string[]
  ): Promise<string | null> {
    const context: ProcessorContext = {
      message,
      guild: message.guild || undefined,
      member: message.member || undefined,
      triggerArgs: triggerArgs || message.content.toLowerCase().split(/\s+/),
      services: {
        economy: serviceManager.getEconomyService(),
        ai: serviceManager.getAIService(),
      },
      processNested: (text) => this.processText(text, context),
    };

    try {
      return await this.processText(reply, context);
    } catch (error) {
      if (error instanceof ConstraintNotMetError) {
        logger.debug(`autoresponder constraint not met: ${error.message}`);
        return null; // don't send response
      }
      logger.error('error processing autoresponder reply:', error);
      throw error;
    }
  }

  private async processText(
    text: string,
    context: ProcessorContext
  ): Promise<string> {
    let processed = text;

    logger.debug(`processing text: "${text}"`);

    for (const processor of this.processors) {
      if (!processor.canProcess(processed)) {
        continue;
      }

      // use a fresh regex instance for matchAll
      const freshPattern = processor.getFreshPattern();
      const matches = [...processed.matchAll(freshPattern)];

      logger.debug(`${processor.name} found ${matches.length} matches`);

      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const matchIndex = match.index!;

        try {
          const replacement = await Promise.resolve(
            processor.process(match, context)
          );

          processed =
            processed.slice(0, matchIndex) +
            replacement +
            processed.slice(matchIndex + match[0].length);
        } catch (error) {
          if (error instanceof ConstraintNotMetError) {
            throw error;
          }
          logger.error(`error in processor ${processor.name}:`, error);
        }
      }
    }

    logger.debug(`final processed text: "${processed}"`);
    return processed;
  }

  registerProcessor(processor: BaseProcessor): void {
    this.processors.push(processor);
    logger.debug(`registered custom processor: ${processor.name}`);
  }

  // method to list all registered processors
  getProcessors(): BaseProcessor[] {
    return [...this.processors];
  }
}
