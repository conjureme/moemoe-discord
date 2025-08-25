import { BaseProcessor, ProcessorContext } from './Base';
import { serviceManager } from '../../ServiceManager';

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

      // store embed data in metadata for main processor to handle
      if (!context.metadata) {
        context.metadata = {};
      }

      if (!context.metadata.embeds) {
        context.metadata.embeds = [];
      }

      context.metadata.embeds.push({
        data: storedEmbed.data,
        position: match.index || 0, // track position in original text
      });

      // return a placeholder that we'll use to track position
      return `{{EMBED_${context.metadata.embeds.length - 1}}}`;
    } catch (error) {
      logger.error(`error processing embed placeholder ${embedName}:`, error);
      return match[0];
    }
  }
}
