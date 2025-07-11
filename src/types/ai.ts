export interface AIConfig {
  instruct: {
    input_sequence: string;
    output_sequence: string;
    last_output_sequence: string;
    system_sequence: string;
    stop_sequence: string;
    wrap: boolean;
    macro: boolean;
    names_behavior: string;
    activation_regex: string;
    system_sequence_prefix: string;
    system_sequence_suffix: string;
    first_output_sequence: string;
    skip_examples: boolean;
    output_suffix: string;
    input_suffix: string;
    system_suffix: string;
    user_alignment_message: string;
    system_same_as_user: boolean;
    last_system_sequence: string;
    first_input_sequence: string;
    last_input_sequence: string;
    names_force_groups: boolean;
    name: string;
  };
  context: {
    story_string: string;
    example_separator: string;
    chat_start: string;
    use_stop_strings: boolean;
    allow_jailbreak: boolean;
    names_as_stop_strings: boolean;
    always_force_name2: boolean;
    trim_sentences: boolean;
    single_line: boolean;
    name: string;
  };
  sysprompt: {
    name: string;
    content: string;
  };
  preset: {
    temp: number;
    temperature_last: boolean;
    top_p: number;
    top_k: number;
    top_a: number;
    tfs: number;
    epsilon_cutoff: number;
    eta_cutoff: number;
    typical_p: number;
    min_p: number;
    rep_pen: number;
    rep_pen_range: number;
    rep_pen_decay: number;
    rep_pen_slope: number;
    no_repeat_ngram_size: number;
    penalty_alpha: number;
    num_beams: number;
    length_penalty: number;
    min_length: number;
    encoder_rep_pen: number;
    freq_pen: number;
    presence_pen: number;
    skew: number;
    do_sample: boolean;
    early_stopping: boolean;
    dynatemp: boolean;
    min_temp: number;
    max_temp: number;
    dynatemp_exponent: number;
    smoothing_factor: number;
    smoothing_curve: number;
    dry_allowed_length: number;
    dry_multiplier: number;
    dry_base: number;
    dry_sequence_breakers: string[];
    dry_penalty_last_n: number;
    add_bos_token: boolean;
    ban_eos_token: boolean;
    skip_special_tokens: boolean;
    mirostat_mode: number;
    mirostat_tau: number;
    mirostat_eta: number;
    guidance_scale: number;
    negative_prompt: string;
    grammar_string: string;
    json_schema: any;
    banned_tokens: string;
    sampler_priority: string[];
    samplers: string[];
    samplers_priorities: string[];
    ignore_eos_token: boolean;
    spaces_between_special_tokens: boolean;
    speculative_ngram: boolean;
    sampler_order: number[];
    logit_bias: any[];
    xtc_threshold: number;
    xtc_probability: number;
    nsigma: number;
    rep_pen_size: number;
    genamt: number;
    max_length: number;
    name: string;
  };
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
  images?: string[];
}

export interface ChatContext {
  messages: AIMessage[];
  systemPrompt: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
