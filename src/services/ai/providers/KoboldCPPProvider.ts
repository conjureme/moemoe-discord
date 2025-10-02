import { BaseProvider } from './BaseProvider';
import { AIResponse, ChatContext } from '../../../types/ai';
import { logger } from '../../../utils/logger';

interface KoboldResponse {
  results?: Array<{ text?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class KoboldCPPProvider extends BaseProvider {
  getName(): string {
    return 'KoboldCPP';
  }

  getSupportedParameters(): string[] {
    return [
      'max_context_length',
      'max_length',
      'prompt',
      'rep_pen',
      'rep_pen_range',
      'sampler_order',
      'sampler_seed',
      'stop_sequence',
      'temperature',
      'tfs',
      'top_a',
      'top_k',
      'top_p',
      'min_p',
      'typical',
      'use_default_badwordsids',
      'dynatemp_range',
      'smoothing_factor',
      'dynatemp_exponent',
      'mirostat',
      'mirostat_tau',
      'mirostat_eta',
      'genkey',
      'grammar',
      'grammar_retain_state',
      'memory',
      'images',
      'trim_stop',
      'render_special',
      'bypass_eos',
      'banned_tokens',
      'logit_bias',
      'dry_multiplier',
      'dry_base',
      'dry_allowed_length',
      'dry_sequence_breakers',
      'xtc_threshold',
      'xtc_probability',
      'nsigma',
      'logprobs',
      'replace_instruct_placeholders',
    ];
  }

  validateConfig(): boolean {
    if (!this.config.apiUrl) {
      logger.error('koboldcpp provider requires apiUrl');
      return false;
    }

    return true;
  }

  async generateResponse(context: ChatContext): Promise<AIResponse> {
    if (!this.validateConfig()) {
      throw new Error('invalid configuration for koboldcpp provider');
    }

    const prompt = this.buildFormattedPrompt(context);
    const images = await this.extractImages(context);

    const requestBody = this.buildRequestBody(prompt, images);

    try {
      logger.debug(`sending request to ${this.config.apiUrl}/api/v1/generate`);
      // logger.debug(JSON.stringify(requestBody));
      logger.debug(prompt);

      const response = await fetch(`${this.config.apiUrl}/api/v1/generate`, {
        method: 'POST',
        headers: this.getBaseHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `api request failed: ${response.status} ${response.statusText}`
        );
      }

      const data: KoboldResponse = await response.json();

      let generatedText = '';
      if (
        data.results &&
        Array.isArray(data.results) &&
        data.results.length > 0
      ) {
        generatedText = data.results[0].text || '';
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
      logger.error('koboldcpp provider error:', error);
      throw error;
    }
  }

  private buildRequestBody(prompt: string, images: string[]): any {
    const preset = this.config.preset;

    const parameterMap: Record<string, string> = {
      max_length: 'max_context_length',
      rep_pen: 'rep_pen',
      rep_pen_range: 'rep_pen_range',
      sampler_order: 'sampler_order',
      top_p: 'top_p',
      top_k: 'top_k',
      top_a: 'top_a',
      min_p: 'min_p',
      typical_p: 'typical',
      tfs: 'tfs',
      smoothing_factor: 'smoothing_factor',
      dry_multiplier: 'dry_multiplier',
      dry_base: 'dry_base',
      dry_allowed_length: 'dry_allowed_length',
      dry_sequence_breakers: 'dry_sequence_breakers',
      xtc_threshold: 'xtc_threshold',
      xtc_probability: 'xtc_probability',
      nsigma: 'nsigma',
      grammar_string: 'grammar',
      banned_tokens: 'banned_tokens',
      ignore_eos_token: 'bypass_eos',
      ban_eos_token: 'ban_eos_token',
      temperature_last: 'temperature_last',
    };

    const body: any = {
      prompt,
      max_length: preset.genamt,
      temperature: preset.temp,
      stop_sequence: [this.config.instruct.stop_sequence],
      use_default_badwordsids: true,
      trim_stop: this.config.context?.trim_sentences || true,
      render_special: false,
    };

    if (images.length > 0) {
      body.images = images;
    }

    for (const [presetKey, bodyKey] of Object.entries(parameterMap)) {
      if ((preset as any)[presetKey] !== undefined) {
        body[bodyKey] = (preset as any)[presetKey];
      }
    }

    if (preset.dynatemp) {
      body.dynatemp_range = [preset.min_temp, preset.max_temp];
      body.dynatemp_exponent = preset.dynatemp_exponent;
    }

    if (preset.mirostat_mode !== undefined) {
      body.mirostat = preset.mirostat_mode;
    }
    if (preset.mirostat_tau !== undefined) {
      body.mirostat_tau = preset.mirostat_tau;
    }
    if (preset.mirostat_eta !== undefined) {
      body.mirostat_eta = preset.mirostat_eta;
    }

    return body;
  }
}
