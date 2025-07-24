export interface MemoryMessage {
  id: string;
  channelId: string;
  guildId: string | null;
  author: string;
  authorId: string;
  content: string;
  timestamp: Date;
  isBot?: boolean;
  botId?: string;
  isSystem?: boolean;
  attachments?: MessageAttachment[];
  swipe_id?: number;
  swipes?: string[];
  is_user?: boolean;
  is_name?: boolean;
  extra?: Record<string, any>;
}

export interface MessageAttachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

export interface ChannelMemory {
  channelId: string | null; // can be null for guild-wide storage
  guildId: string | null;
  messages: StoredMessage[];
  chat_metadata?: {
    note?: string;
    created?: string;
    modified?: string;
    world?: string;
    character?: string;
    tags?: string[];
    memoryType?: 'channel' | 'guild'; // track the type
  };
}

export interface StoredMessage {
  messageId: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: string;
  isBot?: boolean;
  botId?: string;
  isSystem?: boolean;
  attachments?: MessageAttachment[];
  swipe_id?: number;
  swipes?: string[];
  is_user?: boolean;
  is_name?: boolean;
  extra?: Record<string, any>;
  sourceChannel?: string;
}

export interface GuildMemorySettings {
  guildId: string;
  memoryType: 'channel' | 'guild';
  lastModified: string;
}
