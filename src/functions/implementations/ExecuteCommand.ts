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
    const validationError = this.validateArgs(args);
    if (validationError) {
      return {
        success: false,
        message: validationError,
      };
    }

    const { command: commandString } = args;

    try {
      const parsed = this.parseCommandString(commandString);
      if (!parsed) {
        return {
          success: false,
          message: `invalid command format. use format like: "balance" or "currency set emoji 🧀" or "balance user:123456789"`,
        };
      }

      const { commandName, subcommandGroup, subcommand, options } = parsed;

      const command = commandRegistry.getCommand(commandName);
      if (!command) {
        return {
          success: false,
          message: `command "${commandName}" not found. available commands: ${commandRegistry.getCommandNames().join(', ')}`,
        };
      }

      // pre-fetch users mentioned in options
      const fetchedUsers: Record<string, any> = {};
      for (const [key, value] of Object.entries(options)) {
        if (key === 'user' || key.endsWith('user')) {
          const userId = value.toString().replace(/[<@!>]/g, '');
          try {
            let user = await context.message.client.users.fetch(userId);

            if (context.guildId) {
              const guild = context.message.client.guilds.cache.get(
                context.guildId
              );
              if (guild) {
                const member = await guild.members
                  .fetch(userId)
                  .catch(() => null);
                if (member) {
                  user = member.user;
                }
              }
            }

            fetchedUsers[key] = user;
            logger.debug(`fetched user ${user.username} for option ${key}`);
          } catch (error) {
            logger.warn(
              `failed to fetch user ${userId} for option ${key}:`,
              error
            );
          }
        }
      }

      // create a mock interaction that captures the response
      let capturedResponse: string | undefined;
      let capturedEmbed: any | undefined;

      const mockInteraction = {
        commandName,
        commandId: 'mock-command-id',
        options: this.createMockOptions(
          subcommandGroup,
          subcommand,
          options,
          fetchedUsers
        ),

        reply: async (response: any) => {
          if (typeof response === 'string') {
            capturedResponse = response;
          } else {
            capturedResponse = response.content;
            if (response.embeds && response.embeds.length > 0) {
              capturedEmbed = response.embeds[0];
            }
          }
          return Promise.resolve({} as any);
        },

        editReply: async (response: any) => {
          if (typeof response === 'string') {
            capturedResponse = response;
          } else {
            capturedResponse = response.content;
            if (response.embeds && response.embeds.length > 0) {
              capturedEmbed = response.embeds[0];
            }
          }
          return Promise.resolve({} as any);
        },

        deferReply: async () => Promise.resolve({} as any),
        followUp: async (response: any) => {
          const newContent =
            typeof response === 'string' ? response : response.content;
          capturedResponse = capturedResponse
            ? `${capturedResponse}\n${newContent}`
            : newContent;
          return Promise.resolve({} as any);
        },

        channelId: context.channelId,
        guildId: context.guildId,
        guild: context.guildId ? await this.getMockGuild(context) : null,
        user: {
          id: context.message.client.user!.id,
          username: context.message.client.user!.username,
          tag: context.message.client.user!.tag,
          displayAvatarURL: () =>
            context.message.client.user!.displayAvatarURL(),
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

      // build the result message
      let resultMessage = `executed /${commandName}`;
      if (subcommandGroup) {
        resultMessage += ` ${subcommandGroup}`;
      }
      if (subcommand) {
        resultMessage += ` ${subcommand}`;
      }

      if (capturedResponse) {
        resultMessage += `\nresponse: ${capturedResponse}`;
      }

      // add embed data in a readable format
      if (capturedEmbed) {
        const embedData = capturedEmbed.data || capturedEmbed;

        resultMessage += '\n\nembed content:';

        if (embedData.author?.name) {
          resultMessage += `\nauthor: ${embedData.author.name}`;
        }

        if (embedData.title) {
          resultMessage += `\ntitle: ${embedData.title}`;
        }

        if (embedData.description) {
          resultMessage += `\ndescription: ${embedData.description}`;
        }

        if (embedData.fields && embedData.fields.length > 0) {
          resultMessage += '\nfields:';
          for (const field of embedData.fields) {
            resultMessage += `\n- ${field.name}: ${field.value}`;
          }
        }

        if (embedData.footer?.text) {
          resultMessage += `\nfooter: ${embedData.footer.text}`;
        }
      }

      logger.info(`bot executed command: /${commandString}`);

      return {
        success: true,
        message: resultMessage,
      };
    } catch (error) {
      logger.error('error in execute_command function:', error);
      return {
        success: false,
        message: `failed to execute command: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  private async getMockGuild(context: FunctionContext): Promise<any> {
    try {
      if (context.guildId && context.message.client.guilds.cache) {
        const guild = context.message.client.guilds.cache.get(context.guildId);
        if (guild) {
          return guild;
        }
      }

      // fallback to mock guild with required methods
      return {
        id: context.guildId,
        name: 'Current Server',
        iconURL: (options?: any) => null,
        icon: null,
      };
    } catch {
      return {
        id: context.guildId,
        name: 'Current Server',
        iconURL: (options?: any) => null,
        icon: null,
      };
    }
  }

  private parseCommandString(commandString: string): {
    commandName: string;
    subcommandGroup?: string;
    subcommand?: string;
    options: Record<string, any>;
  } | null {
    try {
      const parts = commandString.trim().split(/\s+/);
      if (parts.length === 0) return null;

      const commandName = parts[0];
      let subcommandGroup: string | undefined;
      let subcommand: string | undefined;
      const options: Record<string, any> = {};

      let currentIndex = 1;

      // check if next parts are subcommands or options
      while (currentIndex < parts.length) {
        const part = parts[currentIndex];

        if (part.includes(':')) {
          break;
        }

        if (!subcommand) {
          subcommand = part;
        } else if (!subcommandGroup) {
          subcommandGroup = subcommand;
          subcommand = part;
        }

        currentIndex++;
      }

      // parse options (format: key:value)
      for (let i = currentIndex; i < parts.length; i++) {
        const part = parts[i];

        if (part.includes(':')) {
          const colonIndex = part.indexOf(':');
          const key = part.substring(0, colonIndex);
          let value = part.substring(colonIndex + 1);

          // handle multi-word values that might be split
          if (value.startsWith('"') || value.startsWith("'")) {
            const quote = value[0];
            value = value.substring(1);

            while (i + 1 < parts.length && !value.endsWith(quote)) {
              i++;
              value += ' ' + parts[i];
            }

            if (value.endsWith(quote)) {
              value = value.substring(0, value.length - 1);
            }
          } else if (i + 1 < parts.length && !parts[i + 1].includes(':')) {
            const nextPart = parts[i + 1];
            if (nextPart.startsWith('<') || value.startsWith('<')) {
              while (i + 1 < parts.length && !value.endsWith('>')) {
                i++;
                value += ' ' + parts[i];
              }
            }
          }

          // convert values to appropriate types
          if (/^\d+$/.test(value)) {
            const isDiscordId =
              key === 'user' ||
              key === 'channel' ||
              key.endsWith('_id') ||
              key.endsWith('user') ||
              key.endsWith('channel') ||
              key === 'role' ||
              key === 'message' ||
              key === 'guild';

            if (isDiscordId) {
              options[key] = value;
            } else {
              options[key] = parseInt(value);
            }
          } else if (value === 'true' || value === 'false') {
            options[key] = value === 'true';
          } else {
            options[key] = value;
          }
        }
      }

      return { commandName, subcommandGroup, subcommand, options };
    } catch (error) {
      logger.error('error parsing command string:', error);
      return null;
    }
  }

  private createMockOptions(
    subcommandGroup?: string,
    subcommand?: string,
    options: Record<string, any> = {},
    fetchedUsers: Record<string, any> = {}
  ): Partial<CommandInteractionOptionResolver> {
    return {
      getSubcommandGroup: (required = true) => {
        if (!subcommandGroup && required) {
          throw new Error('no subcommand group');
        }
        return subcommandGroup || null;
      },
      getSubcommand: (required = true) => {
        if (!subcommand && required) {
          throw new Error('no subcommand');
        }
        return subcommand || null;
      },
      getString: (name: string, required = false) => {
        const value = options[name];
        if (!value && required) {
          throw new Error(`missing required string option: ${name}`);
        }
        return value?.toString() || null;
      },
      getInteger: (name: string, required = false) => {
        const value = options[name];
        if (value === undefined && required) {
          throw new Error(`missing required integer option: ${name}`);
        }
        return typeof value === 'number' ? value : null;
      },
      getBoolean: (name: string, required = false) => {
        const value = options[name];
        if (value === undefined && required) {
          throw new Error(`missing required boolean option: ${name}`);
        }
        return typeof value === 'boolean' ? value : null;
      },
      getUser: (name: string, required = false) => {
        if (fetchedUsers[name]) {
          return fetchedUsers[name];
        }

        const value = options[name];
        if (!value && required) {
          throw new Error(`missing required user option: ${name}`);
        }

        if (!value) {
          return null;
        }

        const userId = value.toString().replace(/[<@!>]/g, '');
        logger.warn(`no fetched user data for ${userId} - returning null`);

        if (required) {
          throw new Error(`could not fetch user with id ${userId}`);
        }

        return null;
      },
      getChannel: (name: string, required = false) => {
        const value = options[name];
        if (!value && required) {
          throw new Error(`missing required channel option: ${name}`);
        }
        if (value) {
          const channelId = value.toString().replace(/[<#>]/g, '');
          return {
            id: channelId,
            name: `channel-${channelId.slice(-4)}`,
          } as any;
        }
        return null;
      },
      getNumber: (name: string, required = false) => {
        const value = options[name];
        if (value === undefined && required) {
          throw new Error(`missing required number option: ${name}`);
        }
        return typeof value === 'number' ? value : null;
      },
      data: options,
    } as Partial<CommandInteractionOptionResolver>;
  }

  formatForPrompt(): string {
    return `execute_command(command: string) - execute a slash command

examples:
- execute_command(command="ping") - simple command
- execute_command(command="balance") - check your own balance  
- execute_command(command="balance user:123456789") - check another user's balance
- execute_command(command="modifybalance add amount:100 user:123456789") - add balance to user

format: command_name [subcommand_group] [subcommand] [option1:value1] [option2:value2]
- options with spaces should use quotes: name:"my cool name"
- user mentions: user:<@123456789> or user:123456789
- emojis: emoji:<:name:123456789>`;
  }
}
