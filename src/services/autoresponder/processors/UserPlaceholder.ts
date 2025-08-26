import { BaseProcessor, ProcessorContext } from './Base';

import { logger } from '../../../utils/logger';

export class UserPlaceholderProcessor extends BaseProcessor {
  name = 'user-placeholders';
  pattern =
    /\{(user|username|displayname|user_id|nickname|user_displaycolor|user_joindate|user_boostsince|user_createdate|user_avatar|user_balance)(?::(\d+))?\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const placeholder = match[1].toLowerCase();
    const targetUserId = match[2];
    const { message, services } = context;

    try {
      let targetUser = message.author;
      let targetMember = message.member;

      if (targetUserId) {
        try {
          targetUser = await message.client.users.fetch(targetUserId);
          if (message.guild) {
            targetMember = await message.guild.members
              .fetch(targetUserId)
              .catch(() => null);
          }
        } catch (error) {
          logger.warn(`could not fetch user ${targetUserId}`);
          return match[0];
        }
      }

      switch (placeholder) {
        case 'user':
          return targetUser.toString();

        case 'username':
          return targetUser.username;

        case 'displayname':
          return targetUser.displayName;

        case 'user_id':
          return targetUser.id;

        case 'nickname':
          return targetMember?.nickname || targetUser.username;

        case 'user_displaycolor':
          return targetMember?.displayHexColor || '#000000';

        case 'user_joindate':
          if (targetMember && targetMember.joinedTimestamp) {
            const joinTimestamp = Math.floor(
              targetMember.joinedTimestamp / 1000
            );
            return `<t:${joinTimestamp}:F>`;
          }
          return 'unknown';

        case 'user_boostsince':
          if (targetMember && targetMember.premiumSince) {
            const boostTimestamp = Math.floor(
              targetMember.premiumSinceTimestamp! / 1000
            );
            return `<t:${boostTimestamp}:F>`;
          }
          return 'never';

        case 'user_createdate':
          const createTimestamp = Math.floor(
            targetUser.createdTimestamp / 1000
          );
          return `<t:${createTimestamp}:F>`;

        case 'user_avatar':
          return targetUser.displayAvatarURL({ size: 256 });

        case 'user_balance':
          if (services?.economy && message.guildId && message.guild) {
            const balance = await services.economy.getBalance(
              message.guildId,
              message.guild.name,
              targetUser.id
            );
            return balance.balance.toString();
          }
          return '0';

        default:
          return match[0];
      }
    } catch (error) {
      logger.error(`error processing user placeholder ${placeholder}:`, error);
      return match[0];
    }
  }
}
