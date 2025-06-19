export interface AIConfig {
  // required core settings
  provider: 'local' | 'openai';
  apiUrl: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  stopSequences: string[];
  formatting: PromptFormatting;

  maxNewTokens?: number;
  truncationLength?: number;
  contextLength?: number;

  topP?: number;
  topK?: number;
  typicalP?: number;
  minP?: number;
  topA?: number;

  repetitionPenalty?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repPenRange?: number;
  repPenSlope?: number;
  noRepeatNgramSize?: number;
  penaltyAlpha?: number;

  tfs?: number;
  tfsZ?: number;
  epsilonCutoff?: number;
  etaCutoff?: number;

  mirostatMode?: number;
  mirostatTau?: number;
  mirostatEta?: number;

  dryMultiplier?: number;
  dryAllowedLength?: number;
  dryBase?: number;
  drySequenceBreakers?: string[];
  dryPenaltyLastN?: number;

  xtcThreshold?: number;
  xtcProbability?: number;

  smoothingFactor?: number;
  smoothingCurve?: number;

  numBeams?: number;
  lengthPenalty?: number;
  earlyStoppping?: boolean;

  addBosToken?: boolean;
  banEosToken?: boolean;
  skipSpecialTokens?: boolean;
  includeReasoning?: boolean;
  stream?: boolean;
  doSample?: boolean;
  maxTokensSecond?: number;
  temperatureLast?: boolean;
  ignoreEos?: boolean;

  guidanceScale?: number;
  negativePrompt?: string;
  grammarString?: string;
  customTokenBans?: string;
  bannedStrings?: string[];

  samplerOrder?: number[];
  samplerPriority?: string[];

  stoppingStrings?: string[];
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
