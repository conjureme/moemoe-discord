import { Events, VoiceState } from 'discord.js';
import { Event } from '../types/discord';
import { VoiceConnectionManager } from '../services/voice/VoiceConnectionManager';

import { logger } from '../utils/logger';

const voiceStateUpdate: Event = {
  name: Events.VoiceStateUpdate,
  once: false,

  async execute(oldState: VoiceState, newState: VoiceState) {
    const voiceManager = VoiceConnectionManager.getInstance();

    if (newState.member?.user.bot) return;

    const guildId = newState.guild.id;
    const userId = newState.member!.user.id;
    const botUserId = newState.client.user!.id;

    const connectionInfo = voiceManager.getConnection(guildId);
    if (!connectionInfo) return;

    const botChannelId = connectionInfo.channel.id;

    if (
      newState.channelId === botChannelId &&
      oldState.channelId !== botChannelId
    ) {
      voiceManager.startListeningToUser(guildId, userId);
      logger.info(
        `started listening to ${newState.member!.user.username} who joined ${connectionInfo.channel.name}`
      );
    }

    if (
      oldState.channelId === botChannelId &&
      newState.channelId !== botChannelId
    ) {
      voiceManager.stopListeningToUser(guildId, userId);
      logger.info(
        `stopped listening to ${oldState.member!.user.username} who left ${connectionInfo.channel.name}`
      );
    }
  },
};

export default voiceStateUpdate;
