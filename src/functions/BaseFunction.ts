import { Message } from 'discord.js';

export interface FunctionContext {
  message: Message;
  channelId: string;
  guildId: string | null;
  authorId: string;
  authorName: string;
}

export interface FunctionResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface FunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: FunctionParameter[];
}

export abstract class BaseFunction {
  abstract definition: FunctionDefinition;

  abstract execute(
    context: FunctionContext,
    args: Record<string, any>
  ): Promise<FunctionResult>;

  validateArgs(args: Record<string, any>): string | null {
    for (const param of this.definition.parameters) {
      if (param.required && !(param.name in args)) {
        return `missing required parameter: ${param.name}`;
      }

      if (param.name in args && args[param.name] !== undefined) {
        const argType = typeof args[param.name];
        if (argType !== param.type) {
          return `parameter ${param.name} must be of type ${param.type}, got ${argType}`;
        }
      }
    }
    return null;
  }

  formatForPrompt(): string {
    const params = this.definition.parameters
      .map((p) => `${p.name}: ${p.type}${p.required ? '' : '?'}`)
      .join(', ');

    return `${this.definition.name}(${params}) - ${this.definition.description}`;
  }
}
