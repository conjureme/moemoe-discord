export interface BotConfig {
  name: string;
  systemPrompt: {
    template: string;
    persona: string;
    rules: string;
    examples: string;
    context: string;
  };
}

export interface MemoryConfig {
  maxMessagesPerChannel: number;
  maxTokensInContext: number;
}
