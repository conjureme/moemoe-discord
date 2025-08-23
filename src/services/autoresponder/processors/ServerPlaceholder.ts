import { BaseProcessor, ProcessorContext } from './Base';

export class ServerPlaceholderProcessor extends BaseProcessor {
  name = 'server-placeholders';
  pattern = /\{(server_name|server_id|server_membercount)\}/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    const placeholder = match[1].toLowerCase();
    const { message } = context;

    switch (placeholder) {
      case 'server_name':
        return message.guild?.name || 'this server';

      case 'server_id':
        return message.guildId || 'unknown';

      case 'server_membercount':
        return message.guild?.memberCount.toString() || '0';

      default:
        return match[0];
    }
  }
}
