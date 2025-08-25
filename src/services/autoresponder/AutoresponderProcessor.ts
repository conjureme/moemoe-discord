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
import { EmbedPlaceholderProcessor } from './processors/EmbedPlaceholder';
import { FormattingPlaceholderProcessor } from './processors/FormattingPlaceholder';

import {
  GenerateResponsePlaceholder,
  GeneratedResponseVariable,
} from './processors/GenerateResponsePlaceholder';

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
      new FormattingPlaceholderProcessor(),
      new GenerateResponsePlaceholder(),
      new EconomyActionProcessor(),
      new EmbedPlaceholderProcessor(),
      new AdvancedPlaceholderProcessor(),
      new GeneratedResponseVariable(),
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
        const response = this.buildResponse(processedText, context);
        const responses: Array<Promise<any>> = [];

        if (
          !context.metadata.sendAsDM &&
          !context.metadata.sendToChannels?.length
        ) {
          return response;
        }

        if (context.metadata.sendAsDM) {
          responses.push(
            message.author.send(response).catch((error) => {
              logger.error('failed to send DM:', error);
            })
          );
        }

        // handle multiple channel sends
        if (
          context.metadata.sendToChannels &&
          context.metadata.sendToChannels.length > 0
        ) {
          for (const channelId of context.metadata.sendToChannels) {
            responses.push(
              message.client.channels
                .fetch(channelId)
                .then((channel) => {
                  if (channel && 'send' in channel) {
                    return (channel as TextChannel).send(response);
                  }
                })
                .catch((error) => {
                  logger.error(
                    `failed to send to channel ${channelId}:`,
                    error
                  );
                })
            );
          }
        }

        // wait for all sends to complete
        await Promise.all(responses);

        return null;
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

    if (context.metadata.embeds && context.metadata.embeds.length > 0) {
      const embeds = [];
      let content = text;

      const sortedEmbeds = [...context.metadata.embeds].sort(
        (a, b) => (a.position || 0) - (b.position || 0)
      );

      for (const embedInfo of sortedEmbeds) {
        const embed = EmbedBuilder.from(embedInfo.data);
        embeds.push(embed);
      }

      content = content.replace(/\{\{EMBED_\d+\}\}/g, '').trim();

      if (content) {
        return { content, embeds };
      } else {
        return { content: null, embeds };
      }
    }

    if (context.metadata.useStoredEmbed && context.metadata.storedEmbedData) {
      const embed = EmbedBuilder.from(context.metadata.storedEmbedData);
      return { content: null, embeds: [embed] };
    }

    if (context.metadata.useEmbed) {
      if (!text || !text.trim()) {
        // if no text content, we should not create an empty embed
        return null;
      }
      const embed = new EmbedBuilder().setColor(0xfaf0e7).setDescription(text);
      return { content: null, embeds: [embed] };
    }

    return text && text.trim() ? text : null;
  }

  private async processText(
    text: string,
    context: ProcessorContext
  ): Promise<string> {
    let processed = text;

    logger.debug(`processing text: "${text}"`);

    // first pass: process placeholders that generate values (range, generate_response)
    const generatorProcessors = [
      'range-variables',
      'generate-response-placeholder',
    ];

    for (const processor of this.processors) {
      if (!generatorProcessors.includes(processor.name)) {
        continue;
      }

      if (!processor.canProcess(processed)) {
        continue;
      }

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

    // second pass: process all other placeholders
    for (const processor of this.processors) {
      if (generatorProcessors.includes(processor.name)) {
        continue;
      }

      if (!processor.canProcess(processed)) {
        continue;
      }

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
