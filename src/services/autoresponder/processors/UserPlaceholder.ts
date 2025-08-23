import { BaseProcessor, ProcessorContext } from './Base';

export class UserPlaceholderProcessor extends BaseProcessor {
  name = 'user-placeholders';
  pattern =
    /\{(user|username|user_id|user_nick|user_displaycolor|user_joindate|user_boostsince|user_createdate)\}/gi;

  process(match: RegExpMatchArray, context: ProcessorContext): string {
    const placeholder = match[1].toLowerCase();
    const { message } = context;

    switch (placeholder) {
      case 'user':
        return message.author.toString();

      case 'username':
        return message.author.username;

      case 'user_id':
        return message.author.id;

      case 'user_nick':
        return message.member?.nickname || message.author.username;

      case 'user_displaycolor':
        return message.member?.displayHexColor || '#000000';

      case 'user_joindate':
        if (message.member && message.member.joinedTimestamp) {
          const joinTimestamp = Math.floor(
            message.member.joinedTimestamp / 1000
          );
          return `<t:${joinTimestamp}:F>`;
        }
        return 'unknown';

      case 'user_boostsince':
        if (message.member && message.member.premiumSince) {
          const boostTimestamp = Math.floor(
            message.member.premiumSinceTimestamp! / 1000
          );
          return `<t:${boostTimestamp}:F>`;
        }
        return 'never';

      case 'user_createdate':
        const createTimestamp = Math.floor(
          message.author.createdTimestamp / 1000
        );
        return `<t:${createTimestamp}:F>`;

      default:
        return match[0]; // return unchanged if not recognized
    }
  }
}
