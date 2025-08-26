import { Guild } from 'discord.js';

export class EmbedPlaceholderProcessor {
  static async processPlaceholders(
    text: string,
    guild: Guild | null
  ): Promise<string> {
    if (!text) return text;

    let processed = text;

    if (guild) {
      processed = processed.replace(/\{server_name\}/gi, guild.name);
      processed = processed.replace(/\{server_id\}/gi, guild.id);
      processed = processed.replace(
        /\{server_membercount\}/gi,
        guild.memberCount.toString()
      );
      processed = processed.replace(/\{server_owner_id\}/gi, guild.ownerId);

      const iconUrl = guild.iconURL({ size: 256 });
      processed = processed.replace(/\{server_icon\}/gi, iconUrl || '');

      const createTimestamp = Math.floor(guild.createdTimestamp / 1000);
      processed = processed.replace(
        /\{server_createdate\}/gi,
        `<t:${createTimestamp}:F>`
      );
    }

    const nowTimestamp = Math.floor(Date.now() / 1000);
    processed = processed.replace(/\{date\}/gi, `<t:${nowTimestamp}:F>`);

    return processed;
  }

  static containsPlaceholders(text: string): boolean {
    if (!text) return false;

    const placeholderPattern =
      /\{(server_name|server_id|server_membercount|server_owner_id|server_icon|server_createdate|date)\}/i;
    return placeholderPattern.test(text);
  }
}
