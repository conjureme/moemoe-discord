import { BaseFunction, FunctionContext, FunctionResult } from './BaseFunction';
import { logger } from '../utils/logger';

import { SendDMFunction } from './implementations/SendDM';
import { UpdateBioFunction } from './implementations/UpdateBio';
import { UpdateStatusFunction } from './implementations/UpdateStatus';
import { ExecuteCommandFunction } from './implementations/ExecuteCommand';
import { SendChannelMessageFunction } from './implementations/SendChannelMessage';

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
    this.register(new UpdateBioFunction());
    this.register(new UpdateStatusFunction());
    this.register(new ExecuteCommandFunction());
    this.register(new SendChannelMessageFunction());
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

    let prompt = '\n\n### Function Calling Rules\n';
    prompt +=
      'CRITICAL: You have access to functions, but you must ONLY use them when:\n';
    prompt +=
      '1. The user EXPLICITLY asks you to perform the action (e.g., "send a dm to...", "update your status to...", "change your bio")\n';
    prompt += '2. The user gives clear permission or instructions to do so\n';
    prompt +=
      '3. NEVER use functions just because they were mentioned in conversation\n\n';

    prompt += 'DO NOT use functions when:\n';
    prompt += '- Users are just chatting or making conversation\n';
    prompt +=
      '- Someone mentions DMs, status, or bio without asking you to change them\n';
    prompt += '- You think it would be funny or relevant to the conversation\n';
    prompt +=
      '- Users are talking about these features without directing you to use them\n\n';

    prompt += 'Format: {{function_name(param1="value1", param2="value2")}}\n\n';
    prompt += 'Available functions:\n';

    for (const func of functions) {
      prompt += `- ${func.formatForPrompt()}\n`;
      for (const param of func.definition.parameters) {
        prompt += `  - ${param.name}: ${param.description}\n`;
      }
    }

    prompt += '\nexample: {{send_dm(user_id="123456789", message="hello!")}}\n';
    prompt +=
      'You will see the result as a system message.\nNever display the function result message to the user.\n';

    prompt += '\nExamples of when to use functions:\n';
    prompt +=
      '✓ User: "send a dm to <@860733331532808213> saying hello" → USE send_dm function\n';
    prompt +=
      '✓ User: "update your status to playing minecraft" → USE update_status function\n';
    prompt +=
      '✓ User: "change your bio to something cool" → USE update_bio function\n\n';

    prompt += 'Examples of when NOT to use functions:\n';
    prompt += '✗ User: "i got a weird dm yesterday" → DO NOT use send_dm\n';
    prompt += '✗ User: "your status is funny" → DO NOT use update_status\n';
    prompt += '✗ User: "bios are important" → DO NOT use update_bio\n';
    prompt += '✗ User: "tyler loves getting dms" → DO NOT use send_dm\n\n';

    prompt +=
      'Remember: Only call functions when given a direct command or explicit permission. When in doubt, do NOT use functions.\n';

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
