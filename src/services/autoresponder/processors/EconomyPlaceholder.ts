import { BaseProcessor, ProcessorContext } from './Base';
import { logger } from '../../../utils/logger';

export class EconomyPlaceholderProcessor extends BaseProcessor {
  name = 'economy-placeholders';
  pattern = /\{(user_balance|server_currency)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const placeholder = match[1].toLowerCase();
    const { message, services } = context;

    if (!services.economy || !message.guildId || !message.guild) {
      return match[0]; // return unchanged if economy not available
    }

    try {
      switch (placeholder) {
        case 'user_balance': {
          const userBalance = await services.economy.getBalance(
            message.guildId,
            message.guild.name,
            message.author.id
          );
          return userBalance.balance.toString();
        }

        case 'server_currency': {
          const guildEconomy = services.economy.getGuildEconomy(
            message.guildId
          );
          const currency = guildEconomy?.currency || {
            emoji: '🧀',
            name: 'curds',
          };
          return `${currency.emoji} ${currency.name}`;
        }

        default:
          return match[0];
      }
    } catch (error) {
      logger.error(
        `error processing economy placeholder ${placeholder}:`,
        error
      );
      return match[0];
    }
  }
}
