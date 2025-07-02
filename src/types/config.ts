export interface BotConfig {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creatorcomment: string;
  avatar: string;
  chat: string;
  talkativeness: string;
  fav: boolean;
  create_date: string;
  spec: string;
  spec_version: string;
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    tags: string[];
    creator: string;
    character_version: string;
    alternate_greetings: string[];
    extensions: {
      talkativeness: string;
      fav: boolean;
      world: string;
      depth_prompt: {
        prompt: string;
        depth: number;
        role: string;
      };
    };
    group_only_greetings: string[];
  };
  tags: string[];
}

export interface ConversationExchange {
  userName: string;
  userId?: string;
  userMessage: string;
  assistantResponse: string;
}

export interface MemoryConfig {
  maxMessagesPerChannel: number;
  maxTokensInContext: number;
  userMessageFormat?:
    | 'default'
    | 'nickname'
    | 'username_only'
    | 'id_only'
    | 'custom';
  customUserFormat?: string; // e.g., "{{nickname}}({{id}}): {{message}}"
}
