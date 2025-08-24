import { BaseProcessor, ProcessorContext } from './Base';
import { logger } from '../../../utils/logger';

export class AdvancedPlaceholderProcessor extends BaseProcessor {
  name = 'advanced-placeholders';
  pattern = /\[(range|\$\d+(?:\+|\-\d+)?)\]/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    const placeholder = match[1];

    try {
      if (placeholder === 'range') {
        // look for a preceding {range:X-Y} in the text to get bounds
        const rangePattern = /\{range:(\d+)-(\d+)\}/i;
        const rangeMatch = context.message.content.match(rangePattern);

        if (rangeMatch) {
          const min = parseInt(rangeMatch[1]);
          const max = parseInt(rangeMatch[2]);
          const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
          return randomValue.toString();
        }

        return Math.floor(Math.random() * 100 + 1).toString();
      }

      if (placeholder.startsWith('$')) {
        const argPattern = /\$(\d+)(?:(\+)|(?:\-(\d+)))?/;
        const argMatch = placeholder.match(argPattern);

        if (!argMatch) return match[0];

        const startIndex = parseInt(argMatch[1]);
        const isPlus = argMatch[2] === '+';
        const endIndex = argMatch[3] ? parseInt(argMatch[3]) : undefined;

        const { triggerArgs } = context;

        if (!triggerArgs || triggerArgs.length === 0) {
          logger.debug(`no trigger args available for ${placeholder}`);
          return '';
        }

        if (!isPlus && endIndex === undefined) {
          return triggerArgs[startIndex] || '';
        }

        if (isPlus) {
          return triggerArgs.slice(startIndex).join(' ');
        }

        if (endIndex !== undefined) {
          return triggerArgs.slice(startIndex, endIndex + 1).join(' ');
        }
      }

      return match[0];
    } catch (error) {
      logger.error(
        `error processing advanced placeholder ${placeholder}:`,
        error
      );
      return match[0];
    }
  }
}

export class RangeVariableProcessor extends BaseProcessor {
  name = 'range-variables';

  pattern = /\{range:(\d+)-(\d+)\}/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    return '';
  }
}
