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
    const embedName = match[1];

    try {
      if (!context.guild) {
        logger.warn('embed placeholder used outside of guild context');
        return match[0];
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

      // mark that we're using a stored embed
      context.metadata.useStoredEmbed = true;
      context.metadata.storedEmbedData = storedEmbed.data;

      // return empty string since the embed will replace the entire message
      return '';
    } catch (error) {
      logger.error(`error processing embed placeholder ${embedName}:`, error);
      return match[0];
    }
  }
}
