import { Events, GuildMember } from 'discord.js';
import { Event } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';
import { AutoresponderProcessor } from '../services/autoresponder/AutoresponderProcessor';

import { logger } from '../utils/logger';

const guildMemberAdd: Event = {
  name: Events.GuildMemberAdd,
  once: false,

  async execute(member: GuildMember) {
    try {
      const greetService = serviceManager.getGreetService();
      const greeting = greetService.getGreeting(member.guild.id);

      if (!greeting || !greeting.enabled) {
        return;
      }

      const mockMessage = {
        author: member.user,
        member: member,
        guild: member.guild,
        guildId: member.guild.id,
        channelId: member.guild.systemChannelId || '',
        channel: member.guild.systemChannel,
        client: member.client,
        content: '',
      } as any;

      const processor = AutoresponderProcessor.getInstance();

      try {
        const processedMessage = await processor.processReply(
          greeting.message,
          mockMessage,
          []
        );

        if (processedMessage === null) {
          logger.debug(
            `greeting constraint not met for ${member.user.username} in ${member.guild.name}`
          );
          return;
        }

        // we'll send to default system channel if no sendto specified
        if (
          member.guild.systemChannel &&
          typeof processedMessage === 'string'
        ) {
          await member.guild.systemChannel.send(processedMessage);
        } else if (
          member.guild.systemChannel &&
          processedMessage &&
          'embeds' in processedMessage
        ) {
          await member.guild.systemChannel.send(processedMessage);
        }

        logger.info(
          `sent greeting for ${member.user.username} in ${member.guild.name}`
        );
      } catch (error) {
        logger.error(
          `error processing greeting for ${member.user.username}:`,
          error
        );
      }
    } catch (error) {
      logger.error('error in guildMemberAdd event:', error);
    }
  },
};

export default guildMemberAdd;
