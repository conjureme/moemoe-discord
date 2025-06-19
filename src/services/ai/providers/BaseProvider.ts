import { AIConfig, AIResponse, ChatContext } from '../../../types/ai';

export abstract class BaseProvider {
  protected config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  abstract generateResponse(context: ChatContext): Promise<AIResponse>;
  abstract validateConfig(): boolean;
  abstract getName(): string;

  protected getBaseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }
}
