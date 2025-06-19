export interface BotConfig {
  name: string;
  systemPrompt: {
    template: string;
    persona: string;
    rules: string;
    examples: string;
    context: string;
  };
  conversationPriming?: {
    enabled: boolean;
    exchanges: ConversationExchange[];
  };
}

export interface ConversationExchange {
  userName: string;
  userId?: string;
  userMessage: string;
  assistantResponse: string;
}

export interface MemoryConfig {
  maxMessagesPerChannel: number;
  maxTokensInContext: number;
}
