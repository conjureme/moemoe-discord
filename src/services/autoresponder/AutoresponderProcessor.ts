import { Message, EmbedBuilder, TextChannel } from 'discord.js';

import {
  BaseProcessor,
  ProcessorContext,
  ConstraintNotMetError,
} from './processors/Base';

import { UserPlaceholderProcessor } from './processors/UserPlaceholder';
import { ServerPlaceholderProcessor } from './processors/ServerPlaceholder';
import { ChannelPlaceholderProcessor } from './processors/ChannelPlaceholder';
import { EconomyPlaceholderProcessor } from './processors/EconomyPlaceholder';
import {
  AdvancedPlaceholderProcessor,
  RangeVariableProcessor,
} from './processors/AdvancedPlaceholder';
import { ActionPlaceholderProcessor } from './processors/ActionPlaceholder';
import { EconomyActionProcessor } from './processors/EconomyAction';

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
    // order does matter here, actions and ranges should come first
    this.processors = [
      new ActionPlaceholderProcessor(),
      new RangeVariableProcessor(),
      new EconomyActionProcessor(),
      new AdvancedPlaceholderProcessor(),
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
  ): Promise<string | any | null> {
    const context: ProcessorContext = {
      message,
      guild: message.guild || undefined,
      member: message.member || undefined,
      triggerArgs: triggerArgs || message.content.toLowerCase().split(/\s+/),
      services: {
        economy: serviceManager.getEconomyService(),
        ai: serviceManager.getAIService(),
      },
      metadata: {},
      processNested: (text) => this.processText(text, context),
    };

    try {
      const processedText = await this.processText(reply, context);

      // handle metadata actions
      if (context.metadata) {
        if (context.metadata.sendAsDM) {
          try {
            await message.author.send(
              this.buildResponse(processedText, context)
            );
            return null;
          } catch (error) {
            logger.error('failed to send DM:', error);
          }
        }

        if (context.metadata.sendToChannel) {
          try {
            const channel = await message.client.channels.fetch(
              context.metadata.sendToChannel
            );
            if (channel && 'send' in channel) {
              await (channel as TextChannel).send(
                this.buildResponse(processedText, context)
              );
              return null;
            }
          } catch (error) {
            logger.error('failed to send to specified channel:', error);
          }
        }

        // build response based on metadata
        return this.buildResponse(processedText, context);
      }

      return processedText;
    } catch (error) {
      if (error instanceof ConstraintNotMetError) {
        logger.debug(`autoresponder constraint not met: ${error.message}`);
        return null;
      }
      logger.error('error processing autoresponder reply:', error);
      throw error;
    }
  }

  private buildResponse(text: string, context: ProcessorContext): string | any {
    if (!context.metadata) {
      return text;
    }

    // handle embed
    if (context.metadata.useEmbed) {
      const embed = new EmbedBuilder().setColor(0xfaf0e7).setDescription(text);

      return { embeds: [embed] };
    }

    return text;
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
