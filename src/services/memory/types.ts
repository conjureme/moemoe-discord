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
}

export interface MessageAttachment {
  url: string;
  type: string;
  name: string;
  size: number;
}
