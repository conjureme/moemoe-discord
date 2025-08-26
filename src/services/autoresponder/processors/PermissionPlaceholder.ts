import { BaseProcessor, ProcessorContext, ConstraintNotMetError } from './Base';
import { PermissionFlagsBits } from 'discord.js';

import { logger } from '../../../utils/logger';

export class PermissionPlaceholderProcessor extends BaseProcessor {
  name = 'permission-constraints';
  pattern =
    /\{(requireuser|requireperm|requirechannel|requirerole):([^}]+)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    const constraint = match[1].toLowerCase();
    const value = match[2];

    try {
      switch (constraint) {
        case 'requireuser':
          if (context.message.author.id !== value) {
            throw new ConstraintNotMetError(
              `user constraint not met: requires user ${value}`
            );
          }
          break;

        case 'requireperm':
          if (!context.member) {
            throw new ConstraintNotMetError('no member context available');
          }

          const permissionName = value.toUpperCase().replace(/_/g, '');
          const permission =
            PermissionFlagsBits[
              permissionName as keyof typeof PermissionFlagsBits
            ];

          if (!permission) {
            logger.warn(`invalid permission name: ${value}`);
            throw new ConstraintNotMetError(`invalid permission: ${value}`);
          }

          if (!context.member.permissions.has(permission)) {
            throw new ConstraintNotMetError(
              `permission constraint not met: requires ${value}`
            );
          }
          break;

        case 'requirechannel':
          if (context.message.channelId !== value) {
            throw new ConstraintNotMetError(
              `channel constraint not met: requires channel ${value}`
            );
          }
          break;

        case 'requirerole':
          if (!context.member) {
            throw new ConstraintNotMetError('no member context available');
          }

          const hasRole = context.member.roles.cache.has(value);
          if (!hasRole) {
            throw new ConstraintNotMetError(
              `role constraint not met: requires role ${value}`
            );
          }
          break;

        default:
          return match[0];
      }

      return ''; // constraint met, remove from output
    } catch (error) {
      if (error instanceof ConstraintNotMetError) {
        throw error;
      }
      logger.error(
        `error processing permission constraint ${constraint}:`,
        error
      );
      throw new ConstraintNotMetError('constraint evaluation failed');
    }
  }
}
