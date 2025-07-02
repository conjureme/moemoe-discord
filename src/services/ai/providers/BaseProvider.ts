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

    return headers;
  }

  // build formatted prompt from context
  protected buildFormattedPrompt(context: ChatContext): string {
    const parts: string[] = [];
    const instruct = this.config.instruct;

    parts.push(
      `${instruct.system_sequence}${context.systemPrompt}${instruct.system_suffix}`
    );

    for (const message of context.messages) {
      if (message.role === 'user') {
        parts.push(
          `${instruct.input_sequence}${message.content}${instruct.input_suffix}`
        );
      } else if (message.role === 'assistant') {
        parts.push(
          `${instruct.output_sequence}${message.content}${instruct.output_suffix}`
        );
      } else if (message.role === 'system') {
        parts.push(
          `${instruct.system_sequence}${message.content}${instruct.system_suffix}`
        );
      }
    }

    // add assistant prefix for generation
    parts.push(instruct.output_sequence);

    return parts.join('');
  }

  protected cleanResponse(response: string): string {
    if (!response) return '';

    let cleaned = response;
    const instruct = this.config.instruct;

    const tokensToRemove = [
      instruct.system_sequence,
      instruct.system_suffix,
      instruct.input_sequence,
      instruct.input_suffix,
      instruct.output_sequence,
      instruct.output_suffix,
    ];

    const uniqueTokens = [...new Set(tokensToRemove)].filter(
      (token) => token && token.length > 0
    );

    for (const token of uniqueTokens) {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escapedToken, 'g'), '');
    }

    if (instruct.stop_sequence) {
      const stopIndex = cleaned.indexOf(instruct.stop_sequence);
      if (stopIndex !== -1) {
        cleaned = cleaned.substring(0, stopIndex);
      }
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
