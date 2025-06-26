import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';

import { logger } from '../../utils/logger';
import { ActivityType, PresenceStatus } from 'discord.js';

export class GetUserActivityFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'get_user_activity',
    description:
      "get a user's current activity status (playing, listening, etc.)",
    parameters: [
      {
        name: 'user_id',
        type: 'string',
        required: true,
        description: 'the ID of the user to check activity for',
      },
    ],
  };

  async execute(
    context: FunctionContext,
    args: Record<string, any>
  ): Promise<FunctionResult> {
    const validationError = this.validateArgs(args);
    if (validationError) {
      return {
        success: false,
        message: validationError,
      };
    }

    const { user_id } = args;

    try {
      const cleanUserId = user_id.replace(/[<@!>]/g, '');

      if (context.guildId) {
        const guild = await context.message.client.guilds
          .fetch(context.guildId)
          .catch(() => null);

        if (!guild) {
          return {
            success: false,
            message: 'could not access guild information',
          };
        }

        const member = await guild.members.fetch(cleanUserId).catch(() => null);

        if (!member) {
          return {
            success: false,
            message: `user not found in this server`,
          };
        }

        const presence = member.presence;

        if (!presence) {
          return {
            success: true,
            message: `${member.user.username} appears to be offline or invisible`,
            data: {
              username: member.user.username,
              status: 'offline',
              activities: [],
            },
          };
        }

        // build activity information
        const activities = presence.activities.map((activity) => {
          const activityInfo: any = {
            type: this.getActivityTypeName(activity.type),
            name: activity.name,
          };

          if (activity.details) activityInfo.details = activity.details;
          if (activity.state) activityInfo.state = activity.state;

          if (activity.name === 'Spotify' && 'syncId' in activity) {
            activityInfo.isSpotify = true;
            if ('assets' in activity && activity.assets) {
              activityInfo.album = activity.assets.largeText;
            }
          }

          if (activity.type === ActivityType.Playing) {
            if ('timestamps' in activity && activity.timestamps?.start) {
              const elapsed = Date.now() - activity.timestamps.start.getTime();
              activityInfo.elapsed = this.formatElapsedTime(elapsed);
            }
          }

          if (activity.type === ActivityType.Custom) {
            activityInfo.emoji = activity.emoji?.name || null;
          }

          return activityInfo;
        });

        // format the response message
        let statusMessage = `${member.user.username} is ${this.getStatusName(presence.status)}`;

        if (activities.length > 0) {
          const activityDescriptions = activities.map((act) => {
            if (act.isSpotify) {
              return `listening to "${act.details}" by ${act.state}${act.album ? ` on ${act.album}` : ''} on Spotify`;
            } else if (act.type === 'playing') {
              let desc = `playing ${act.name}`;
              if (act.details) desc += ` - ${act.details}`;
              if (act.elapsed) desc += ` (for ${act.elapsed})`;
              return desc;
            } else if (act.type === 'streaming') {
              return `streaming ${act.name}${act.details ? ` - ${act.details}` : ''}`;
            } else if (act.type === 'watching') {
              return `watching ${act.name}`;
            } else if (act.type === 'listening') {
              return `listening to ${act.name}`;
            } else if (act.type === 'competing') {
              return `competing in ${act.name}${act.details ? ` - ${act.details}` : ''}`;
            } else if (act.type === 'custom') {
              return `custom status: ${act.emoji ? act.emoji + ' ' : ''}${act.state || act.name}`;
            }
            return `${act.type} ${act.name}`;
          });

          statusMessage += ' and ' + activityDescriptions.join(', ');
        }

        logger.info(
          `retrieved activity for ${member.user.username} (${member.user.id})`
        );

        return {
          success: true,
          message: statusMessage,
          data: {
            username: member.user.username,
            userId: member.user.id,
            status: this.getStatusName(presence.status),
            activities: activities,
          },
        };
      } else {
        return {
          success: false,
          message:
            'cannot check user activity in dm context - this only works in servers',
        };
      }
    } catch (error) {
      logger.error('error in get_user_activity function:', error);
      return {
        success: false,
        message: `failed to get user activity: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  private getActivityTypeName(type: ActivityType): string {
    switch (type) {
      case ActivityType.Playing:
        return 'playing';
      case ActivityType.Streaming:
        return 'streaming';
      case ActivityType.Listening:
        return 'listening';
      case ActivityType.Watching:
        return 'watching';
      case ActivityType.Custom:
        return 'custom';
      case ActivityType.Competing:
        return 'competing';
      default:
        return 'unknown';
    }
  }

  private getStatusName(status: PresenceStatus): string {
    switch (status) {
      case 'online':
        return 'online';
      case 'idle':
        return 'away/idle';
      case 'dnd':
        return 'in do not disturb mode';
      case 'offline':
        return 'offline';
      case 'invisible':
        return 'invisible';
      default:
        return status;
    }
  }

  private formatElapsedTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }
}
