import { GuildDataService } from '../base/GuildDataService';

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

export class GreetService extends GuildDataService<GuildGreeting> {
  constructor() {
    super('greetings');
  }

  protected getServiceName(): string {
    return 'greetings';
  }

  setGreeting(
    guildId: string,
    guildName: string,
    message: string,
    userId: string
  ): { success: boolean; message: string } {
    const existing = this.dataCache.get(guildId);

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

    this.dataCache.set(guildId, greeting);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'greeting message set successfully',
    };
  }

  removeGreeting(guildId: string): { success: boolean; message: string } {
    if (!this.dataCache.has(guildId)) {
      return {
        success: false,
        message: 'no greeting configured for this server',
      };
    }

    this.deleteGuildData(guildId);

    return {
      success: true,
      message: 'greeting removed successfully',
    };
  }

  getGreeting(guildId: string): GuildGreeting | undefined {
    return this.dataCache.get(guildId);
  }
}
