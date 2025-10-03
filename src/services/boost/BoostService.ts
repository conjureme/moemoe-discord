import { GuildDataService } from '../base/GuildDataService';

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

export class BoostService extends GuildDataService<GuildBoostMessage> {
  constructor() {
    super('boosts');
  }

  protected getServiceName(): string {
    return 'boost messages';
  }

  setBoostMessage(
    guildId: string,
    guildName: string,
    message: string,
    userId: string
  ): { success: boolean; message: string } {
    const existing = this.dataCache.get(guildId);

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

    this.dataCache.set(guildId, boostMessage);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'boost message set successfully',
    };
  }

  removeBoostMessage(guildId: string): { success: boolean; message: string } {
    if (!this.dataCache.has(guildId)) {
      return {
        success: false,
        message: 'no boost message configured for this server',
      };
    }

    this.deleteGuildData(guildId);

    return {
      success: true,
      message: 'boost message removed successfully',
    };
  }

  getBoostMessage(guildId: string): GuildBoostMessage | undefined {
    return this.dataCache.get(guildId);
  }

  getStats(): {
    totalGuilds: number;
    enabledBoostMessages: number;
  } {
    let enabledCount = 0;

    for (const boostMessage of this.dataCache.values()) {
      if (boostMessage.enabled) {
        enabledCount++;
      }
    }

    return {
      totalGuilds: this.dataCache.size,
      enabledBoostMessages: enabledCount,
    };
  }
}
