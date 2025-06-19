import * as fs from 'fs';
import * as path from 'path';

import { MemoryMessage } from './types';
import { ConfigService } from '../config/ConfigService';
import { logger } from '../../utils/logger';

interface ChannelMemory {
  channelId: string;
  guildId: string | null;
  messages: StoredMessage[];
}

interface StoredMessage {
  messageId: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: string;
  isBot?: boolean;
  botId?: string;
}

interface MemoryContext {
  messages: MemoryMessage[];
  messageCount: number;
}

export class MemoryService {
  private memoryPath: string;
  private configService: ConfigService;
  private memoryCache: Map<string, ChannelMemory> = new Map();

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.memoryPath = path.join(process.cwd(), 'data', 'memory');
    this.ensureDirectories();
    this.loadAllMemories();
  }

  private ensureDirectories(): void {
    const dirs = [
      this.memoryPath,
      path.join(this.memoryPath, 'guilds'),
      path.join(this.memoryPath, 'dm'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`created directory: ${dir}`);
      }
    }
  }

  private getMemoryFilePath(channelId: string, guildId: string | null): string {
    if (guildId) {
      const guildDir = path.join(this.memoryPath, 'guilds', guildId);
      if (!fs.existsSync(guildDir)) {
        fs.mkdirSync(guildDir, { recursive: true });
      }
      return path.join(guildDir, `${channelId}.json`);
    } else {
      return path.join(this.memoryPath, 'dm', `${channelId}.json`);
    }
  }

  private getCacheKey(channelId: string, guildId: string | null): string {
    return guildId ? `${guildId}:${channelId}` : `dm:${channelId}`;
  }

  private loadAllMemories(): void {
    try {
      // load guild memories
      const guildsDir = path.join(this.memoryPath, 'guilds');
      if (fs.existsSync(guildsDir)) {
        const guildIds = fs
          .readdirSync(guildsDir)
          .filter((f) => fs.statSync(path.join(guildsDir, f)).isDirectory());

        for (const guildId of guildIds) {
          const guildPath = path.join(guildsDir, guildId);
          const channelFiles = fs
            .readdirSync(guildPath)
            .filter((f) => f.endsWith('.json'));

          for (const file of channelFiles) {
            const channelId = file.replace('.json', '');
            this.loadChannelMemory(channelId, guildId);
          }
        }
      }

      // load dm memories
      const dmDir = path.join(this.memoryPath, 'dm');
      if (fs.existsSync(dmDir)) {
        const dmFiles = fs
          .readdirSync(dmDir)
          .filter((f) => f.endsWith('.json'));

        for (const file of dmFiles) {
          const channelId = file.replace('.json', '');
          this.loadChannelMemory(channelId, null);
        }
      }

      logger.info(`loaded ${this.memoryCache.size} channel memories`);
    } catch (error) {
      logger.error('error loading memories:', error);
    }
  }

  private loadChannelMemory(channelId: string, guildId: string | null): void {
    try {
      const filePath = this.getMemoryFilePath(channelId, guildId);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cacheKey = this.getCacheKey(channelId, guildId);
        this.memoryCache.set(cacheKey, data);
      }
    } catch (error) {
      logger.error(`error loading memory for channel ${channelId}:`, error);
    }
  }

  private saveChannelMemory(channelId: string, guildId: string | null): void {
    const cacheKey = this.getCacheKey(channelId, guildId);
    const memory = this.memoryCache.get(cacheKey);

    if (!memory) return;

    try {
      const filePath = this.getMemoryFilePath(channelId, guildId);
      fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
    } catch (error) {
      logger.error(`error saving memory for channel ${channelId}:`, error);
    }
  }

  async addMessage(message: MemoryMessage): Promise<void> {
    const cacheKey = this.getCacheKey(message.channelId, message.guildId);
    let memory = this.memoryCache.get(cacheKey);

    if (!memory) {
      memory = {
        channelId: message.channelId,
        guildId: message.guildId,
        messages: [],
      };
      this.memoryCache.set(cacheKey, memory);
    }

    const storedMessage: StoredMessage = {
      messageId: message.id,
      authorId: message.authorId,
      authorName: message.author,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
    };

    memory.messages.push(storedMessage);

    // trim old messages if exceeding limit
    const config = this.configService.getMemoryConfig();
    if (memory.messages.length > config.maxMessagesPerChannel) {
      const excess = memory.messages.length - config.maxMessagesPerChannel;
      memory.messages.splice(0, excess);
    }

    this.saveChannelMemory(message.channelId, message.guildId);
  }

  async getChannelContext(
    channelId: string,
    guildId: string | null
  ): Promise<MemoryContext> {
    const cacheKey = this.getCacheKey(channelId, guildId);
    const memory = this.memoryCache.get(cacheKey);

    if (!memory || memory.messages.length === 0) {
      return { messages: [], messageCount: 0 };
    }

    // convert stored messages to memory messages
    const messages: MemoryMessage[] = memory.messages.map((msg) => ({
      id: msg.messageId,
      channelId: channelId,
      guildId: guildId,
      author: msg.authorName,
      authorId: msg.authorId,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }));

    // get recent messages based on token limit
    const config = this.configService.getMemoryConfig();
    const recentMessages = this.getRecentMessages(
      messages,
      config.maxTokensInContext
    );

    return {
      messages: recentMessages,
      messageCount: memory.messages.length,
    };
  }

  private getRecentMessages(
    messages: MemoryMessage[],
    maxTokens: number
  ): MemoryMessage[] {
    const selected: MemoryMessage[] = [];
    let estimatedTokens = 0;

    // work backwards from most recent
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokens(message.content);

      if (estimatedTokens + messageTokens <= maxTokens) {
        selected.unshift(message);
        estimatedTokens += messageTokens;
      } else {
        break;
      }
    }

    return selected;
  }

  private estimateTokens(text: string): number {
    // rough estimate: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  async clearChannel(channelId: string, guildId: string | null): Promise<void> {
    const cacheKey = this.getCacheKey(channelId, guildId);
    this.memoryCache.delete(cacheKey);

    const filePath = this.getMemoryFilePath(channelId, guildId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`cleared memory for channel ${channelId}`);
    }
  }

  getStats(): { totalChannels: number; totalMessages: number } {
    let totalMessages = 0;

    for (const memory of this.memoryCache.values()) {
      totalMessages += memory.messages.length;
    }

    return {
      totalChannels: this.memoryCache.size,
      totalMessages,
    };
  }
}
