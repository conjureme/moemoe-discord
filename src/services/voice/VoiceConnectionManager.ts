import { VoiceChannel, StageChannel } from 'discord.js';

import {
  VoiceConnection,
  AudioPlayer,
  createAudioPlayer,
  NoSubscriberBehavior,
} from '@discordjs/voice';

import { VoiceCaptureService } from './VoiceCaptureService';
import { logger } from '../../utils/logger';

interface VoiceConnectionInfo {
  connection: VoiceConnection;
  channel: VoiceChannel | StageChannel;
  audioPlayer: AudioPlayer;
  joinedAt: Date;
  captureEnabled: boolean;
  listeningTo: Set<string>; // user IDs
}

export class VoiceConnectionManager {
  private static instance: VoiceConnectionManager;
  private connections: Map<string, VoiceConnectionInfo> = new Map();
  private voiceCapture: VoiceCaptureService;

  private constructor() {
    this.voiceCapture = VoiceCaptureService.getInstance();
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
      captureEnabled: false,
      listeningTo: new Set(),
    });

    logger.debug(`stored voice connection for guild ${guildId}`);
  }

  startListeningToUser(guildId: string, userId: string): boolean {
    const info = this.connections.get(guildId);
    if (!info) {
      logger.warn(`no connection found for guild ${guildId}`);
      return false;
    }

    if (info.listeningTo.has(userId)) {
      logger.debug(`already listening to user ${userId}`);
      return true;
    }

    this.voiceCapture.startListening(info.connection, userId);
    info.listeningTo.add(userId);
    info.captureEnabled = true;

    logger.info(`started voice capture for user ${userId} in guild ${guildId}`);
    return true;
  }

  stopListeningToUser(guildId: string, userId: string): boolean {
    const info = this.connections.get(guildId);
    if (!info) {
      return false;
    }

    if (!info.listeningTo.has(userId)) {
      return false;
    }

    this.voiceCapture.stopListening(userId);
    info.listeningTo.delete(userId);

    if (info.listeningTo.size === 0) {
      info.captureEnabled = false;
    }

    logger.info(`stopped voice capture for user ${userId} in guild ${guildId}`);
    return true;
  }

  stopAllListening(guildId: string): void {
    const info = this.connections.get(guildId);
    if (!info) return;

    for (const userId of info.listeningTo) {
      this.voiceCapture.stopListening(userId);
    }

    info.listeningTo.clear();
    info.captureEnabled = false;

    logger.info(`stopped all voice capture in guild ${guildId}`);
  }

  getConnection(guildId: string): VoiceConnectionInfo | undefined {
    return this.connections.get(guildId);
  }

  removeConnection(guildId: string): void {
    const info = this.connections.get(guildId);
    if (info) {
      this.stopAllListening(guildId);

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

  isListeningToUser(guildId: string, userId: string): boolean {
    const info = this.connections.get(guildId);
    return info ? info.listeningTo.has(userId) : false;
  }

  getListeningUsers(guildId: string): string[] {
    const info = this.connections.get(guildId);
    return info ? Array.from(info.listeningTo) : [];
  }

  // cleanup all connections
  cleanup(): void {
    for (const [guildId, info] of this.connections) {
      this.stopAllListening(guildId);
      info.audioPlayer.stop();
      info.connection.destroy();
    }
    this.connections.clear();
    this.voiceCapture.cleanup();
    logger.debug('cleaned up all voice connections');
  }

  getStats(): {
    totalConnections: number;
    connections: Array<{
      guildId: string;
      channelName: string;
      memberCount: number;
      duration: number;
      captureEnabled: boolean;
      listeningToCount: number;
    }>;
  } {
    const connections: Array<{
      guildId: string;
      channelName: string;
      memberCount: number;
      duration: number;
      captureEnabled: boolean;
      listeningToCount: number;
    }> = [];
    const now = new Date();

    for (const [guildId, info] of this.connections) {
      connections.push({
        guildId,
        channelName: info.channel.name,
        memberCount: info.channel.members.size,
        duration: now.getTime() - info.joinedAt.getTime(),
        captureEnabled: info.captureEnabled,
        listeningToCount: info.listeningTo.size,
      });
    }

    return {
      totalConnections: this.connections.size,
      connections,
    };
  }
}
