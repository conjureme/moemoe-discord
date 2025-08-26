import { BaseProcessor, ProcessorContext } from './Base';

import { logger } from '../../../utils/logger';

export class ServerPlaceholderProcessor extends BaseProcessor {
  name = 'server-placeholders';
  pattern =
    /\{(server_name|server_id|server_membercount|server_randommember|server_owner|server_owner_id|server_createdate|server_icon|date)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const placeholder = match[1].toLowerCase();
    const { message } = context;

    try {
      switch (placeholder) {
        case 'server_name':
          return message.guild?.name || 'this server';

        case 'server_id':
          return message.guildId || 'unknown';

        case 'server_membercount':
          return message.guild?.memberCount.toString() || '0';

        case 'server_randommember':
          if (!message.guild) return '';

          const members = await message.guild.members.fetch();
          const nonBotMembers = members.filter((m) => !m.user.bot);
          const randomMember = nonBotMembers.random();

          return randomMember ? randomMember.toString() : '';

        case 'server_owner':
          if (!message.guild) return '';

          const owner = await message.guild.fetchOwner();
          return owner.toString();

        case 'server_owner_id':
          return message.guild?.ownerId || 'unknown';

        case 'server_createdate':
          if (!message.guild) return 'unknown';

          const createTimestamp = Math.floor(
            message.guild.createdTimestamp / 1000
          );
          return `<t:${createTimestamp}:F>`;

        case 'server_icon':
          if (!message.guild) return '';

          const iconUrl = message.guild.iconURL({ size: 256 });
          return iconUrl || '';

        case 'date':
          const nowTimestamp = Math.floor(Date.now() / 1000);
          return `<t:${nowTimestamp}:F>`;

        default:
          return match[0];
      }
    } catch (error) {
      logger.error(
        `error processing server placeholder ${placeholder}:`,
        error
      );
      return match[0];
    }
  }
}
