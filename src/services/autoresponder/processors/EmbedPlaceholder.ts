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
      if (!embedName || embedName.trim() === '') {
        logger.warn(`embed name cannot be empty in ${match[0]}`);
        return match[0];
      }

      if (!context.guild) {
        logger.warn('embed placeholder used outside of guild context');
        return match[0];
      }

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

      await this.processEmbedPlaceholders(embedData, context);

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

      if (embedData.author.icon_url && context.processNested) {
        const processedIconUrl = await context.processNested(
          embedData.author.icon_url
        );

        if (processedIconUrl && processedIconUrl.trim()) {
          try {
            new URL(processedIconUrl);
            embedData.author.icon_url = processedIconUrl;
          } catch {
            logger.debug(
              `removing invalid author icon URL after processing: ${processedIconUrl}`
            );
            delete embedData.author.icon_url;
          }
        } else {
          delete embedData.author.icon_url;
        }
      }

      if (embedData.author.url && context.processNested) {
        const processedUrl = await context.processNested(embedData.author.url);

        if (processedUrl && processedUrl.trim()) {
          try {
            new URL(processedUrl);
            embedData.author.url = processedUrl;
          } catch {
            logger.debug(
              `removing invalid author URL after processing: ${processedUrl}`
            );
            delete embedData.author.url;
          }
        } else {
          delete embedData.author.url;
        }
      }
    }

    if (embedData.footer) {
      if (embedData.footer.text && context.processNested) {
        embedData.footer.text = await context.processNested(
          embedData.footer.text
        );
      }

      if (embedData.footer.icon_url && context.processNested) {
        const processedIconUrl = await context.processNested(
          embedData.footer.icon_url
        );

        if (processedIconUrl && processedIconUrl.trim()) {
          try {
            new URL(processedIconUrl);
            embedData.footer.icon_url = processedIconUrl;
          } catch {
            logger.debug(
              `removing invalid footer icon URL after processing: ${processedIconUrl}`
            );
            delete embedData.footer.icon_url;
          }
        } else {
          delete embedData.footer.icon_url;
        }
      }
    }

    if (embedData.image?.url && context.processNested) {
      const processedUrl = await context.processNested(embedData.image.url);

      if (processedUrl && processedUrl.trim()) {
        try {
          new URL(processedUrl);
          embedData.image.url = processedUrl;
        } catch {
          logger.debug(
            `removing invalid image URL after processing: ${processedUrl}`
          );
          delete embedData.image;
        }
      } else {
        delete embedData.image;
      }
    }

    if (embedData.thumbnail?.url && context.processNested) {
      const processedUrl = await context.processNested(embedData.thumbnail.url);

      if (processedUrl && processedUrl.trim()) {
        try {
          new URL(processedUrl);
          embedData.thumbnail.url = processedUrl;
        } catch {
          logger.debug(
            `removing invalid thumbnail URL after processing: ${processedUrl}`
          );
          delete embedData.thumbnail;
        }
      } else {
        delete embedData.thumbnail;
      }
    }

    if (embedData.url && context.processNested) {
      const processedUrl = await context.processNested(embedData.url);

      if (processedUrl && processedUrl.trim()) {
        try {
          new URL(processedUrl);
          embedData.url = processedUrl;
        } catch {
          logger.debug(
            `removing invalid embed URL after processing: ${processedUrl}`
          );
          delete embedData.url;
        }
      } else {
        delete embedData.url;
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
