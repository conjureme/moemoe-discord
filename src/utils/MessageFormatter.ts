import { Message } from 'discord.js';
import { MemoryConfig } from '../types/config';

export class MessageFormatter {
  static formatUserMessage(
    message: Message,
    content: string,
    config: MemoryConfig
  ): string {
    const format = config.userMessageFormat || 'default';

    switch (format) {
      case 'default':
        // [username|userID]: message
        return `[${message.author.username}|${message.author.id}]: ${content}`;

      case 'nickname':
        // [nickname|userID]: message (falls back to username if no nickname)
        const nickname = message.member?.nickname || message.author.username;
        return `[${nickname}|${message.author.id}]: ${content}`;

      case 'username_only':
        // username: message
        return `${message.author.username}: ${content}`;

      case 'id_only':
        // [userID]: message
        return `[${message.author.id}]: ${content}`;

      case 'custom':
        if (!config.customUserFormat) {
          // fallback to default if no custom format provided
          return `[${message.author.username}|${message.author.id}]: ${content}`;
        }

        // replace placeholders in custom format
        return config.customUserFormat
          .replace('{{username}}', message.author.username)
          .replace(
            '{{nickname}}',
            message.member?.nickname || message.author.username
          )
          .replace('{{id}}', message.author.id)
          .replace('{{discriminator}}', message.author.discriminator || '0')
          .replace('{{mention}}', `<@${message.author.id}>`)
          .replace('{{message}}', content);

      default:
        return `[${message.author.username}|${message.author.id}]: ${content}`;
    }
  }

  // alternative format examples for documentation
  static getFormatExamples(): Record<string, string> {
    return {
      default: '[username|123456789012345678]: Hello world',
      nickname: '[CoolNickname|123456789012345678]: Hello world',
      username_only: 'username: Hello world',
      id_only: '[123456789012345678]: Hello world',
      custom_example1: '{{nickname}} ({{id}}): {{message}}',
      custom_example2: '<{{username}}>: {{message}}',
      custom_example3: '{{mention}} says: {{message}}',
      custom_example4: '[{{nickname}} | @{{username}}]: {{message}}',
    };
  }
}
