import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

export interface Autoresponder {
  trigger: string;
  reply: string;
  enabled: boolean;
  matchMode?: 'exact' | 'contains' | 'startswith' | 'endswith' | 'regex';
}

export interface GuildAutoresponders {
  guildId: string;
  guildName: string;
  autoresponders: Map<string, Autoresponder>;
}

export class AutoresponderService {
  private dataPath: string;
  private guildCache: Map<string, GuildAutoresponders> = new Map();
  private saveQueue: Set<string> = new Set();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'autoresponders');
    this.ensureDirectories();
    this.loadAllAutoresponders();
  }

  private ensureDirectories(): void {
    const dirs = [this.dataPath, path.join(this.dataPath, 'guilds')];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`created directory: ${dir}`);
      }
    }
  }

  private loadAllAutoresponders(): void {
    try {
      const guildsDir = path.join(this.dataPath, 'guilds');
      if (fs.existsSync(guildsDir)) {
        const files = fs
          .readdirSync(guildsDir)
          .filter((f) => f.endsWith('.json'));

        for (const file of files) {
          const guildId = file.replace('.json', '');
          this.loadGuildAutoresponders(guildId);
        }
      }

      logger.info(`loaded autoresponders for ${this.guildCache.size} guilds`);
    } catch (error) {
      logger.error('error loading autoresponders:', error);
    }
  }

  private loadGuildAutoresponders(guildId: string): void {
    try {
      const filePath = path.join(this.dataPath, 'guilds', `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // convert autoresponders array back to Map
        const autoresponders = new Map<string, Autoresponder>();
        if (data.autoresponders) {
          for (const [trigger, responder] of Object.entries(
            data.autoresponders
          )) {
            autoresponders.set(trigger, responder as Autoresponder);
          }
        }

        this.guildCache.set(guildId, {
          ...data,
          autoresponders,
        });
      }
    } catch (error) {
      logger.error(`error loading autoresponders for guild ${guildId}:`, error);
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
      this.saveGuildAutoresponders(guildId);
    }
    this.saveQueue.clear();
    this.saveTimer = null;
  }

  private saveGuildAutoresponders(guildId: string): void {
    const guildData = this.guildCache.get(guildId);
    if (!guildData) return;

    try {
      // convert Map to object for JSON serialization
      const dataToSave = {
        ...guildData,
        autoresponders: Object.fromEntries(guildData.autoresponders),
      };

      const filePath = path.join(this.dataPath, 'guilds', `${guildId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      logger.debug(`saved autoresponders for guild ${guildId}`);
    } catch (error) {
      logger.error(`error saving autoresponders for guild ${guildId}:`, error);
    }
  }

  private initializeGuildAutoresponders(
    guildId: string,
    guildName: string
  ): GuildAutoresponders {
    const guildData: GuildAutoresponders = {
      guildId,
      guildName,
      autoresponders: new Map(),
    };

    this.guildCache.set(guildId, guildData);
    this.queueSave(guildId);

    logger.info(`initialized autoresponders for guild ${guildId}`);
    return guildData;
  }

  // public methods

  createAutoresponder(
    guildId: string,
    guildName: string,
    trigger: string,
    reply: string
  ): { success: boolean; message: string } {
    let guildData = this.guildCache.get(guildId);

    if (!guildData) {
      guildData = this.initializeGuildAutoresponders(guildId, guildName);
    }

    // check if trigger already exists
    if (guildData.autoresponders.has(trigger)) {
      return {
        success: false,
        message: 'an autoresponder with this trigger already exists',
      };
    }

    const autoresponder: Autoresponder = {
      trigger,
      reply,
      enabled: true,
    };

    guildData.autoresponders.set(trigger, autoresponder);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'autoresponder created successfully',
    };
  }

  removeAutoresponder(
    guildId: string,
    trigger: string
  ): { success: boolean; message: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no autoresponders configured for this guild',
      };
    }

    if (!guildData.autoresponders.has(trigger)) {
      return {
        success: false,
        message: 'autoresponder not found',
      };
    }

    guildData.autoresponders.delete(trigger);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'autoresponder removed successfully',
    };
  }

  editAutoresponder(
    guildId: string,
    trigger: string,
    newReply: string
  ): { success: boolean; message: string; oldReply?: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no autoresponders configured for this guild',
      };
    }

    const autoresponder = guildData.autoresponders.get(trigger);
    if (!autoresponder) {
      return {
        success: false,
        message: 'autoresponder not found',
      };
    }

    const oldReply = autoresponder.reply;
    autoresponder.reply = newReply;
    this.queueSave(guildId);

    return {
      success: true,
      message: 'autoresponder updated successfully',
      oldReply,
    };
  }

  getAutoresponder(
    guildId: string,
    trigger: string
  ): Autoresponder | undefined {
    const guildData = this.guildCache.get(guildId);
    return guildData?.autoresponders.get(trigger);
  }

  getGuildAutoresponders(guildId: string): Map<string, Autoresponder> {
    const guildData = this.guildCache.get(guildId);
    return guildData?.autoresponders || new Map();
  }

  checkMessage(
    guildId: string,
    messageContent: string
  ): Autoresponder | undefined {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return undefined;
    }

    const lowerContent = messageContent.toLowerCase();

    for (const [trigger, autoresponder] of guildData.autoresponders) {
      if (!autoresponder.enabled) continue;

      const matchMode = autoresponder.matchMode || 'exact';
      const lowerTrigger = trigger.toLowerCase();

      let matches = false;

      switch (matchMode) {
        case 'exact':
          matches = lowerContent === lowerTrigger;
          break;

        case 'contains':
          matches = lowerContent.includes(lowerTrigger);
          break;

        case 'startswith':
          matches = lowerContent.startsWith(lowerTrigger);
          break;

        case 'endswith':
          matches = lowerContent.endsWith(lowerTrigger);
          break;

        case 'regex':
          try {
            const regex = new RegExp(`\\b${trigger}\\b`, 'i');
            matches = regex.test(messageContent);
          } catch (error) {
            logger.error(`invalid regex in autoresponder: ${trigger}`);
            matches = false;
          }
          break;
      }

      if (matches) {
        return autoresponder;
      }
    }

    return undefined;
  }

  setMatchMode(
    guildId: string,
    trigger: string,
    matchMode: 'exact' | 'contains' | 'startswith' | 'endswith' | 'regex'
  ): { success: boolean; message: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no autoresponders configured for this guild',
      };
    }

    const autoresponder = guildData.autoresponders.get(trigger);
    if (!autoresponder) {
      return {
        success: false,
        message: 'autoresponder not found',
      };
    }

    autoresponder.matchMode = matchMode;
    this.queueSave(guildId);

    return {
      success: true,
      message: `match mode set to ${matchMode}`,
    };
  }

  // cleanup method for graceful shutdown
  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.processSaveQueue();
    }
    logger.debug('autoresponder service cleaned up');
  }

  // stats methods
  getStats(): {
    totalGuilds: number;
    totalAutoresponders: number;
    enabledAutoresponders: number;
  } {
    let totalAutoresponders = 0;
    let enabledAutoresponders = 0;

    for (const guildData of this.guildCache.values()) {
      totalAutoresponders += guildData.autoresponders.size;

      for (const autoresponder of guildData.autoresponders.values()) {
        if (autoresponder.enabled) {
          enabledAutoresponders++;
        }
      }
    }

    return {
      totalGuilds: this.guildCache.size,
      totalAutoresponders,
      enabledAutoresponders,
    };
  }
}
