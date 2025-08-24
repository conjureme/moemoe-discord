import { BaseProcessor, ProcessorContext } from './Base';
import { logger } from '../../../utils/logger';

export class EconomyActionProcessor extends BaseProcessor {
  name = 'economy-actions';
  pattern = /\{addbal:(\[range\]|\d+)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const amountStr = match[1];

    if (
      !context.services.economy ||
      !context.message.guildId ||
      !context.guild
    ) {
      logger.warn('economy service not available for addbal action');
      return '';
    }

    try {
      let amount: number;

      if (amountStr === '[range]') {
        // look for the computed range value in the processed text
        // this assumes [range] was already processed
        const rangePattern = /\{range:(\d+)-(\d+)\}/i;
        const rangeMatch = context.message.content.match(rangePattern);

        if (rangeMatch) {
          const min = parseInt(rangeMatch[1]);
          const max = parseInt(rangeMatch[2]);
          amount = Math.floor(Math.random() * (max - min + 1)) + min;
        } else {
          amount = Math.floor(Math.random() * 100 + 1);
        }
      } else {
        amount = parseInt(amountStr);

        if (isNaN(amount)) {
          logger.error(`invalid amount for addbal: ${amountStr}`);
          return '';
        }
      }

      await context.services.economy.addBalance(
        context.message.guildId,
        context.guild.name,
        context.message.author.id,
        amount,
        'autoresponder reward'
      );

      logger.info(
        `added ${amount} to ${context.message.author.username} via autoresponder`
      );

      if (!context.metadata) {
        context.metadata = {};
      }
      context.metadata.addedBalance = amount;

      return '';
    } catch (error) {
      logger.error('error processing addbal action:', error);
      return '';
    }
  }
}
