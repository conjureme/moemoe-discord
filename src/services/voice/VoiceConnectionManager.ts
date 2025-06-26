import { VoiceChannel, StageChannel } from 'discord.js';

import {
  VoiceConnection,
  AudioPlayer,
  createAudioPlayer,
  NoSubscriberBehavior,
} from '@discordjs/voice';

import { logger } from '../../utils/logger';

interface VoiceConnectionInfo {
  connection: VoiceConnection;
  channel: VoiceChannel | StageChannel;
  audioPlayer: AudioPlayer;
  joinedAt: Date;
}

export class VoiceConnectionManager {
  private static instance: VoiceConnectionManager;
  private connections: Map<string, VoiceConnectionInfo> = new Map();

  private constructor() {
    // singleton
  }

  public static getInstance(): VoiceConnectionManager {
    if (!VoiceConnectionManager.instance) {
      VoiceConnectionManager.instance = new VoiceConnectionManager();
      logger.debug('created VoiceConnectionManager instance');
    }
    return VoiceConnectionManager.instance;
  }

  setConnection(
    guildId: string,
    connection: VoiceConnection,
    channel: VoiceChannel | StageChannel
  ): void {
    // create audio player for this connection
    const audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    connection.subscribe(audioPlayer);

    // handle connection state changes
    connection.on('stateChange', (oldState, newState) => {
      logger.debug(
        `voice connection state change in ${guildId}: ${oldState.status} -> ${newState.status}`
      );
    });

    connection.on('error', (error) => {
      logger.error(`voice connection error in ${guildId}:`, error);
      this.removeConnection(guildId);
    });

    this.connections.set(guildId, {
      connection,
      channel,
      audioPlayer,
      joinedAt: new Date(),
    });

    logger.debug(`stored voice connection for guild ${guildId}`);
  }

  getConnection(guildId: string): VoiceConnectionInfo | undefined {
    return this.connections.get(guildId);
  }

  removeConnection(guildId: string): void {
    const info = this.connections.get(guildId);
    if (info) {
      info.audioPlayer.stop();
      info.connection.destroy();
      this.connections.delete(guildId);
      logger.debug(`removed voice connection for guild ${guildId}`);
    }
  }

  getAudioPlayer(guildId: string): AudioPlayer | undefined {
    return this.connections.get(guildId)?.audioPlayer;
  }

  isInVoiceChannel(guildId: string): boolean {
    return this.connections.has(guildId);
  }

  getVoiceChannel(guildId: string): VoiceChannel | StageChannel | undefined {
    return this.connections.get(guildId)?.channel;
  }

  // cleanup all connections
  cleanup(): void {
    for (const [guildId, info] of this.connections) {
      info.audioPlayer.stop();
      info.connection.destroy();
    }
    this.connections.clear();
    logger.debug('cleaned up all voice connections');
  }

  getStats(): {
    totalConnections: number;
    connections: Array<{
      guildId: string;
      channelName: string;
      memberCount: number;
      duration: number;
    }>;
  } {
    const connections: Array<{
      guildId: string;
      channelName: string;
      memberCount: number;
      duration: number;
    }> = [];
    const now = new Date();

    for (const [guildId, info] of this.connections) {
      connections.push({
        guildId,
        channelName: info.channel.name,
        memberCount: info.channel.members.size,
        duration: now.getTime() - info.joinedAt.getTime(),
      });
    }

    return {
      totalConnections: this.connections.size,
      connections,
    };
  }
}
