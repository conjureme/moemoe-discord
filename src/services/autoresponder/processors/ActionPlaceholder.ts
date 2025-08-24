import { BaseProcessor, ProcessorContext, ConstraintNotMetError } from './Base';
import { TextChannel } from 'discord.js';
import { logger } from '../../../utils/logger';

export class ActionPlaceholderProcessor extends BaseProcessor {
  name = 'action-placeholders';
  pattern = /\{(dm|embed(?!:[^}]+)|sendto:[^}]+)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const action = match[1];

    try {
      if (action === 'dm') {
        // store flag in context for main processor to handle
        if (!context.metadata) {
          context.metadata = {};
        }
        context.metadata.sendAsDM = true;
        return '';
      }

      if (action === 'embed') {
        // only handling {embed} here, not named!
        if (!context.metadata) {
          context.metadata = {};
        }
        context.metadata.useEmbed = true;
        return '';
      }

      if (action.startsWith('sendto:')) {
        const channelId = action.substring(7);

        if (!context.metadata) {
          context.metadata = {};
        }
        context.metadata.sendToChannel = channelId;

        try {
          const channel =
            await context.message.client.channels.fetch(channelId);

          if (!channel || !('send' in channel)) {
            logger.error(`invalid channel for sendto: ${channelId}`);
            throw new ConstraintNotMetError(
              `channel ${channelId} not found or not a text channel`
            );
          }

          const textChannel = channel as TextChannel;

          if (context.guild && textChannel.guildId !== context.guild.id) {
            logger.error(`sendto channel ${channelId} not in same guild`);
            throw new ConstraintNotMetError(`channel not in this server`);
          }

          const botMember = textChannel.guild.members.cache.get(
            context.message.client.user!.id
          );

          if (!botMember) {
            throw new ConstraintNotMetError(
              `bot not in guild for channel ${channelId}`
            );
          }

          const permissions = textChannel.permissionsFor(botMember);
          if (!permissions?.has('SendMessages')) {
            logger.error(
              `bot lacks permission to send in channel ${channelId}`
            );
            throw new ConstraintNotMetError(
              `no permission to send in that channel`
            );
          }
        } catch (error) {
          if (error instanceof ConstraintNotMetError) {
            throw error;
          }
          logger.error(`error validating sendto channel:`, error);
          throw new ConstraintNotMetError(`failed to validate channel`);
        }

        return '';
      }

      return match[0];
    } catch (error) {
      if (error instanceof ConstraintNotMetError) {
        throw error;
      }
      logger.error(`error processing action placeholder ${action}:`, error);
      return match[0];
    }
  }
}
