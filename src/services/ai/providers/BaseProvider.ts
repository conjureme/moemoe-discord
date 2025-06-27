import { AIConfig, AIResponse, ChatContext } from '../../../types/ai';

import { logger } from '../../../utils/logger';

export abstract class BaseProvider {
  protected config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  abstract generateResponse(context: ChatContext): Promise<AIResponse>;
  abstract validateConfig(): boolean;
  abstract getName(): string;
  abstract getSupportedParameters(): string[];

  protected getBaseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  // build formatted prompt from context
  protected buildFormattedPrompt(context: ChatContext): string {
    const parts: string[] = [];
    const fmt = this.config.formatting;

    parts.push(
      `${fmt.system.prefix}${context.systemPrompt}${fmt.system.suffix}`
    );

    for (const message of context.messages) {
      if (message.role === 'user') {
        parts.push(`${fmt.user.prefix}${message.content}${fmt.user.suffix}`);
      } else if (message.role === 'assistant') {
        parts.push(
          `${fmt.assistant.prefix}${message.content}${fmt.assistant.suffix}`
        );
      } else if (message.role === 'system') {
        parts.push(
          `${fmt.system.prefix}${message.content}${fmt.system.suffix}`
        );
      }
    }

    parts.push(fmt.assistant.prefix);

    return parts.join('');
  }

  protected cleanResponse(response: string): string {
    if (!response) return '';

    let cleaned = response;
    const fmt = this.config.formatting;

    const tokensToRemove = [
      fmt.system.prefix,
      fmt.system.suffix,
      fmt.user.prefix,
      fmt.user.suffix,
      fmt.assistant.prefix,
      fmt.assistant.suffix,
    ];

    const uniqueTokens = [...new Set(tokensToRemove)].filter(
      (token) => token && token.length > 0
    );

    for (const token of uniqueTokens) {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escapedToken, 'g'), '');
    }

    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned;
  }

  // common image fetching utility
  protected async fetchImageAsBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        logger.error(`failed to fetch image: ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      logger.error('error fetching image:', error);
      return null;
    }
  }
}
