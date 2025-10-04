import { ConfigService } from '../config/ConfigService';
import { MemoryMessage } from '../memory/types';
import { AIMessage } from '../../types/ai';
import { FunctionRegistry } from '../../functions/FunctionRegistry';

import { logger } from '../../utils/logger';

export class PromptBuilder {
  private configService: ConfigService;
  private functionRegistry: FunctionRegistry;

  constructor(
    configService: ConfigService,
    functionRegistry: FunctionRegistry
  ) {
    this.configService = configService;
    this.functionRegistry = functionRegistry;
  }

  buildSystemPrompt(): string {
    const botConfig = this.configService.getBotConfig();
    const aiConfig = this.configService.getAIConfig();

    // build from story string template
    let storyString = aiConfig.context.story_string;

    const replacements: Record<string, string> = {
      system: botConfig.data.system_prompt || aiConfig.sysprompt.content,
      description: botConfig.data.description,
      personality: botConfig.data.personality,
      scenario: botConfig.data.scenario,
      mesExamples: this.formatExamplesForStoryString(
        botConfig.data.mes_example
      ),
      wiBefore: '',
      wiAfter: '',
      persona: '',
    };

    // process conditionals
    for (const [key, value] of Object.entries(replacements)) {
      const conditionalRegex = new RegExp(`{{#if ${key}}}(.*?){{/if}}`, 'gs');
      storyString = storyString.replace(conditionalRegex, (match, content) => {
        return value ? content.replace(`{{${key}}}`, value) : '';
      });
    }

    storyString = storyString.replace(/{{char}}/g, botConfig.name);
    storyString = storyString.replace(/{{user}}/g, 'User');
    storyString = storyString.replace(/\n*{{trim}}\n*/g, '');

    const functionsEnabled = process.env.ENABLE_FUNCTIONS == 'true';
    const functionPrompt = functionsEnabled
      ? this.functionRegistry.generatePromptSection()
      : null;

    if (functionPrompt) {
      const closingSuffix = [
        '[/SYSTEM_PROMPT]',
        '</system>',
        '<|im_end|>',
        '<|end|>',
        '</s>',
        '[/INST]',
      ];

      let injected = false;

      for (const suffix of closingSuffix) {
        if (storyString.includes(suffix)) {
          const lastIndex = storyString.lastIndexOf(suffix);

          // inject function info before the closing suffic
          storyString =
            storyString.slice(0, lastIndex) +
            '\n' +
            functionPrompt +
            '\n' +
            storyString.slice(lastIndex);

          injected = true;
          logger.debug(`injected function prompt before ${suffix}`);
          break;
        }
      }

      if (!injected && aiConfig.instruct.system_suffix) {
        const systemSuffix = aiConfig.instruct.system_suffix;

        if (storyString.endsWith(systemSuffix)) {
          const withoutSuffix = storyString.slice(0, -systemSuffix.length);
          storyString =
            withoutSuffix + '\n' + functionPrompt + '\n' + systemSuffix;
          injected = true;
        }
      }

      // fallback: just append at the end
      if (!injected) {
        storyString += '\n' + functionPrompt;
        logger.debug(
          'appended function prompt at end (no closing pattern found)'
        );
      }
    }

    return storyString;
  }

  buildMessages(memoryMessages: MemoryMessage[]): AIMessage[] {
    const botConfig = this.configService.getBotConfig();
    const aiConfig = this.configService.getAIConfig();
    const messages: AIMessage[] = [];

    // // handle first message if no history
    // if (memoryMessages.length === 0 && botConfig.data.first_mes) {
    //   messages.push({
    //     role: 'assistant',
    //     content: botConfig.data.first_mes,
    //     name: botConfig.name,
    //   });
    //   return messages;
    // }

    if (botConfig.data.mes_example && !aiConfig.instruct.skip_examples) {
      const examples = this.parseExampleMessages(botConfig.data.mes_example);
      messages.push(...examples);
    }

    if (botConfig.data.first_mes) {
      const prefixMessage = `${botConfig.name}: ${botConfig.data.first_mes}`;
      messages.push({
        role: 'assistant',
        content: prefixMessage,
        name: botConfig.name,
      });
    }

    // process conversation history
    for (const msg of memoryMessages) {
      const isBot = msg.isBot || msg.authorId === msg.botId;
      const isUser =
        msg.is_user !== undefined ? msg.is_user : !isBot && !msg.isSystem;
      const isSystem = msg.isSystem;

      if (isSystem) {
        // system messages (function results, etc)
        messages.push({
          role: 'user',
          content: msg.content,
          name: 'System',
        });
      } else if (isBot) {
        const prefixMessage = `${botConfig.name}: ${msg.content}`;
        messages.push({
          role: 'assistant',
          content: prefixMessage,
          name: botConfig.name,
        });
      } else if (isUser) {
        const userMessage: AIMessage = {
          role: 'user',
          content: msg.content,
          name: msg.author,
        };

        messages.push(userMessage);
      }
    }

    if (botConfig.data.post_history_instructions) {
      messages.push({
        role: 'system',
        content: botConfig.data.post_history_instructions,
        name: 'System',
      });
    }

    return messages;
  }

  private formatExamplesForStoryString(examples: string | undefined): string {
    if (!examples) return '';

    const botConfig = this.configService.getBotConfig();
    const aiConfig = this.configService.getAIConfig();
    const separator = aiConfig.context.example_separator || '<START>';

    const conversations = examples.split(separator).filter((s) => s.trim());
    const formatted: string[] = [];

    for (const conversation of conversations) {
      const lines = conversation
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const processedLines: string[] = [];

      for (const line of lines) {
        let processedLine = line;

        processedLine = processedLine.replace(/{{char}}/g, botConfig.name);
        processedLine = processedLine.replace(/{{user}}/g, 'User');

        if (processedLine.includes('{{user}}:')) {
          processedLine = processedLine.replace('{{user}}:', 'User:');
        } else if (processedLine.includes('{{char}}:')) {
          processedLine = processedLine.replace(
            '{{char}}:',
            `${botConfig.name}:`
          );
        }

        processedLines.push(processedLine);
      }

      formatted.push(processedLines.join('\n'));
    }

    // join conversations with newlines instead of separator tags
    return formatted.join('\n');
  }

  private parseExampleMessages(examples: string): AIMessage[] {
    const messages: AIMessage[] = [];
    const botConfig = this.configService.getBotConfig();
    const aiConfig = this.configService.getAIConfig();

    const separator = aiConfig.context.example_separator || '<START>';
    const conversations = examples.split(separator).filter((s) => s.trim());

    for (const conversation of conversations) {
      const lines = conversation
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      for (const line of lines) {
        if (line.includes('{{user}}:')) {
          let content = line.replace('{{user}}:', '').trim();

          if (aiConfig.instruct.names_behavior === 'always') {
            content = `User: ${content}`;
          }

          messages.push({
            role: 'user',
            content: content,
            name: 'User',
          });
        } else if (line.includes('{{char}}:')) {
          let content = line.replace('{{char}}:', '').trim();
          content = content.replace(/{{char}}/g, botConfig.name);

          if (aiConfig.instruct.names_behavior === 'always') {
            content = `${botConfig.name}: ${content}`;
          }

          messages.push({
            role: 'assistant',
            content: content,
            name: botConfig.name,
          });
        }
      }
    }

    return messages;
  }
}
