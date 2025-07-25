import { Events, Client } from 'discord.js';
import { Event } from '../types/discord';
import { VoiceCaptureService } from '../services/voice/VoiceCaptureService';

import { logger } from '../utils/logger';

const ready: Event = {
  name: Events.ClientReady,
  once: true,

  async execute(client: Client) {
    if (!client.user) return;

    logger.success(`bot is online as ${client.user.tag}`);
    logger.info(`serving ${client.guilds.cache.size} guilds`);

    const voiceCapture = VoiceCaptureService.getInstance();
    voiceCapture.initialize(client);
    logger.info('initialized voice capture service');
  },
};

export default ready;
