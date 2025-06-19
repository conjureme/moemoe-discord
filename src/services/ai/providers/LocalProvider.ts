import { BaseProvider } from './BaseProvider';
import { AIResponse, ChatContext } from '../../../types/ai';
import { logger } from '../../../utils/logger';

interface LocalAIRequest {
  prompt: string;
  max_tokens: number;
  temperature: number;
  top_p: number;
  top_k: number;
  repetition_penalty: number;
  stop: string[];
  stream: boolean;
}

interface LocalAIResponse {
  choices?: Array<{ text?: string }>;
  text?: string;
  content?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class LocalProvider extends BaseProvider {
  getName(): string {
    return 'Local AI';
  }

  validateConfig(): boolean {
    if (!this.config.apiUrl) {
      logger.error('local ai provider requires apiUrl');
      return false;
    }

    if (!this.config.maxTokens || this.config.maxTokens <= 0) {
      logger.error('invalid maxTokens configuration');
      return false;
    }

    return true;
  }

  async generateResponse(context: ChatContext): Promise<AIResponse> {
    if (!this.validateConfig()) {
      throw new Error('invalid configuration for local ai provider');
    }

    const prompt = this.buildPrompt(context);

    const requestBody: LocalAIRequest = {
      prompt,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      top_k: this.config.topK,
      repetition_penalty: this.config.repetitionPenalty,
      stop: this.config.stopSequences,
      stream: false,
    };

    try {
      logger.debug(`sending request to ${this.config.apiUrl}/v1/completions`);

      logger.debug('=== PROMPT BEING SENT TO BACKEND ===');
      logger.debug(prompt);
      logger.debug('=== END PROMPT ===');

      const response = await fetch(`${this.config.apiUrl}/v1/completions`, {
        method: 'POST',
        headers: this.getBaseHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `api request failed: ${response.status} ${response.statusText}`
        );
      }

      const data: LocalAIResponse = await response.json();

      let generatedText = '';
      if (data.choices && data.choices.length > 0 && data.choices[0].text) {
        generatedText = data.choices[0].text;
      } else if (data.text) {
        generatedText = data.text;
      } else if (data.content) {
        generatedText = data.content;
      }

      const cleanedResponse = this.cleanResponse(generatedText);

      return {
        content: cleanedResponse,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('local ai provider error:', error);
      throw error;
    }
  }

  private buildPrompt(context: ChatContext): string {
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
      }
    }

    parts.push(fmt.assistant.prefix);

    return parts.join('');
  }

  private cleanResponse(response: string): string {
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
}
