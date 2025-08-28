import { Events, GuildMember } from 'discord.js';
import { Event } from '../types/discord';
import { serviceManager } from '../services/ServiceManager';
import { AutoresponderProcessor } from '../services/autoresponder/AutoresponderProcessor';

import { logger } from '../utils/logger';

const guildMemberUpdate: Event = {
  name: Events.GuildMemberUpdate,
  once: false,

  async execute(oldMember: GuildMember, newMember: GuildMember) {
    try {
      const wasBoostingBefore = oldMember.premiumSince !== null;
      const isBoostingNow = newMember.premiumSince !== null;

      if (!wasBoostingBefore && isBoostingNow) {
        logger.info(
          `${newMember.user.username} just boosted ${newMember.guild.name}!`
        );

        const boostService = serviceManager.getBoostService();
        const boostMessage = boostService.getBoostMessage(newMember.guild.id);

        if (!boostMessage || !boostMessage.enabled) {
          logger.debug(
            `no boost message configured or disabled for ${newMember.guild.name}`
          );
          return;
        }

        const mockMessage = {
          author: newMember.user,
          member: newMember,
          guild: newMember.guild,
          guildId: newMember.guild.id,
          channelId: newMember.guild.systemChannelId || '',
          channel: newMember.guild.systemChannel,
          client: newMember.client,
          content: '',
        } as any;

        const processor = AutoresponderProcessor.getInstance();

        try {
          const processedMessage = await processor.processReply(
            boostMessage.message,
            mockMessage,
            []
          );

          if (processedMessage === null) {
            logger.debug(
              `boost message constraint not met for ${newMember.user.username} in ${newMember.guild.name}`
            );
            return;
          }

          if (
            newMember.guild.systemChannel &&
            typeof processedMessage === 'string'
          ) {
            await newMember.guild.systemChannel.send(processedMessage);
          } else if (
            newMember.guild.systemChannel &&
            processedMessage &&
            'embeds' in processedMessage
          ) {
            await newMember.guild.systemChannel.send(processedMessage);
          }

          logger.info(
            `sent boost message for ${newMember.user.username} in ${newMember.guild.name}`
          );
        } catch (error) {
          logger.error(
            `error processing boost message for ${newMember.user.username}:`,
            error
          );
        }
      }

      if (wasBoostingBefore && !isBoostingNow) {
        logger.info(
          `${newMember.user.username} stopped boosting ${newMember.guild.name}`
        );
      }
    } catch (error) {
      logger.error('error in guildMemberUpdate event:', error);
    }
  },
};

export default guildMemberUpdate;
