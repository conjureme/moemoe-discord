import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { GuildDataService } from '../base/GuildDataService';

export interface Autoresponder {
  trigger: string;
  reply: string;
  enabled: boolean;
  matchMode?: 'exact' | 'contains' | 'startswith' | 'endswith' | 'default';
}

export interface GuildAutoresponders {
  guildId: string;
  guildName: string;
  autoresponders: Map<string, Autoresponder>;
}

export class AutoresponderService extends GuildDataService<GuildAutoresponders> {
  constructor() {
    super('autoresponders/guilds');
  }

  protected getServiceName(): string {
    return 'autoresponders';
  }

  protected loadGuildData(guildId: string): void {
    try {
      const filePath = path.join(this.dataPath, `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const autoresponders = new Map<string, Autoresponder>();
        if (data.autoresponders) {
          for (const [trigger, responder] of Object.entries(
            data.autoresponders
          )) {
            autoresponders.set(trigger, responder as Autoresponder);
          }
        }

        this.dataCache.set(guildId, {
          ...data,
          autoresponders,
        });
      }
    } catch (error) {
      logger.error(
        `error loading ${this.getServiceName()} for guild ${guildId}:`,
        error
      );
    }
  }

  protected saveGuildData(guildId: string): void {
    const guildData = this.dataCache.get(guildId);
    if (!guildData) return;

    try {
      const dataToSave = {
        ...guildData,
        autoresponders: Object.fromEntries(guildData.autoresponders),
      };

      const filePath = path.join(this.dataPath, `${guildId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      logger.debug(`saved ${this.getServiceName()} for guild ${guildId}`);
    } catch (error) {
      logger.error(
        `error saving ${this.getServiceName()} for guild ${guildId}:`,
        error
      );
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

    this.dataCache.set(guildId, guildData);
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
    let guildData = this.dataCache.get(guildId);

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
    const guildData = this.dataCache.get(guildId);

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
    const guildData = this.dataCache.get(guildId);

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
    const guildData = this.dataCache.get(guildId);
    return guildData?.autoresponders.get(trigger);
  }

  getGuildAutoresponders(guildId: string): Map<string, Autoresponder> {
    const guildData = this.dataCache.get(guildId);
    return guildData?.autoresponders || new Map();
  }

  checkMessage(
    guildId: string,
    messageContent: string
  ): Autoresponder | undefined {
    const guildData = this.dataCache.get(guildId);

    if (!guildData) {
      return undefined;
    }

    const lowerContent = messageContent.toLowerCase();

    for (const [trigger, autoresponder] of guildData.autoresponders) {
      if (!autoresponder.enabled) continue;

      const matchMode = autoresponder.matchMode || 'default';
      const lowerTrigger = trigger.toLowerCase();

      let matches = false;

      switch (matchMode) {
        case 'exact':
          matches = messageContent === trigger;
          break;

        case 'contains':
          try {
            const wordRegex = new RegExp(
              `\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
              'i'
            );
            matches = wordRegex.test(messageContent);
          } catch (error) {
            logger.error(`error in contains match for trigger: ${trigger}`);
            matches = false;
          }
          break;

        case 'startswith':
          matches =
            lowerContent === lowerTrigger ||
            lowerContent.startsWith(lowerTrigger + ' ');
          break;

        case 'endswith':
          matches =
            lowerContent === lowerTrigger ||
            lowerContent.endsWith(' ' + lowerTrigger);
          break;

        case 'default':
          matches = lowerContent === lowerTrigger;
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
    matchMode: 'exact' | 'contains' | 'startswith' | 'endswith' | 'default'
  ): { success: boolean; message: string } {
    const guildData = this.dataCache.get(guildId);

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

  getStats(): {
    totalGuilds: number;
    totalAutoresponders: number;
    enabledAutoresponders: number;
  } {
    let totalAutoresponders = 0;
    let enabledAutoresponders = 0;

    for (const guildData of this.dataCache.values()) {
      totalAutoresponders += guildData.autoresponders.size;

      for (const autoresponder of guildData.autoresponders.values()) {
        if (autoresponder.enabled) {
          enabledAutoresponders++;
        }
      }
    }

    return {
      totalGuilds: this.dataCache.size,
      totalAutoresponders,
      enabledAutoresponders,
    };
  }
}
