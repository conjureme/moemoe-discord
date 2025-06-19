import { BaseFunction, FunctionContext, FunctionResult } from './BaseFunction';
import { SendDMFunction } from './implementations/SendDM';
import { logger } from '../utils/logger';

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

    let prompt = '\n\n### Available Functions\n';
    prompt +=
      'You can call functions using this format: {{function_name(param1="value1", param2="value2")}}\n\n';

    for (const func of functions) {
      prompt += `- ${func.formatForPrompt()}\n`;
      for (const param of func.definition.parameters) {
        prompt += `  - ${param.name}: ${param.description}\n`;
      }
    }

    prompt += '\nexample: {{send_dm(user_id="123456789", message="hello!")}}\n';
    prompt +=
      'You will see the result as [FUNCTION: result message] in the conversation.\nNever display the function result message.\n';

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
