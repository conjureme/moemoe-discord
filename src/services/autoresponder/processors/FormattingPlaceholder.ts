import { BaseProcessor, ProcessorContext } from './Base';

export class FormattingPlaceholderProcessor extends BaseProcessor {
  name = 'formatting-placeholders';
  pattern = /\{(newline)\}/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    const placeholder = match[1].toLowerCase();

    switch (placeholder) {
      case 'newline':
        return '\n';

      default:
        return match[0];
    }
  }
}
