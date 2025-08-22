import { VoiceConnection, EndBehaviorType } from '@discordjs/voice';

import prism from 'prism-media';
import { VoiceTranscriptHandler } from './VoiceTranscriptHandler';
import { Client } from 'discord.js';

import { logger } from '../../utils/logger';

interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  error?: string;
}

interface UserAudioBuffer {
  userId: string;
  pcmChunks: Buffer[];
  lastActivity: number;
  isActive: boolean;
}

interface ActiveListener {
  userId: string;
  connection: VoiceConnection;
  isListening: boolean;
}

export class VoiceCaptureService {
  private static instance: VoiceCaptureService;
  private userBuffers: Map<string, UserAudioBuffer> = new Map();
  private activeListeners: Map<string, ActiveListener> = new Map();
  private apiUrl: string;
  private silenceTimeout: number = 300;
  private minAudioLength: number = 50;
  private sampleRate: number = 48000;
  private channels: number = 2;
  private transcriptHandler: VoiceTranscriptHandler | null = null;

  public initialize(client: Client): void {
    this.transcriptHandler = new VoiceTranscriptHandler(client);
    logger.debug('initialized voice transcription handler');
  }

  private constructor() {
    this.apiUrl = process.env.API_URL || 'http://localhost:5001';
  }

  public static getInstance(): VoiceCaptureService {
    if (!VoiceCaptureService.instance) {
      VoiceCaptureService.instance = new VoiceCaptureService();
    }
    return VoiceCaptureService.instance;
  }

  startListening(connection: VoiceConnection, userId: string): void {
    this.activeListeners.set(userId, {
      userId,
      connection,
      isListening: true,
    });

    logger.info(`started continuous listening for user ${userId}`);

    this.subscribeToUser(connection, userId);
  }

  private subscribeToUser(connection: VoiceConnection, userId: string): void {
    const listener = this.activeListeners.get(userId);
    if (!listener || !listener.isListening) {
      logger.debug(
        `stopping subscription for user ${userId} - no longer active`
      );
      return;
    }

    const receiver = connection.receiver;

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: this.silenceTimeout,
      },
    });

    logger.debug(`subscribed to audio stream for user ${userId}`);

    this.userBuffers.set(userId, {
      userId,
      pcmChunks: [],
      lastActivity: Date.now(),
      isActive: true,
    });

    const opusDecoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: this.channels,
      rate: this.sampleRate,
    });

    const pcmStream = opusStream.pipe(opusDecoder);

    // collect PCM data
    pcmStream.on('data', (chunk: Buffer) => {
      const userBuffer = this.userBuffers.get(userId);
      if (userBuffer) {
        userBuffer.pcmChunks.push(chunk);
        userBuffer.lastActivity = Date.now();
      }
    });

    pcmStream.on('end', async () => {
      logger.debug(`audio stream ended for user ${userId}`);

      await this.processUserAudio(userId);

      const listener = this.activeListeners.get(userId);
      if (listener && listener.isListening) {
        logger.debug(`re-subscribing to user ${userId} after processing`);

        setTimeout(() => {
          this.subscribeToUser(connection, userId);
        }, 100);
      }
    });

    pcmStream.on('error', (error) => {
      logger.error(`error in audio stream for user ${userId}:`, error);
      this.cleanupUserBuffer(userId);

      // try to re-subscribe if still active
      const listener = this.activeListeners.get(userId);
      if (listener && listener.isListening) {
        setTimeout(() => {
          this.subscribeToUser(connection, userId);
        }, 1000);
      }
    });
  }

  stopListening(userId: string): void {
    logger.info(`stopped listening to user ${userId}`);

    const listener = this.activeListeners.get(userId);
    if (listener) {
      listener.isListening = false;
    }

    // clean up
    this.activeListeners.delete(userId);
    this.cleanupUserBuffer(userId);
  }

  private async processUserAudio(userId: string): Promise<void> {
    const userBuffer = this.userBuffers.get(userId);
    if (!userBuffer || userBuffer.pcmChunks.length === 0) {
      logger.debug(`no audio data for user ${userId}`);
      return;
    }

    try {
      const pcmBuffer = Buffer.concat(userBuffer.pcmChunks);

      const audioDuration = this.calculatePCMDuration(pcmBuffer);
      if (audioDuration < this.minAudioLength) {
        logger.debug(`audio too short for user ${userId}: ${audioDuration}ms`);
        this.cleanupUserBuffer(userId);
        return;
      }

      logger.info(`processing ${audioDuration}ms of audio for user ${userId}`);

      const wavBuffer = this.pcmToWav(pcmBuffer);

      const base64Audio = `data:audio/wav;base64,${wavBuffer.toString('base64')}`;

      const transcription = await this.transcribeAudio(base64Audio);

      if (transcription.text && transcription.text.trim().length > 0) {
        logger.info(`transcription for ${userId}: "${transcription.text}"`);

        // emit event for the bot to handle
        this.emitTranscription(userId, transcription.text);
      }
    } catch (error) {
      logger.error(`error processing audio for user ${userId}:`, error);
    } finally {
      this.cleanupUserBuffer(userId);
    }
  }

  private pcmToWav(pcmBuffer: Buffer): Buffer {
    // WAV header for 48kHz stereo 16-bit PCM
    const byteRate = this.sampleRate * this.channels * 2; // 2 bytes per sample (16-bit)
    const blockAlign = this.channels * 2;
    const dataSize = pcmBuffer.length;
    const fileSize = dataSize + 44 - 8; // total file size minus RIFF header

    const wavBuffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(fileSize, 4);
    wavBuffer.write('WAVE', 8);

    // fmt subchunk
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16); // subchunk size
    wavBuffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
    wavBuffer.writeUInt16LE(this.channels, 22); // number of channels
    wavBuffer.writeUInt32LE(this.sampleRate, 24); // sample rate
    wavBuffer.writeUInt32LE(byteRate, 28); // byte rate
    wavBuffer.writeUInt16LE(blockAlign, 32); // block align
    wavBuffer.writeUInt16LE(16, 34); // bits per sample

    // data subchunk
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);

    pcmBuffer.copy(wavBuffer, 44);

    return wavBuffer;
  }

  private calculatePCMDuration(pcmBuffer: Buffer): number {
    const bytesPerSecond = this.sampleRate * this.channels * 2;
    return (pcmBuffer.length / bytesPerSecond) * 1000;
  }

  private async transcribeAudio(
    base64Audio: string
  ): Promise<TranscriptionResult> {
    try {
      const requestBody = {
        audio_data: base64Audio,
        prompt: '',
        suppress_non_speech: false,
        langcode: 'auto',
      };

      const response = await fetch(`${this.apiUrl}/api/extra/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`transcription failed: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        text: result.text || result.transcription || '',
        confidence: result.confidence,
        language: result.language || result.detected_language,
      };
    } catch (error) {
      logger.error('transcription error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }

  private cleanupUserBuffer(userId: string): void {
    this.userBuffers.delete(userId);
  }

  private emitTranscription(userId: string, text: string): void {
    if (!this.transcriptHandler) {
      logger.error('transcription handler not initialized');
      return;
    }

    const listener = this.activeListeners.get(userId);
    if (!listener) {
      logger.error(`no active listener found for user ${userId}`);
      return;
    }

    const guildId = listener.connection.joinConfig.guildId;
    const channelId = listener.connection.joinConfig.channelId;

    this.transcriptHandler.handleTranscription(
      userId,
      guildId,
      channelId!,
      text
    );
  }

  isActivelyListening(userId: string): boolean {
    const listener = this.activeListeners.get(userId);
    return listener ? listener.isListening : false;
  }

  getStats(): {
    activeListeners: number;
    activeBuffers: number;
    listenerDetails: Array<{
      userId: string;
      isListening: boolean;
    }>;
    bufferDetails: Array<{
      userId: string;
      audioLength: number;
      lastActivity: number;
    }>;
  } {
    const listenerDetails: Array<{
      userId: string;
      isListening: boolean;
    }> = [];

    for (const [userId, listener] of this.activeListeners) {
      listenerDetails.push({
        userId,
        isListening: listener.isListening,
      });
    }

    const bufferDetails: Array<{
      userId: string;
      audioLength: number;
      lastActivity: number;
    }> = [];

    for (const [userId, buffer] of this.userBuffers) {
      const audioLength = buffer.pcmChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );
      bufferDetails.push({
        userId,
        audioLength,
        lastActivity: buffer.lastActivity,
      });
    }

    return {
      activeListeners: this.activeListeners.size,
      activeBuffers: this.userBuffers.size,
      listenerDetails,
      bufferDetails,
    };
  }

  // cleanup all buffers
  cleanup(): void {
    for (const [userId, listener] of this.activeListeners) {
      listener.isListening = false;
    }

    this.activeListeners.clear();
    this.userBuffers.clear();
    logger.debug('cleaned up all audio buffers and listeners');
  }
}
