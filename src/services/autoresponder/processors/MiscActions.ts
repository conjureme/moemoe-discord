import { BaseProcessor, ProcessorContext } from './Base';

import { logger } from '../../../utils/logger';

interface CooldownEntry {
  trigger: string;
  userId: string;
  lastUsed: number;
}

export class MiscActionsProcessor extends BaseProcessor {
  name = 'misc-actions';
  pattern = /\{(cooldown|react|reactreply):([^}]+)\}/gi;

  private static cooldowns: Map<string, CooldownEntry> = new Map();

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const action = match[1].toLowerCase();
    const value = match[2];

    try {
      switch (action) {
        case 'cooldown':
          const seconds = parseInt(value);
          if (isNaN(seconds)) {
            logger.warn(`invalid cooldown value: ${value}`);
            return '';
          }

          const cooldownKey = `${context.message.guildId}:${context.message.channelId}:trigger`;
          const cooldownEntry = MiscActionsProcessor.cooldowns.get(cooldownKey);

          if (cooldownEntry) {
            const timeSinceLastUse = Date.now() - cooldownEntry.lastUsed;
            const cooldownMs = seconds * 1000;

            if (timeSinceLastUse < cooldownMs) {
              const remainingSeconds = Math.ceil(
                (cooldownMs - timeSinceLastUse) / 1000
              );
              throw new Error(
                `cooldown active: ${remainingSeconds} seconds remaining`
              );
            }
          }

          MiscActionsProcessor.cooldowns.set(cooldownKey, {
            trigger: 'autoresponder',
            userId: context.message.author.id,
            lastUsed: Date.now(),
          });

          if (!context.metadata) {
            context.metadata = {};
          }
          context.metadata.cooldownSeconds = seconds;
          break;

        case 'react':
          if (!context.metadata) {
            context.metadata = {};
          }
          if (!context.metadata.reactions) {
            context.metadata.reactions = [];
          }

          const emojiToAdd = value.trim();

          context.metadata.reactions.push({
            target: 'trigger',
            emoji: emojiToAdd,
          });

          // immediately react to the trigger message
          try {
            await context.message.react(emojiToAdd);
            logger.debug(`added reaction ${emojiToAdd} to trigger message`);
          } catch (error) {
            logger.error(`failed to add reaction ${emojiToAdd}:`, error);
          }
          break;

        case 'reactreply':
          if (!context.metadata) {
            context.metadata = {};
          }
          if (!context.metadata.replyReactions) {
            context.metadata.replyReactions = [];
          }

          // stores the emoji for later when the reply is sent
          const replyEmoji = value.trim();
          context.metadata.replyReactions.push(replyEmoji);

          logger.debug(`queued reaction ${replyEmoji} for reply message`);
          break;
      }

      return '';
    } catch (error) {
      logger.error(`error processing misc action ${action}:`, error);
      throw error;
    }
  }
}
