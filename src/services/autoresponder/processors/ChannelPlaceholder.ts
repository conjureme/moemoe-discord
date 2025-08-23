import { BaseProcessor, ProcessorContext } from './Base';

export class ChannelPlaceholderProcessor extends BaseProcessor {
  name = 'channel-placeholders';
  pattern = /\{(channel|channel_id)\}/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    const placeholder = match[1].toLowerCase();
    const { message } = context;

    switch (placeholder) {
      case 'channel':
        return message.channel.toString();

      case 'channel_id':
        return message.channelId;

      default:
        return match[0];
    }
  }
}
