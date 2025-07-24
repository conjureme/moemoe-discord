import * as fs from 'fs';
import * as path from 'path';

import {
  MemoryMessage,
  ChannelMemory,
  StoredMessage,
  GuildMemorySettings,
} from './types';
import { ConfigService } from '../config/ConfigService';
import { logger } from '../../utils/logger';

interface MemoryContext {
  messages: MemoryMessage[];
  messageCount: number;
}

export class MemoryService {
  private memoryPath: string;
  private configService: ConfigService;
  private memoryCache: Map<string, ChannelMemory> = new Map();
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();
  private guildSettings: Map<string, GuildMemorySettings> = new Map();
  private settingsPath: string;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.memoryPath = path.join(process.cwd(), 'data', 'memory');
    this.settingsPath = path.join(process.cwd(), 'data', 'memory', 'settings');
    this.ensureDirectories();
    this.loadGuildSettings();
    this.loadAllMemories();
    this.setupFileWatchers();
  }

  private ensureDirectories(): void {
    const dirs = [
      this.memoryPath,
      path.join(this.memoryPath, 'guilds'),
      path.join(this.memoryPath, 'dm'),
      this.settingsPath,
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`created directory: ${dir}`);
      }
    }
  }

  private loadGuildSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const files = fs
          .readdirSync(this.settingsPath)
          .filter((f) => f.endsWith('.json'));

        for (const file of files) {
          const guildId = file.replace('.json', '');
          const filePath = path.join(this.settingsPath, file);
          const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          this.guildSettings.set(guildId, settings);
        }
      }

      logger.info(`loaded settings for ${this.guildSettings.size} guilds`);
    } catch (error) {
      logger.error('error loading guild settings:', error);
    }
  }

  private saveGuildSettings(guildId: string): void {
    const settings = this.guildSettings.get(guildId);
    if (!settings) return;

    try {
      const filePath = path.join(this.settingsPath, `${guildId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    } catch (error) {
      logger.error(`error saving guild settings for ${guildId}:`, error);
    }
  }

  getGuildMemoryType(guildId: string): 'channel' | 'guild' {
    const settings = this.guildSettings.get(guildId);
    return settings?.memoryType || 'channel'; // defaults to channel mode
  }

  setGuildMemoryType(guildId: string, type: 'channel' | 'guild'): void {
    let settings = this.guildSettings.get(guildId);

    if (!settings) {
      settings = {
        guildId,
        memoryType: type,
        lastModified: new Date().toISOString(),
      };
    } else {
      settings.memoryType = type;
      settings.lastModified = new Date().toISOString();
    }

    this.guildSettings.set(guildId, settings);
    this.saveGuildSettings(guildId);

    logger.info(`set memory type for guild ${guildId} to ${type}`);
  }

  private setupFileWatchers(): void {
    // watch the dm directory for file deletions
    const dmDir = path.join(this.memoryPath, 'dm');
    if (fs.existsSync(dmDir)) {
      const dmWatcher = fs.watch(dmDir, (eventType, filename) => {
        if (eventType === 'rename' && filename && filename.endsWith('.json')) {
          const channelId = filename.replace('.json', '');
          const filePath = path.join(dmDir, filename);

          // check if file was deleted
          if (!fs.existsSync(filePath)) {
            const cacheKey = this.getCacheKey(channelId, null);
            if (this.memoryCache.has(cacheKey)) {
              this.memoryCache.delete(cacheKey);
              logger.debug(`removed dm memory from cache: ${channelId}`);
            }
          }
        }
      });
      this.fileWatchers.set('dm', dmWatcher);
    }

    // watch guild directories
    const guildsDir = path.join(this.memoryPath, 'guilds');
    if (fs.existsSync(guildsDir)) {
      const guildIds = fs
        .readdirSync(guildsDir)
        .filter((f) => fs.statSync(path.join(guildsDir, f)).isDirectory());

      for (const guildId of guildIds) {
        this.watchGuildDirectory(guildId);
      }
    }
  }

  private watchGuildDirectory(guildId: string): void {
    const guildDir = path.join(this.memoryPath, 'guilds', guildId);
    if (fs.existsSync(guildDir)) {
      const watcher = fs.watch(guildDir, (eventType, filename) => {
        if (eventType === 'rename' && filename && filename.endsWith('.json')) {
          const channelId = filename.replace('.json', '');
          const filePath = path.join(guildDir, filename);

          if (!fs.existsSync(filePath)) {
            const cacheKey = this.getCacheKey(channelId, guildId);
            if (this.memoryCache.has(cacheKey)) {
              this.memoryCache.delete(cacheKey);
              logger.debug(
                `removed guild memory from cache: ${guildId}/${channelId}`
              );
            }
          }
        }
      });
      this.fileWatchers.set(`guild:${guildId}`, watcher);
    }
  }

  private getMemoryFilePath(channelId: string, guildId: string | null): string {
    if (guildId) {
      const memoryType = this.getGuildMemoryType(guildId);
      const guildDir = path.join(this.memoryPath, 'guilds', guildId);

      if (!fs.existsSync(guildDir)) {
        fs.mkdirSync(guildDir, { recursive: true });
        this.watchGuildDirectory(guildId);
      }

      if (memoryType === 'guild') {
        return path.join(guildDir, '_guild_memory.json');
      } else {
        return path.join(guildDir, `${channelId}.json`);
      }
    } else {
      return path.join(this.memoryPath, 'dm', `${channelId}.json`);
    }
  }

  private getCacheKey(channelId: string, guildId: string | null): string {
    if (guildId && this.getGuildMemoryType(guildId) === 'guild') {
      return `guild:${guildId}`;
    }
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

        // ensure proper structure
        if (!data.chat_metadata) {
          data.chat_metadata = {
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            character: this.configService.getBotConfig().name,
          };
        }

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
      const isGuildWide =
        message.guildId && this.getGuildMemoryType(message.guildId) === 'guild';

      memory = {
        channelId: isGuildWide ? null : message.channelId,
        guildId: message.guildId,
        messages: [],
        chat_metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          character: this.configService.getBotConfig().name,
          memoryType: isGuildWide ? 'guild' : 'channel',
        },
      };
      this.memoryCache.set(cacheKey, memory);
    }

    const storedMessage: StoredMessage = {
      messageId: message.id,
      authorId: message.authorId,
      authorName: message.author,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      isBot: message.isBot,
      botId: message.botId,
      isSystem: message.isSystem,
      attachments: message.attachments,
      is_user: !message.isBot && !message.isSystem,
      is_name: true,
      swipe_id: 0,
      swipes: [message.content],
      extra: message.extra,
      sourceChannel: message.channelId,
    };

    memory.messages.push(storedMessage);

    if (memory.chat_metadata) {
      memory.chat_metadata.modified = new Date().toISOString();
    }

    const config = this.configService.getMemoryConfig();
    if (memory.messages.length > config.maxMessagesPerChannel) {
      const excess = memory.messages.length - config.maxMessagesPerChannel;
      memory.messages.splice(0, excess);
    }

    this.saveChannelMemory(message.channelId, message.guildId);
  }

  async addSystemMessage(message: {
    channelId: string;
    guildId: string | null;
    content: string;
    timestamp: Date;
  }): Promise<void> {
    await this.addMessage({
      id: 'system-' + Date.now(),
      channelId: message.channelId,
      guildId: message.guildId,
      author: 'System',
      authorId: 'system',
      content: message.content,
      timestamp: message.timestamp,
      isBot: false,
      isSystem: true,
    });
  }

  async getChannelContext(
    channelId: string,
    guildId: string | null
  ): Promise<MemoryContext> {
    // always check if the file exists first
    const filePath = this.getMemoryFilePath(channelId, guildId);
    const cacheKey = this.getCacheKey(channelId, guildId);

    // if file doesn't exist but cache does, clear the cache
    if (!fs.existsSync(filePath) && this.memoryCache.has(cacheKey)) {
      this.memoryCache.delete(cacheKey);
      logger.debug(`cleared stale cache for ${cacheKey}`);
    }

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
      isBot: msg.isBot,
      botId: msg.botId,
      isSystem: msg.isSystem,
      attachments: msg.attachments,
      extra: msg.extra,
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
    return Math.ceil(text.length / 4);
  }

  async clearChannel(channelId: string, guildId: string | null): Promise<void> {
    const cacheKey = this.getCacheKey(channelId, guildId);

    if (guildId && this.getGuildMemoryType(guildId) === 'guild') {
      // if in guild mode, this clears the entire guild's memory
      logger.warn(
        `clearing entire guild memory for ${guildId} (guild-wide mode)`
      );
    }

    const emptyMemory: ChannelMemory = {
      channelId:
        guildId && this.getGuildMemoryType(guildId) === 'guild'
          ? null
          : channelId,
      guildId: guildId,
      messages: [],
    };

    this.memoryCache.set(cacheKey, emptyMemory);

    const filePath = this.getMemoryFilePath(channelId, guildId);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(
          `deleted memory file for ${guildId ? 'guild' : 'channel'} ${channelId}`
        );
      }

      this.memoryCache.delete(cacheKey);
      logger.info(`cleared memory for ${cacheKey}`);
    } catch (error) {
      logger.error(`error clearing memory for ${cacheKey}:`, error);
      this.memoryCache.delete(cacheKey);
    }
  }

  async clearAllUserDMs(userId: string): Promise<number> {
    let clearedCount = 0;

    // check all dm memories for this user
    const dmDir = path.join(this.memoryPath, 'dm');
    if (!fs.existsSync(dmDir)) {
      return clearedCount;
    }

    const dmFiles = fs.readdirSync(dmDir).filter((f) => f.endsWith('.json'));

    for (const file of dmFiles) {
      const channelId = file.replace('.json', '');
      const cacheKey = this.getCacheKey(channelId, null);
      const memory = this.memoryCache.get(cacheKey);

      // check if this dm channel belongs to the user
      if (memory && memory.messages.length > 0) {
        const hasUserMessage = memory.messages.some(
          (msg) => msg.authorId === userId && !msg.isBot
        );

        if (hasUserMessage) {
          await this.clearChannel(channelId, null);
          clearedCount++;
          logger.debug(`cleared dm channel ${channelId} for user ${userId}`);
        }
      }
    }

    return clearedCount;
  }

  getStats(): {
    totalChannels: number;
    totalMessages: number;
    dmChannels: number;
    guildChannels: number;
  } {
    let totalMessages = 0;
    let dmChannels = 0;
    let guildChannels = 0;

    for (const [key, memory] of this.memoryCache.entries()) {
      totalMessages += memory.messages.length;

      if (key.startsWith('dm:')) {
        dmChannels++;
      } else {
        guildChannels++;
      }
    }

    return {
      totalChannels: this.memoryCache.size,
      totalMessages,
      dmChannels,
      guildChannels,
    };
  }

  // cleanup method for graceful shutdown
  cleanup(): void {
    for (const [key, watcher] of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();
    logger.debug('cleaned up file watchers');
  }
}
