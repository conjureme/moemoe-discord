import { BaseProcessor, ProcessorContext } from './Base';
import { logger } from '../../../utils/logger';

export class AdvancedPlaceholderProcessor extends BaseProcessor {
  name = 'advanced-placeholders';
  pattern = /\[(range|response|\$\d+(?:\+|\-\d+)?)\]/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    const placeholder = match[1];

    try {
      if (placeholder === 'range') {
        if (context.metadata?.rangeValue !== undefined) {
          return context.metadata.rangeValue.toString();
        }

        // fallback to default 1-100 if no range was set
        return Math.floor(Math.random() * 100 + 1).toString();
      }

      if (placeholder === 'response') {
        if (context.metadata?.generatedResponse !== undefined) {
          return context.metadata.generatedResponse;
        }
        return '';
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
    const minStr = match[1];
    const maxStr = match[2];

    const min = parseInt(minStr);
    const max = parseInt(maxStr);

    if (isNaN(min) || isNaN(max)) {
      logger.warn(`invalid range values in ${match[0]}: values must be integers`);
      return match[0];
    }

    if (min < 0 || max < 0) {
      logger.warn(`invalid range values in ${match[0]}: cannot be negative`);
      return match[0];
    }

    if (min > max) {
      logger.warn(
        `invalid range in ${match[0]}: minimum (${min}) cannot exceed maximum (${max})`
      );
      return match[0];
    }

    const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;

    if (!context.metadata) {
      context.metadata = {};
    }
    context.metadata.rangeValue = randomValue;

    return '';
  }
}
