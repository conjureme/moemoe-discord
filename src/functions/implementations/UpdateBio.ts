import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';
import { logger } from '../../utils/logger';

export class UpdateBioFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'update_bio',
    description: "update the bot's discord bio/about me section",
    parameters: [
      {
        name: 'bio',
        type: 'string',
        required: true,
        description: 'the new bio text (maximum 190 characters)',
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

    const { bio } = args;

    try {
      const client = context.message.client;

      if (!client.user) {
        return {
          success: false,
          message: 'bot user not available',
        };
      }

      if (bio.length > 190) {
        return {
          success: false,
          message: `bio is too long (${bio.length} characters). maximum is 190 characters`,
        };
      }

      await client.application.edit({ description: bio });

      logger.info(`updated bot bio to: ${bio}`);

      return {
        success: true,
        message: 'updated bio successfully',
        data: {
          bio: bio,
          length: bio.length,
        },
      };
    } catch (error) {
      logger.error('error in update_bio function:', error);
      return {
        success: false,
        message: `failed to update bio: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
