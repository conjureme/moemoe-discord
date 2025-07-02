import { BaseProvider } from './BaseProvider';
import { AIResponse, ChatContext, VisionMessage } from '../../../types/ai';
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

  private async extractImages(context: ChatContext): Promise<string[]> {
    const images: string[] = [];

    for (const message of context.messages) {
      if (message.role === 'user') {
        const visionMessage = message as VisionMessage;
        if (visionMessage.images && visionMessage.images.length > 0) {
          for (const imageUrl of visionMessage.images) {
            const base64 = await this.fetchImageAsBase64(imageUrl);
            if (base64) {
              const base64Data = base64.replace(
                /^data:image\/[a-z]+;base64,/,
                ''
              );
              images.push(base64Data);
            }
          }
        }
      }
    }

    logger.debug(`found ${images.length} images in context messages`);
    return images;
  }

  private buildRequestBody(prompt: string, images: string[]): any {
    const preset = this.config.preset;

    const body: any = {
      prompt,
      max_length: preset.genamt,
      temperature: preset.temp,
      stop_sequence: [this.config.instruct.stop_sequence],
    };

    // add images if present
    if (images.length > 0) {
      body.images = images;
    }

    // map preset params to kobold request body
    if (preset.max_length !== undefined) {
      body.max_context_length = preset.max_length;
    }
    if (preset.rep_pen !== undefined) {
      body.rep_pen = preset.rep_pen;
    }
    if (preset.rep_pen_range !== undefined) {
      body.rep_pen_range = preset.rep_pen_range;
    }
    if (preset.sampler_order !== undefined) {
      body.sampler_order = preset.sampler_order;
    }

    if (preset.top_p !== undefined) body.top_p = preset.top_p;
    if (preset.top_k !== undefined) body.top_k = preset.top_k;
    if (preset.top_a !== undefined) body.top_a = preset.top_a;
    if (preset.min_p !== undefined) body.min_p = preset.min_p;
    if (preset.typical_p !== undefined) body.typical = preset.typical_p;
    if (preset.tfs !== undefined) body.tfs = preset.tfs;

    // dynamic temperature
    if (preset.dynatemp) {
      body.dynatemp_range = [preset.min_temp, preset.max_temp];
      body.dynatemp_exponent = preset.dynatemp_exponent;
    }

    if (preset.smoothing_factor !== undefined) {
      body.smoothing_factor = preset.smoothing_factor;
    }

    // mirostat
    if (preset.mirostat_mode !== undefined) {
      body.mirostat = preset.mirostat_mode;
    }
    if (preset.mirostat_tau !== undefined) {
      body.mirostat_tau = preset.mirostat_tau;
    }
    if (preset.mirostat_eta !== undefined) {
      body.mirostat_eta = preset.mirostat_eta;
    }

    // dry sampling
    if (preset.dry_multiplier !== undefined) {
      body.dry_multiplier = preset.dry_multiplier;
    }
    if (preset.dry_base !== undefined) {
      body.dry_base = preset.dry_base;
    }
    if (preset.dry_allowed_length !== undefined) {
      body.dry_allowed_length = preset.dry_allowed_length;
    }
    if (preset.dry_sequence_breakers !== undefined) {
      body.dry_sequence_breakers = preset.dry_sequence_breakers;
    }

    // xtc sampling
    if (preset.xtc_threshold !== undefined) {
      body.xtc_threshold = preset.xtc_threshold;
    }
    if (preset.xtc_probability !== undefined) {
      body.xtc_probability = preset.xtc_probability;
    }

    // other parameters
    if (preset.nsigma !== undefined) body.nsigma = preset.nsigma;

    if (preset.grammar_string !== undefined) {
      body.grammar = preset.grammar_string;
    }

    if (preset.banned_tokens !== undefined) {
      body.banned_tokens = preset.banned_tokens;
    }

    // koboldcpp specific flags
    body.use_default_badwordsids = true;
    body.trim_stop = this.config.context?.trim_sentences || true;
    body.render_special = false;

    if (preset.ignore_eos_token !== undefined) {
      body.bypass_eos = preset.ignore_eos_token;
    }

    if (preset.ban_eos_token !== undefined) {
      body.ban_eos_token = preset.ban_eos_token;
    }

    body.temperature_last = preset.temperature_last;

    return body;
  }
}
