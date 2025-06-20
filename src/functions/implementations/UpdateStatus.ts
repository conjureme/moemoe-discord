import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';
import { logger } from '../../utils/logger';
import { ActivityType, PresenceStatusData } from 'discord.js';

export class UpdateStatusFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'update_status',
    description:
      "update the bot's discord status (playing, watching, listening, etc.) and online/idle/dnd presence",
    parameters: [
      {
        name: 'activity_type',
        type: 'string',
        required: false,
        description:
          'type of activity: "playing", "watching", "listening", "streaming", "competing", or "custom". leave empty to clear activity',
      },
      {
        name: 'activity_text',
        type: 'string',
        required: false,
        description:
          'the text to display for the activity (e.g., "Minecraft" for playing)',
      },
      {
        name: 'status',
        type: 'string',
        required: false,
        description:
          'online status: "online", "idle", "dnd" (do not disturb), or "invisible". defaults to "online"',
      },
      {
        name: 'streaming_url',
        type: 'string',
        required: false,
        description:
          'twitch or youtube url (only used when activity_type is "streaming")',
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

    const {
      activity_type,
      activity_text,
      status = 'online',
      streaming_url,
    } = args;

    try {
      const client = context.message.client;

      if (!client.user) {
        return {
          success: false,
          message: 'bot user not available',
        };
      }

      const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
      if (status && !validStatuses.includes(status)) {
        return {
          success: false,
          message: `invalid status. must be one of: ${validStatuses.join(', ')}`,
        };
      }

      const activityTypeMap: Record<string, ActivityType> = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening,
        streaming: ActivityType.Streaming,
        competing: ActivityType.Competing,
        custom: ActivityType.Custom,
      };

      if (!activity_type && !activity_text) {
        client.user.setPresence({
          activities: [],
          status: status as PresenceStatusData,
        });

        logger.info(`cleared bot activity and set status to ${status}`);

        return {
          success: true,
          message: `cleared activity and set status to ${status}`,
          data: {
            activity: null,
            status: status,
          },
        };
      }

      if (activity_type && !(activity_type.toLowerCase() in activityTypeMap)) {
        return {
          success: false,
          message: `invalid activity type. must be one of: ${Object.keys(activityTypeMap).join(', ')}`,
        };
      }

      if (!activity_text) {
        return {
          success: false,
          message: 'activity_text is required when setting an activity',
        };
      }

      const activityOptions: any = {
        name: activity_text,
        type: activityTypeMap[activity_type.toLowerCase()],
      };

      if (activity_type?.toLowerCase() === 'streaming' && streaming_url) {
        if (
          !streaming_url.includes('twitch.tv') &&
          !streaming_url.includes('youtube.com')
        ) {
          return {
            success: false,
            message: 'streaming_url must be a twitch.tv or youtube.com url',
          };
        }
        activityOptions.url = streaming_url;
      }

      client.user.setPresence({
        activities: [activityOptions],
        status: status as PresenceStatusData,
      });

      logger.info(
        `updated bot status - ${activity_type}: ${activity_text}, status: ${status}`
      );

      return {
        success: true,
        message: `updated status to ${status} with activity: ${activity_type} ${activity_text}`,
        data: {
          activity: {
            type: activity_type,
            text: activity_text,
            url: streaming_url || null,
          },
          status: status,
        },
      };
    } catch (error) {
      logger.error('error in update_status function:', error);
      return {
        success: false,
        message: `failed to update status: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
