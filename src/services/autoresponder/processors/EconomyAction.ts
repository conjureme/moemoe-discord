import { BaseProcessor, ProcessorContext, ConstraintNotMetError } from './Base';

import { logger } from '../../../utils/logger';

export class EconomyActionProcessor extends BaseProcessor {
  name = 'economy-actions';
  pattern = /\{modifybal:([\+\-=])(\[range\]|\d+)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const operation = match[1];
    const amountStr = match[2];

    if (
      !context.services.economy ||
      !context.message.guildId ||
      !context.guild
    ) {
      logger.warn('economy service not available for modifybal action');
      return '';
    }

    try {
      let amount: number;

      if (amountStr === '[range]') {
        amount =
          context.metadata?.rangeValue ?? Math.floor(Math.random() * 100 + 1);
      } else {
        amount = parseInt(amountStr);
        if (isNaN(amount)) {
          logger.error(`invalid amount for modifybal: ${amountStr}`);
          return '';
        }
      }

      const economyService = context.services.economy;
      const userId = context.message.author.id;

      if (operation === '=') {
        await economyService.setBalance(
          context.message.guildId,
          context.guild.name,
          userId,
          amount
        );
        logger.info(
          `set balance to ${amount} for ${context.message.author.username}`
        );
      } else {
        const modifiedAmount = operation === '+' ? amount : -amount;
        await economyService.addBalance(
          context.message.guildId,
          context.guild.name,
          userId,
          modifiedAmount,
          'autoresponder balance modification'
        );
        logger.info(
          `modified balance by ${modifiedAmount} for ${context.message.author.username}`
        );
      }

      if (!context.metadata) {
        context.metadata = {};
      }
      context.metadata.modifiedBalance = amount;
      context.metadata.balanceOperation = operation;

      return '';
    } catch (error) {
      logger.error('error processing modifybal action:', error);
      return '';
    }
  }
}
