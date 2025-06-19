import { ConfigService } from '../config/ConfigService';
import { MemoryMessage } from '../memory/types';
import { AIMessage } from '../../types/ai';

export class PromptBuilder {
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  buildSystemPrompt(): string {
    const botConfig = this.configService.getBotConfig();
    const template = botConfig.systemPrompt.template;

    // replace template variables
    let prompt = template;
    prompt = prompt.replace(/{{bot_name}}/g, botConfig.name);
    prompt = prompt.replace(
      /{{persona_description}}/g,
      botConfig.systemPrompt.persona
    );
    prompt = prompt.replace(
      /{{messaging_rules}}/g,
      botConfig.systemPrompt.rules
    );
    prompt = prompt.replace(
      /{{dialogue_examples}}/g,
      botConfig.systemPrompt.examples
    );
    prompt = prompt.replace(
      /{{context_information}}/g,
      botConfig.systemPrompt.context
    );

    return prompt;
  }

  buildMessages(memoryMessages: MemoryMessage[]): AIMessage[] {
    const botConfig = this.configService.getBotConfig();
    const messages: AIMessage[] = [];

    for (const msg of memoryMessages) {
      // check if this is a bot message
      const isBot = msg.authorId === msg.botId || msg.isBot;

      if (isBot) {
        // bot messages are assistant messages
        messages.push({
          role: 'assistant',
          content: msg.content,
          name: msg.author,
        });
      } else {
        // user message with name and id
        messages.push({
          role: 'user',
          content: `[${msg.author}|${msg.authorId}]: ${msg.content}`,
          name: msg.author,
        });
      }
    }

    return messages;
  }
}
