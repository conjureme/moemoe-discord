import { BaseProcessor, ProcessorContext } from './Base';
import { serviceManager } from '../../ServiceManager';
import { APIEmbed } from 'discord.js';
import { logger } from '../../../utils/logger';

export class EmbedPlaceholderProcessor extends BaseProcessor {
  name = 'embed-placeholder';
  pattern = /\{embed:([^}]+)\}/gi;

  async process(
    match: RegExpMatchArray,
    context: ProcessorContext
  ): Promise<string> {
    let embedName = match[1];

    try {
      if (!context.guild) {
        logger.warn('embed placeholder used outside of guild context');
        return match[0];
      }

      // process nested placeholders in the embed name
      if (context.processNested) {
        embedName = await context.processNested(embedName);
      }

      const embedService = serviceManager.getEmbedService();
      const storedEmbed = embedService.getEmbed(context.guild.id, embedName);

      if (!storedEmbed) {
        logger.warn(
          `embed "${embedName}" not found in guild ${context.guild.id}`
        );
        return match[0];
      }

      const embedData = JSON.parse(
        JSON.stringify(storedEmbed.data)
      ) as APIEmbed;

      if (context.processNested) {
        await this.processEmbedPlaceholders(embedData, context);
      }

      if (!context.metadata) {
        context.metadata = {};
      }

      if (!context.metadata.embeds) {
        context.metadata.embeds = [];
      }

      context.metadata.embeds.push({
        data: embedData,
        position: match.index || 0,
      });

      // return a placeholder that we'll use to track position
      return `{{EMBED_${context.metadata.embeds.length - 1}}}`;
    } catch (error) {
      logger.error(`error processing embed placeholder ${embedName}:`, error);
      return match[0];
    }
  }

  private async processEmbedPlaceholders(
    embedData: APIEmbed,
    context: ProcessorContext
  ): Promise<void> {
    //
    if (embedData.title && context.processNested) {
      embedData.title = await context.processNested(embedData.title);
    }

    if (embedData.description && context.processNested) {
      embedData.description = await context.processNested(
        embedData.description
      );
    }

    if (embedData.author) {
      if (embedData.author.name && context.processNested) {
        embedData.author.name = await context.processNested(
          embedData.author.name
        );
      }
    }

    if (embedData.footer) {
      if (embedData.footer.text && context.processNested) {
        embedData.footer.text = await context.processNested(
          embedData.footer.text
        );
      }
    }

    if (embedData.fields && Array.isArray(embedData.fields)) {
      for (const field of embedData.fields) {
        if (field.name && context.processNested) {
          field.name = await context.processNested(field.name);
        }
        if (field.value && context.processNested) {
          field.value = await context.processNested(field.value);
        }
      }
    }
  }
}
