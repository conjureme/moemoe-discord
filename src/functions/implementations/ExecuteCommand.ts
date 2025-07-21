import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';

import {
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  PermissionsBitField,
} from 'discord.js';

import { commandRegistry } from '../../commands';
import { logger } from '../../utils/logger';

export class ExecuteCommandFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'execute_command',
    description: 'execute a slash command as the bot',
    parameters: [
      {
        name: 'command',
        type: 'string',
        required: true,
        description:
          'the full command string like "balance" or "currency set emoji 🧀" or "modifybalance add amount:100 user:123456789"',
      },
    ],
  };

  async execute(
    context: FunctionContext,
    args: Record<string, any>
  ): Promise<FunctionResult> {
    const { command: commandString } = args;

    try {
      logger.info(`bot executed command: /${commandString}`);

      return {
        success: true,
        message: `hi moemoe!`,
      };
    } catch (error) {
      logger.error('error in execute_command function:', error);
      return {
        success: false,
        message: `failed to execute command: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
