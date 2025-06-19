import { BaseProvider } from './BaseProvider';
import { AIResponse, ChatContext } from '../../../types/ai';
import { logger } from '../../../utils/logger';

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

    // build request body with only defined parameters
    const requestBody: any = {
      prompt,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stop: this.config.stopSequences,
    };

    // add optional parameters if defined
    // huge massive colorful chunk of conditionals
    if (this.config.maxNewTokens !== undefined) {
      requestBody.max_new_tokens = this.config.maxNewTokens;
      requestBody.n_predict = this.config.maxNewTokens;
      requestBody.num_predict = this.config.maxNewTokens;
    }

    if (this.config.topP !== undefined) requestBody.top_p = this.config.topP;
    if (this.config.topK !== undefined) requestBody.top_k = this.config.topK;
    if (this.config.typicalP !== undefined) {
      requestBody.typical_p = this.config.typicalP;
      requestBody.typical = this.config.typicalP;
    }
    if (this.config.minP !== undefined) requestBody.min_p = this.config.minP;
    if (this.config.topA !== undefined) requestBody.top_a = this.config.topA;

    if (this.config.repetitionPenalty !== undefined) {
      requestBody.repetition_penalty = this.config.repetitionPenalty;
      requestBody.rep_pen = this.config.repetitionPenalty;
      requestBody.repeat_penalty = this.config.repetitionPenalty;
    }
    if (this.config.frequencyPenalty !== undefined)
      requestBody.frequency_penalty = this.config.frequencyPenalty;
    if (this.config.presencePenalty !== undefined)
      requestBody.presence_penalty = this.config.presencePenalty;
    if (this.config.repPenRange !== undefined) {
      requestBody.rep_pen_range = this.config.repPenRange;
      requestBody.repetition_penalty_range = this.config.repPenRange;
    }
    if (this.config.repPenSlope !== undefined)
      requestBody.rep_pen_slope = this.config.repPenSlope;
    if (this.config.noRepeatNgramSize !== undefined)
      requestBody.no_repeat_ngram_size = this.config.noRepeatNgramSize;
    if (this.config.penaltyAlpha !== undefined)
      requestBody.penalty_alpha = this.config.penaltyAlpha;

    if (this.config.tfs !== undefined) requestBody.tfs = this.config.tfs;
    if (this.config.tfsZ !== undefined) requestBody.tfs_z = this.config.tfsZ;
    if (this.config.epsilonCutoff !== undefined)
      requestBody.epsilon_cutoff = this.config.epsilonCutoff;
    if (this.config.etaCutoff !== undefined)
      requestBody.eta_cutoff = this.config.etaCutoff;

    if (this.config.mirostatMode !== undefined) {
      requestBody.mirostat_mode = this.config.mirostatMode;
      requestBody.mirostat = this.config.mirostatMode;
    }
    if (this.config.mirostatTau !== undefined)
      requestBody.mirostat_tau = this.config.mirostatTau;
    if (this.config.mirostatEta !== undefined)
      requestBody.mirostat_eta = this.config.mirostatEta;

    if (this.config.dryMultiplier !== undefined)
      requestBody.dry_multiplier = this.config.dryMultiplier;
    if (this.config.dryAllowedLength !== undefined)
      requestBody.dry_allowed_length = this.config.dryAllowedLength;
    if (this.config.dryBase !== undefined)
      requestBody.dry_base = this.config.dryBase;
    if (this.config.drySequenceBreakers !== undefined)
      requestBody.dry_sequence_breakers = JSON.stringify(
        this.config.drySequenceBreakers
      );
    if (this.config.dryPenaltyLastN !== undefined)
      requestBody.dry_penalty_last_n = this.config.dryPenaltyLastN;

    if (this.config.xtcThreshold !== undefined)
      requestBody.xtc_threshold = this.config.xtcThreshold;
    if (this.config.xtcProbability !== undefined)
      requestBody.xtc_probability = this.config.xtcProbability;

    if (this.config.smoothingFactor !== undefined)
      requestBody.smoothing_factor = this.config.smoothingFactor;
    if (this.config.smoothingCurve !== undefined)
      requestBody.smoothing_curve = this.config.smoothingCurve;

    if (this.config.numBeams !== undefined)
      requestBody.num_beams = this.config.numBeams;
    if (this.config.lengthPenalty !== undefined)
      requestBody.length_penalty = this.config.lengthPenalty;
    if (this.config.earlyStoppping !== undefined)
      requestBody.early_stopping = this.config.earlyStoppping;

    if (this.config.guidanceScale !== undefined)
      requestBody.guidance_scale = this.config.guidanceScale;
    if (this.config.negativePrompt !== undefined)
      requestBody.negative_prompt = this.config.negativePrompt;
    if (this.config.grammarString !== undefined)
      requestBody.grammar_string = this.config.grammarString;
    if (this.config.customTokenBans !== undefined)
      requestBody.custom_token_bans = this.config.customTokenBans;
    if (this.config.bannedStrings !== undefined)
      requestBody.banned_strings = this.config.bannedStrings;

    if (this.config.samplerOrder !== undefined)
      requestBody.sampler_order = this.config.samplerOrder;
    if (this.config.samplerPriority !== undefined)
      requestBody.sampler_priority = this.config.samplerPriority;
    if (this.config.stoppingStrings !== undefined)
      requestBody.stopping_strings = this.config.stoppingStrings;

    if (this.config.stream !== undefined)
      requestBody.stream = this.config.stream;
    if (this.config.addBosToken !== undefined)
      requestBody.add_bos_token = this.config.addBosToken;
    if (this.config.banEosToken !== undefined)
      requestBody.ban_eos_token = this.config.banEosToken;
    if (this.config.skipSpecialTokens !== undefined)
      requestBody.skip_special_tokens = this.config.skipSpecialTokens;
    if (this.config.includeReasoning !== undefined)
      requestBody.include_reasoning = this.config.includeReasoning;
    if (this.config.doSample !== undefined)
      requestBody.do_sample = this.config.doSample;
    if (this.config.maxTokensSecond !== undefined)
      requestBody.max_tokens_second = this.config.maxTokensSecond;
    if (this.config.temperatureLast !== undefined)
      requestBody.temperature_last = this.config.temperatureLast;
    if (this.config.ignoreEos !== undefined)
      requestBody.ignore_eos = this.config.ignoreEos;

    if (this.config.truncationLength !== undefined)
      requestBody.truncation_length = this.config.truncationLength;
    if (this.config.contextLength !== undefined)
      requestBody.num_ctx = this.config.contextLength;

    requestBody.encoder_repetition_penalty = 1;
    requestBody.repeat_last_n = 0;
    requestBody.min_length = 0;
    requestBody.min_tokens = 0;
    requestBody.skew = 0;
    requestBody.nsigma = 0;

    try {
      logger.debug(`sending request to ${this.config.apiUrl}/v1/completions`);

      // log the full prompt being sent

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
