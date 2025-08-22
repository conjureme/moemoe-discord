import { BaseFunction, FunctionContext, FunctionResult } from './BaseFunction';
import { logger } from '../utils/logger';

import { SendDMFunction } from './implementations/SendDM';
import { UpdateBioFunction } from './implementations/UpdateBio';
import { UpdateStatusFunction } from './implementations/UpdateStatus';
import { ExecuteCommandFunction } from './implementations/ExecuteCommand';
import { SendChannelMessageFunction } from './implementations/SendChannelMessage';
import { GetUserActivityFunction } from './implementations/GetUserActivity';
import { JoinCallFunction } from './implementations/JoinCall';
import { LeaveCallFunction } from './implementations/LeaveCall';
import { SingSongFunction } from './implementations/SingSong';

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export class FunctionRegistry {
  private functions: Map<string, BaseFunction> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new SendDMFunction());
    // this.register(new UpdateBioFunction());
    this.register(new UpdateStatusFunction());
    this.register(new ExecuteCommandFunction());
    this.register(new SendChannelMessageFunction());
    this.register(new GetUserActivityFunction());
    this.register(new JoinCallFunction());
    this.register(new LeaveCallFunction());
    this.register(new SingSongFunction());
  }

  register(func: BaseFunction): void {
    this.functions.set(func.definition.name, func);
    logger.debug(`registered function: ${func.definition.name}`);
  }

  getFunction(name: string): BaseFunction | undefined {
    return this.functions.get(name);
  }

  getAllFunctions(): BaseFunction[] {
    return Array.from(this.functions.values());
  }

  generatePromptSection(): string {
    const functions = this.getAllFunctions();
    if (functions.length === 0) return '';

    let prompt = '\n### Function Calling Rules\n';
    prompt +=
      'You have the ability to run various functions to perform tasks, but you should only ever call them when a user explicitly asks you to. Take into consideration chat context and why a user is asking you to run one before you do.\n\nThe result will appear upon successful or unsuccessful call.\n';

    prompt +=
      'You can run functions with the following syntax:\n{{functionName(param1="value1" param2="value2")}}\n';

    prompt += 'Available functions:\n';

    for (const func of functions) {
      prompt += `- ${func.formatForPrompt()}\n`;
      for (const param of func.definition.parameters) {
        prompt += `  - ${param.name}: ${param.description}\n`;
      }
    }

    return prompt;
  }

  parseFunctionCalls(text: string): FunctionCall[] {
    const calls: FunctionCall[] = [];

    const pattern = /\{\{(\w+)\((.*?)\)\}\}/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const functionName = match[1];
      const argsString = match[2];

      const args: Record<string, any> = {};

      const argPattern = /(\w+)="([^"]*)"/g;
      let argMatch;

      while ((argMatch = argPattern.exec(argsString)) !== null) {
        const argName = argMatch[1];
        const argValue = argMatch[2];

        const func = this.getFunction(functionName);
        if (func) {
          const paramDef = func.definition.parameters.find(
            (p) => p.name === argName
          );
          if (paramDef) {
            if (paramDef.type === 'number') {
              args[argName] = Number(argValue);
            } else if (paramDef.type === 'boolean') {
              args[argName] = argValue.toLowerCase() === 'true';
            } else {
              args[argName] = argValue;
            }
          }
        }
      }

      calls.push({ name: functionName, args });
    }

    return calls;
  }

  async executeFunction(
    name: string,
    context: FunctionContext,
    args: Record<string, any>
  ): Promise<FunctionResult> {
    const func = this.getFunction(name);

    if (!func) {
      return {
        success: false,
        message: `function '${name}' not found`,
      };
    }

    try {
      logger.debug(`executing function ${name} with args:`, args);
      return await func.execute(context, args);
    } catch (error) {
      logger.error(`error executing function ${name}:`, error);
      return {
        success: false,
        message: `function execution failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  removeFunctionCalls(text: string): string {
    return text.replace(/\{\{(\w+)\((.*?)\)\}\}/g, '').trim();
  }
}
