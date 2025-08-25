import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../../utils/logger';

export interface GuildGreeting {
  guildId: string;
  guildName: string;
  message: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  lastModified: string;
  lastModifiedBy: string;
}

export class GreetService {
  private dataPath: string;
  private greetings: Map<string, GuildGreeting> = new Map();
  private saveQueue: Set<string> = new Set();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'greetings');
    this.ensureDirectories();
    this.loadAllGreetings();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
      logger.debug(`created directory: ${this.dataPath}`);
    }
  }

  private loadAllGreetings(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const files = fs
          .readdirSync(this.dataPath)
          .filter((f) => f.endsWith('.json'));

        for (const file of files) {
          const guildId = file.replace('.json', '');
          this.loadGuildGreeting(guildId);
        }
      }

      logger.info(`loaded greetings for ${this.greetings.size} guilds`);
    } catch (error) {
      logger.error('error loading greetings:', error);
    }
  }

  private loadGuildGreeting(guildId: string): void {
    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.greetings.set(guildId, data);
      }
    } catch (error) {
      logger.error(`error loading greeting for guild ${guildId}:`, error);
    }
  }

  private queueSave(guildId: string): void {
    this.saveQueue.add(guildId);

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.processSaveQueue();
    }, 5000);
  }

  private processSaveQueue(): void {
    for (const guildId of this.saveQueue) {
      this.saveGuildGreeting(guildId);
    }
    this.saveQueue.clear();
    this.saveTimer = null;
  }

  private saveGuildGreeting(guildId: string): void {
    const greeting = this.greetings.get(guildId);
    if (!greeting) return;

    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(greeting, null, 2));
      logger.debug(`saved greeting for guild ${guildId}`);
    } catch (error) {
      logger.error(`error saving greeting for guild ${guildId}:`, error);
    }
  }

  setGreeting(
    guildId: string,
    guildName: string,
    message: string,
    userId: string
  ): { success: boolean; message: string } {
    const existing = this.greetings.get(guildId);

    const greeting: GuildGreeting = {
      guildId,
      guildName,
      message,
      enabled: existing?.enabled ?? true,
      createdBy: existing?.createdBy || userId,
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId,
    };

    this.greetings.set(guildId, greeting);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'greeting message set successfully',
    };
  }

  removeGreeting(guildId: string): { success: boolean; message: string } {
    if (!this.greetings.has(guildId)) {
      return {
        success: false,
        message: 'no greeting configured for this server',
      };
    }

    this.greetings.delete(guildId);

    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.error(`error removing greeting file for guild ${guildId}:`, error);
    }

    return {
      success: true,
      message: 'greeting removed successfully',
    };
  }

  getGreeting(guildId: string): GuildGreeting | undefined {
    return this.greetings.get(guildId);
  }

  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.processSaveQueue();
    }
    logger.debug('greet service cleaned up');
  }
}
