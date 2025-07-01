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

    if (!this.config.maxTokens || this.config.maxTokens <= 0) {
      logger.error('invalid maxTokens configuration');
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
      logger.debug(JSON.stringify(requestBody));

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
    const body: any = {
      prompt,
      max_length: this.config.maxTokens,
      temperature: this.config.temperature,
      stop_sequence: this.config.stopSequences,
    };

    // add images if present
    if (images.length > 0) {
      body.images = images;
    }

    // map config params to kobold request body
    if (this.config.contextLength !== undefined) {
      body.max_context_length = this.config.contextLength;
    }
    if (this.config.repetitionPenalty !== undefined) {
      body.rep_pen = this.config.repetitionPenalty;
    }
    if (this.config.repPenRange !== undefined) {
      body.rep_pen_range = this.config.repPenRange;
    }
    if (this.config.samplerOrder !== undefined) {
      body.sampler_order = this.config.samplerOrder;
    }

    if (this.config.topP !== undefined) body.top_p = this.config.topP;
    if (this.config.topK !== undefined) body.top_k = this.config.topK;
    if (this.config.topA !== undefined) body.top_a = this.config.topA;
    if (this.config.minP !== undefined) body.min_p = this.config.minP;
    if (this.config.typicalP !== undefined) body.typical = this.config.typicalP;
    if (this.config.tfs !== undefined) body.tfs = this.config.tfs;

    // dynamic temperature

    if (this.config.smoothingFactor !== undefined) {
      body.smoothing_factor = this.config.smoothingFactor;
    }

    // mirostat
    if (this.config.mirostatMode !== undefined) {
      body.mirostat = this.config.mirostatMode;
    }
    if (this.config.mirostatTau !== undefined) {
      body.mirostat_tau = this.config.mirostatTau;
    }
    if (this.config.mirostatEta !== undefined) {
      body.mirostat_eta = this.config.mirostatEta;
    }

    // dry sampling
    if (this.config.dryMultiplier !== undefined) {
      body.dry_multiplier = this.config.dryMultiplier;
    }
    if (this.config.dryBase !== undefined) {
      body.dry_base = this.config.dryBase;
    }
    if (this.config.dryAllowedLength !== undefined) {
      body.dry_allowed_length = this.config.dryAllowedLength;
    }
    if (this.config.drySequenceBreakers !== undefined) {
      body.dry_sequence_breakers = this.config.drySequenceBreakers;
    }

    // xtc sampling
    if (this.config.xtcThreshold !== undefined) {
      body.xtc_threshold = this.config.xtcThreshold;
    }
    if (this.config.xtcProbability !== undefined) {
      body.xtc_probability = this.config.xtcProbability;
    }

    // other parameters
    if (this.config.nsigma !== undefined) body.nsigma = this.config.nsigma;

    if (this.config.grammarString !== undefined) {
      body.grammar = this.config.grammarString;
    }

    if (this.config.bannedStrings !== undefined) {
      body.banned_tokens = this.config.bannedStrings;
    }

    // koboldcpp specific flags
    body.use_default_badwordsids = true;
    body.trim_stop = true; // trim stop sequences from output
    body.render_special = false;
    body.ban_eos_token = false;

    if (this.config.ignoreEos !== undefined) {
      body.bypass_eos = this.config.ignoreEos;
    }

    return body;
  }
}
