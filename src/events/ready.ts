import { Events, Client } from 'discord.js';
import { Event } from '../types/discord';
import { logger } from '../utils/logger';

const ready: Event = {
  name: Events.ClientReady,
  once: true,

  async execute(client: Client) {
    if (!client.user) return;

    logger.success(`bot is online as ${client.user.tag}`);
    logger.info(`serving ${client.guilds.cache.size} guilds`);
  },
};

export default ready;
