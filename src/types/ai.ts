export interface AIConfig {
  provider: 'local' | 'openai';
  apiUrl: string;
  apiKey?: string;

  // core generation parameters
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;

  // stop sequences
  stopSequences: string[];

  // prompt formatting
  formatting: PromptFormatting;
}

export interface PromptFormatting {
  system: {
    prefix: string;
    suffix: string;
  };
  user: {
    prefix: string;
    suffix: string;
  };
  assistant: {
    prefix: string;
    suffix: string;
  };
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChatContext {
  messages: AIMessage[];
  systemPrompt: string;
}
