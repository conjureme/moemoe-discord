import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../../utils/logger';

export abstract class GuildDataService<T> {
  protected dataPath: string;
  protected dataCache: Map<string, T> = new Map();
  private saveQueue: Set<string> = new Set();
  private saveTimer: NodeJS.Timeout | null = null;
  private saveDelay: number = 5000;

  constructor(subdirectory: string) {
    this.dataPath = path.join(process.cwd(), 'data', subdirectory);
    this.ensureDirectories();
    this.loadAllData();
  }

  protected ensureDirectories(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
      logger.debug(`created directory: ${this.dataPath}`);
    }
  }

  protected loadAllData(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const files = fs
          .readdirSync(this.dataPath)
          .filter((f) => f.endsWith('.json'));

        for (const file of files) {
          const guildId = file.replace('.json', '');
          this.loadGuildData(guildId);
        }
      }

      logger.info(
        `loaded ${this.getServiceName()} for ${this.dataCache.size} guilds`
      );
    } catch (error) {
      logger.error(`error loading ${this.getServiceName()}:`, error);
    }
  }

  protected loadGuildData(guildId: string): void {
    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.dataCache.set(guildId, data);
      }
    } catch (error) {
      logger.error(
        `error loading ${this.getServiceName()} for guild ${guildId}:`,
        error
      );
    }
  }

  protected queueSave(guildId: string): void {
    this.saveQueue.add(guildId);

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.processSaveQueue();
    }, this.saveDelay);
  }

  private processSaveQueue(): void {
    for (const guildId of this.saveQueue) {
      this.saveGuildData(guildId);
    }
    this.saveQueue.clear();
    this.saveTimer = null;
  }

  protected saveGuildData(guildId: string): void {
    const data = this.dataCache.get(guildId);
    if (!data) return;

    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      logger.debug(`saved ${this.getServiceName()} for guild ${guildId}`);
    } catch (error) {
      logger.error(
        `error saving ${this.getServiceName()} for guild ${guildId}:`,
        error
      );
    }
  }

  protected deleteGuildData(guildId: string): void {
    this.dataCache.delete(guildId);

    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.error(
        `error removing ${this.getServiceName()} file for guild ${guildId}:`,
        error
      );
    }
  }

  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.processSaveQueue();
    }
    logger.debug(`${this.getServiceName()} cleaned up`);
  }

  protected abstract getServiceName(): string;
}
