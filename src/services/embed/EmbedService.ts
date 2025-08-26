import * as fs from 'fs';
import * as path from 'path';

import { EmbedBuilder, APIEmbed } from 'discord.js';

import { logger } from '../../utils/logger';

export interface StoredEmbed {
  name: string;
  guildId: string;
  data: APIEmbed;
  createdBy: string;
  createdAt: string;
  lastModified: string;
  lastModifiedBy: string;
}

export interface GuildEmbeds {
  guildId: string;
  guildName: string;
  embeds: Map<string, StoredEmbed>;
}

export class EmbedService {
  private dataPath: string;
  private guildCache: Map<string, GuildEmbeds> = new Map();
  private saveQueue: Set<string> = new Set();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'embeds');
    this.ensureDirectories();
    this.loadAllEmbeds();
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

  private loadAllEmbeds(): void {
    try {
      const guildsDir = path.join(this.dataPath, 'guilds');
      if (fs.existsSync(guildsDir)) {
        const files = fs
          .readdirSync(guildsDir)
          .filter((f) => f.endsWith('.json'));

        for (const file of files) {
          const guildId = file.replace('.json', '');
          this.loadGuildEmbeds(guildId);
        }
      }

      logger.info(`loaded embeds for ${this.guildCache.size} guilds`);
    } catch (error) {
      logger.error('error loading embeds:', error);
    }
  }

  private loadGuildEmbeds(guildId: string): void {
    try {
      const filePath = path.join(this.dataPath, 'guilds', `${guildId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // convert embeds object back to Map
        const embeds = new Map<string, StoredEmbed>();
        if (data.embeds) {
          for (const [name, embed] of Object.entries(data.embeds)) {
            embeds.set(name, embed as StoredEmbed);
          }
        }

        this.guildCache.set(guildId, {
          ...data,
          embeds,
        });
      }
    } catch (error) {
      logger.error(`error loading embeds for guild ${guildId}:`, error);
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
      this.saveGuildEmbeds(guildId);
    }
    this.saveQueue.clear();
    this.saveTimer = null;
  }

  private saveGuildEmbeds(guildId: string): void {
    const guildData = this.guildCache.get(guildId);
    if (!guildData) return;

    try {
      // convert Map to object for JSON serialization
      const dataToSave = {
        ...guildData,
        embeds: Object.fromEntries(guildData.embeds),
      };

      const filePath = path.join(this.dataPath, 'guilds', `${guildId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      logger.debug(`saved embeds for guild ${guildId}`);
    } catch (error) {
      logger.error(`error saving embeds for guild ${guildId}:`, error);
    }
  }

  private initializeGuildEmbeds(
    guildId: string,
    guildName: string
  ): GuildEmbeds {
    const guildData: GuildEmbeds = {
      guildId,
      guildName,
      embeds: new Map(),
    };

    this.guildCache.set(guildId, guildData);
    this.queueSave(guildId);

    logger.info(`initialized embeds for guild ${guildId}`);
    return guildData;
  }

  // public methods

  createEmbed(
    guildId: string,
    guildName: string,
    name: string,
    userId: string,
    embedData?: APIEmbed
  ): { success: boolean; message: string } {
    let guildData = this.guildCache.get(guildId);

    if (!guildData) {
      guildData = this.initializeGuildEmbeds(guildId, guildName);
    }

    // check if embed name already exists
    if (guildData.embeds.has(name)) {
      return {
        success: false,
        message: 'an embed with this name already exists',
      };
    }

    const storedEmbed: StoredEmbed = {
      name,
      guildId,
      data: embedData || {
        description: 'new embed - use the buttons below to edit!',
        color: 0xfaf0e7,
      },
      createdBy: userId,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId,
    };

    guildData.embeds.set(name, storedEmbed);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'embed created successfully',
    };
  }

  updateEmbed(
    guildId: string,
    name: string,
    embedData: APIEmbed,
    userId: string
  ): { success: boolean; message: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no embeds configured for this guild',
      };
    }

    const embed = guildData.embeds.get(name);
    if (!embed) {
      return {
        success: false,
        message: 'embed not found',
      };
    }

    embed.data = embedData;
    embed.lastModified = new Date().toISOString();
    embed.lastModifiedBy = userId;
    this.queueSave(guildId);

    return {
      success: true,
      message: 'embed updated successfully',
    };
  }

  updateEmbedField(
    guildId: string,
    name: string,
    field: keyof APIEmbed,
    value: any,
    userId: string
  ): { success: boolean; message: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no embeds configured for this guild',
      };
    }

    const embed = guildData.embeds.get(name);
    if (!embed) {
      return {
        success: false,
        message: 'embed not found',
      };
    }

    // handle special cases for nested properties
    if (
      field === 'author' ||
      field === 'footer' ||
      field === 'image' ||
      field === 'thumbnail'
    ) {
      (embed.data as any)[field] = value;
    } else {
      (embed.data as any)[field] = value;
    }

    embed.lastModified = new Date().toISOString();
    embed.lastModifiedBy = userId;
    this.queueSave(guildId);

    return {
      success: true,
      message: `embed ${field} updated successfully`,
    };
  }

  addEmbedField(
    guildId: string,
    name: string,
    fieldData: { name: string; value: string; inline?: boolean },
    userId: string
  ): { success: boolean; message: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no embeds configured for this guild',
      };
    }

    const embed = guildData.embeds.get(name);
    if (!embed) {
      return {
        success: false,
        message: 'embed not found',
      };
    }

    if (!embed.data.fields) {
      embed.data.fields = [];
    }

    if (embed.data.fields.length >= 25) {
      return {
        success: false,
        message: 'embeds can have a maximum of 25 fields',
      };
    }

    embed.data.fields.push(fieldData);
    embed.lastModified = new Date().toISOString();
    embed.lastModifiedBy = userId;
    this.queueSave(guildId);

    return {
      success: true,
      message: 'field added successfully',
    };
  }

  removeEmbedField(
    guildId: string,
    name: string,
    fieldIndex: number,
    userId: string
  ): { success: boolean; message: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no embeds configured for this guild',
      };
    }

    const embed = guildData.embeds.get(name);
    if (!embed) {
      return {
        success: false,
        message: 'embed not found',
      };
    }

    if (!embed.data.fields || embed.data.fields.length <= fieldIndex) {
      return {
        success: false,
        message: 'field not found',
      };
    }

    embed.data.fields.splice(fieldIndex, 1);
    embed.lastModified = new Date().toISOString();
    embed.lastModifiedBy = userId;
    this.queueSave(guildId);

    return {
      success: true,
      message: 'field removed successfully',
    };
  }

  removeEmbed(
    guildId: string,
    name: string
  ): { success: boolean; message: string } {
    const guildData = this.guildCache.get(guildId);

    if (!guildData) {
      return {
        success: false,
        message: 'no embeds configured for this guild',
      };
    }

    if (!guildData.embeds.has(name)) {
      return {
        success: false,
        message: 'embed not found',
      };
    }

    guildData.embeds.delete(name);
    this.queueSave(guildId);

    return {
      success: true,
      message: 'embed removed successfully',
    };
  }

  getEmbed(guildId: string, name: string): StoredEmbed | undefined {
    const guildData = this.guildCache.get(guildId);
    return guildData?.embeds.get(name);
  }

  getGuildEmbeds(guildId: string): Map<string, StoredEmbed> {
    const guildData = this.guildCache.get(guildId);
    return guildData?.embeds || new Map();
  }

  buildDiscordEmbed(storedEmbed: StoredEmbed): EmbedBuilder {
    return EmbedBuilder.from(storedEmbed.data);
  }

  buildDiscordEmbedWithPlaceholders(
    storedEmbed: StoredEmbed,
    guild?: any
  ): EmbedBuilder {
    const processedData = JSON.parse(JSON.stringify(storedEmbed.data));

    return EmbedBuilder.from(processedData);
  }

  validateEmbedUrls(embedData: APIEmbed): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const isValidUrl = (url: string | undefined): boolean => {
      if (!url) return true; // empty is valid

      if (url.includes('{') && url.includes('}')) {
        return true; // we'll validate after processing
      }

      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    if (embedData.url && !isValidUrl(embedData.url)) {
      errors.push('Invalid URL in embed URL field');
    }

    if (embedData.author?.icon_url && !isValidUrl(embedData.author.icon_url)) {
      errors.push('Invalid URL in author icon');
    }

    if (embedData.author?.url && !isValidUrl(embedData.author.url)) {
      errors.push('Invalid URL in author URL');
    }

    if (embedData.thumbnail?.url && !isValidUrl(embedData.thumbnail.url)) {
      errors.push('Invalid URL in thumbnail');
    }

    if (embedData.image?.url && !isValidUrl(embedData.image.url)) {
      errors.push('Invalid URL in image');
    }

    if (embedData.footer?.icon_url && !isValidUrl(embedData.footer.icon_url)) {
      errors.push('Invalid URL in footer icon');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // cleanup method for graceful shutdown
  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.processSaveQueue();
    }
    logger.debug('embed service cleaned up');
  }

  // stats methods
  getStats(): {
    totalGuilds: number;
    totalEmbeds: number;
  } {
    let totalEmbeds = 0;

    for (const guildData of this.guildCache.values()) {
      totalEmbeds += guildData.embeds.size;
    }

    return {
      totalGuilds: this.guildCache.size,
      totalEmbeds,
    };
  }
}
