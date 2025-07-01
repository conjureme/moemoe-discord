import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';
import { logger } from '../../utils/logger';
import { commandRegistry } from '../../commands';

import {
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  CommandInteractionOptionResolver,
  GuildMember,
  PermissionsBitField,
} from 'discord.js';

export class ExecuteCommandFunction extends BaseFunction {
  private _definition: FunctionDefinition | null = null;

  get definition(): FunctionDefinition {
    // generate definition dynamically to include current commands
    if (!this._definition) {
      this._definition = this.generateDefinition();
    }
    return this._definition;
  }

  private generateDefinition(): FunctionDefinition {
    // load commands to get current list
    const commands = commandRegistry.getAllCommands();

    const commandDescriptions: string[] = [];

    for (const [name, command] of commands) {
      let description = `${name}`;

      if (command.data && 'options' in command.data) {
        const subcommands = command.data.options.filter(
          (opt: any) => opt.type === ApplicationCommandOptionType.Subcommand
        );

        if (subcommands.length > 0) {
          description += ` (subcommands: ${subcommands.map((sub: any) => sub.name).join(', ')})`;
        }
      }

      if (command.data.description) {
        description += ` - ${command.data.description}`;
      }

      commandDescriptions.push(description);
    }

    const availableCommands =
      commandDescriptions.length > 0
        ? commandDescriptions.join(', ')
        : 'none available';

    return {
      name: 'execute_command',
      description: `execute a slash command as the bot`,
      parameters: [
        {
          name: 'command',
          type: 'string',
          required: true,
          description: `the command name to execute. Available: ${availableCommands}`,
        },
        {
          name: 'subcommand',
          type: 'string',
          required: false,
          description:
            'the subcommand to execute if applicable (e.g., "clear", "stats")',
        },
        {
          name: 'options',
          type: 'string',
          required: false,
          description: 'JSON string of command options/arguments',
        },
      ],
    };
  }

  formatForPrompt(): string {
    this._definition = this.generateDefinition();

    const params = this.definition.parameters
      .map((p) => `${p.name}: ${p.type}${p.required ? '' : '?'}`)
      .join(', ');

    return `${this.definition.name}(${params}) - ${this.definition.description}`;
  }

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

    const { command: commandName, subcommand, options } = args;

    try {
      // get the command from registry
      const command = commandRegistry.getCommand(commandName);

      if (!command) {
        return {
          success: false,
          message: `command "${commandName}" not found. available commands: ${commandRegistry.getCommandNames().join(', ')}`,
        };
      }

      // parse options if provided
      let parsedOptions: Record<string, any> = {};
      if (options) {
        try {
          parsedOptions = JSON.parse(options);
        } catch (e) {
          return {
            success: false,
            message: `invalid JSON in options parameter: ${e}`,
          };
        }
      }

      // create a mock interaction that captures the response
      let capturedResponse: string | undefined;
      let capturedEmbed: any | undefined;
      let ephemeralFlag = false;

      const mockInteraction = {
        commandName,
        options: {
          getSubcommand: () => subcommand || null,
          getString: (name: string) => parsedOptions[name]?.toString() || null,
          getInteger: (name: string) =>
            parsedOptions[name] ? parseInt(parsedOptions[name]) : null,
          getBoolean: (name: string) =>
            parsedOptions[name] === true || parsedOptions[name] === 'true',
          getNumber: (name: string) =>
            parsedOptions[name] ? parseFloat(parsedOptions[name]) : null,
          data: parsedOptions,
        } as Partial<CommandInteractionOptionResolver>,

        reply: async (options: any) => {
          if (typeof options === 'string') {
            capturedResponse = options;
          } else {
            capturedResponse = options.content;
            capturedEmbed = options.embeds?.[0];
            ephemeralFlag = options.ephemeral || false;

            // handle flags array (used in memory command)
            if (
              Array.isArray(options.flags) &&
              options.flags.includes('Ephemeral')
            ) {
              ephemeralFlag = true;
            }
          }
          return Promise.resolve({} as any);
        },

        editReply: async (options: any) => {
          if (typeof options === 'string') {
            capturedResponse = options;
          } else {
            capturedResponse = options.content;
            capturedEmbed = options.embeds?.[0];
          }
          return Promise.resolve({} as any);
        },

        deferReply: async () => Promise.resolve({} as any),
        followUp: async (options: any) => {
          if (typeof options === 'string') {
            capturedResponse =
              (capturedResponse ? capturedResponse + '\n' : '') + options;
          } else {
            capturedResponse =
              (capturedResponse ? capturedResponse + '\n' : '') +
              options.content;
          }
          return Promise.resolve({} as any);
        },

        // required properties
        channelId: context.channelId,
        guildId: context.guildId,
        user: {
          id: context.message.client.user!.id,
          username: context.message.client.user!.username,
          tag: context.message.client.user!.tag,
        },
        member: context.guildId
          ? ({
              permissions: new PermissionsBitField(PermissionsBitField.All),
              user: {
                id: context.message.client.user!.id,
              },
            } as Partial<GuildMember>)
          : null,
        channel: context.message.channel,
        client: context.message.client,
        replied: false,
        deferred: false,
      } as unknown as ChatInputCommandInteraction;

      await command.execute(mockInteraction);

      let resultMessage = `executed /${commandName}`;
      if (subcommand) {
        resultMessage += ` ${subcommand}`;
      }

      const responseData: any = {
        command: commandName,
        subcommand: subcommand || null,
        response: capturedResponse || null,
        ephemeral: ephemeralFlag,
      };

      if (capturedEmbed) {
        responseData.embed = {
          title: capturedEmbed.title || null,
          description: capturedEmbed.description || null,
          fields: capturedEmbed.fields || [],
          color: capturedEmbed.color || null,
        };

        // include embed info for model context
        if (capturedEmbed.fields && capturedEmbed.fields.length > 0) {
          resultMessage += '\nEmbed data:';
          for (const field of capturedEmbed.fields) {
            resultMessage += `\n- ${field.name}: ${field.value}`;
          }
        }
      }

      // add response content to result message
      if (capturedResponse) {
        resultMessage += `\nResponse: ${capturedResponse}`;
      }

      logger.info(
        `bot executed own command: /${commandName}${subcommand ? ` ${subcommand}` : ''}`
      );

      return {
        success: true,
        message: resultMessage,
        data: responseData,
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
