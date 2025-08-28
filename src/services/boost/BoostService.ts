import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../../utils/logger';

export interface GuildBoostMessage {
  guildId: string;
  guildName: string;
  message: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  lastModified: string;
  lastModifiedBy: string;
}

export class BoostService {
  private dataPath: string;
  private boostMessages: Map<string, GuildBoostMessage> = new Map();
  private saveQueue: Set<string> = new Set();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'boosts');
    this.ensureDirectories();
    this.loadAllBoostMessages();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
      logger.debug(`created directory: ${this.dataPath}`);
    }
  }

  private loadAllBoostMessages(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const files = fs
          .readdirSync(this.dataPath)
          .filter((f) => f.endsWith('.json'));

        for (const file of files) {
          const guildId = file.replace('.json', '');
          this.loadGuildBoostMessage(guildId);
        }
      }

      logger.info(
        `loaded boost messages for ${this.boostMessages.size} guilds`
      );
    } catch (error) {
      logger.error('error loading boost messages:', error);
    }
  }

  private loadGuildBoostMessage(guildId: string): void {
    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.boostMessages.set(guildId, data);
      }
    } catch (error) {
      logger.error(`error loading boost message for guild ${guildId}:`, error);
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
      this.saveGuildBoostMessage(guildId);
    }
    this.saveQueue.clear();
    this.saveTimer = null;
  }

  private saveGuildBoostMessage(guildId: string): void {
    const boostMessage = this.boostMessages.get(guildId);
    if (!boostMessage) return;

    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(boostMessage, null, 2));
      logger.debug(`saved boost message for guild ${guildId}`);
    } catch (error) {
      logger.error(`error saving boost message for guild ${guildId}:`, error);
    }
  }

  setBoostMessage(
    guildId: string,
    guildName: string,
    message: string,
    userId: string
  ): { success: boolean; message: string } {
    const existing = this.boostMessages.get(guildId);

    const boostMessage: GuildBoostMessage = {
      guildId,
      guildName,
      message,
      enabled: existing?.enabled ?? true,
      createdBy: existing?.createdBy || userId,
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId,
    };

    this.boostMessages.set(guildId, boostMessage);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'boost message set successfully',
    };
  }

  removeBoostMessage(guildId: string): { success: boolean; message: string } {
    if (!this.boostMessages.has(guildId)) {
      return {
        success: false,
        message: 'no boost message configured for this server',
      };
    }

    this.boostMessages.delete(guildId);

    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.error(
        `error removing boost message file for guild ${guildId}:`,
        error
      );
    }

    return {
      success: true,
      message: 'boost message removed successfully',
    };
  }

  getBoostMessage(guildId: string): GuildBoostMessage | undefined {
    return this.boostMessages.get(guildId);
  }

  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.processSaveQueue();
    }
    logger.debug('boost service cleaned up');
  }

  getStats(): {
    totalGuilds: number;
    enabledBoostMessages: number;
  } {
    let enabledCount = 0;

    for (const boostMessage of this.boostMessages.values()) {
      if (boostMessage.enabled) {
        enabledCount++;
      }
    }

    return {
      totalGuilds: this.boostMessages.size,
      enabledBoostMessages: enabledCount,
    };
  }
}
