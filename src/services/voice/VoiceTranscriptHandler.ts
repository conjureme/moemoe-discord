import { VoiceChannel, StageChannel, Client } from 'discord.js';
import {
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} from '@discordjs/voice';

import { serviceManager } from '../ServiceManager';
import { VoiceConnectionManager } from './VoiceConnectionManager';

import { logger } from '../../utils/logger';
import { Readable } from 'stream';

export class VoiceTranscriptHandler {
  private client: Client;
  private ttsApiUrl: string;
  private rvcApiUrl: string;

  constructor(client: Client) {
    this.client = client;
    this.ttsApiUrl = process.env.TTS_API_URL || 'http://localhost:8880';
    this.rvcApiUrl = process.env.RVC_API_URL || 'http://localhost:5001';
  }

  async handleTranscription(
    userId: string,
    guildId: string,
    voiceChannelId: string,
    transcribedText: string
  ): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      const voiceChannel = guild.channels.cache.get(voiceChannelId) as
        | VoiceChannel
        | StageChannel;

      if (!voiceChannel) {
        logger.error(`voice channel ${voiceChannelId} not found`);
        return;
      }

      const services = this.getServices();

      // needs to use message format
      const formattedContent = `[${member.user.username}|${userId}]: ${transcribedText}`;

      await services.memory.addMessage({
        id: `voice-${Date.now()}-${userId}`,
        channelId: voiceChannelId,
        guildId: guildId,
        author: member.user.username,
        authorId: userId,
        content: formattedContent,
        timestamp: new Date(),
        isBot: false,
      });

      logger.debug(
        `stored voice transcription in memory for channel ${voiceChannelId}`
      );

      const context = await services.memory.getChannelContext(
        voiceChannelId,
        guildId
      );

      const mockMessage = {
        client: this.client,
        channelId: voiceChannelId,
        guildId: guildId,
        author: member.user,
        member: member,
        channel: voiceChannel,
      };

      const response = await services.ai.generateResponse(
        context.messages,
        mockMessage as any
      );

      if (response.functionCalls?.length) {
        await this.handleFunctionCalls(
          mockMessage as any,
          response,
          services,
          voiceChannelId,
          guildId
        );
      } else if (response.content?.trim()) {
        await this.playTTSResponse(guildId, response.content);
        await this.storeBotResponse(
          voiceChannelId,
          guildId,
          response.content,
          services
        );
      }
    } catch (error) {
      logger.error('error handling voice transcription:', error);
    }
  }

  private async playTTSResponse(guildId: string, text: string): Promise<void> {
    try {
      const voiceManager = VoiceConnectionManager.getInstance();
      const connectionInfo = voiceManager.getConnection(guildId);

      if (!connectionInfo) {
        logger.warn('no voice connection found for TTS playback');
        return;
      }

      const audioStream = await this.generateTTS(text);
      if (!audioStream) {
        logger.error('failed to generate TTS audio');
        return;
      }

      const player = connectionInfo.audioPlayer;

      if (player.state.status === AudioPlayerStatus.Playing) {
        logger.debug(
          'waiting for current audio to finish before playing new TTS'
        );
        await new Promise<void>((resolve) => {
          const stateChangeHandler = (oldState: any, newState: any) => {
            if (newState.status === AudioPlayerStatus.Idle) {
              player.off('stateChange', stateChangeHandler);
              resolve();
            }
          };
          player.on('stateChange', stateChangeHandler);
        });
      }

      // create audio resource with arbitrary stream type for RVC's wav
      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Arbitrary,
      });

      player.removeAllListeners();

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          logger.error('playback timeout - audio took too long');
          resolve();
        }, 30000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          player.removeAllListeners();
        };

        player.on('stateChange', (oldState, newState) => {
          logger.debug(
            `audio player state: ${oldState.status} -> ${newState.status}`
          );

          if (
            oldState.status === AudioPlayerStatus.Playing &&
            newState.status === AudioPlayerStatus.Idle
          ) {
            cleanup();
            resolve();
          }
        });

        player.on('error', (error) => {
          logger.error('audio player error:', error);
          cleanup();
          reject(error);
        });

        player.play(resource);
      });

      logger.info('TTS playback completed');
    } catch (error) {
      logger.error('error playing TTS response:', error);
    }
  }

  private async generateTTS(text: string): Promise<Readable | null> {
    try {
      const requestBody = {
        model: 'kokoro',
        input: text,
        voice: 'af_heart',
        response_format: 'wav',
        download_format: 'wav',
        speed: 1,
        stream: false,
        return_download_link: false,
      };

      logger.debug(`requesting TTS from ${this.ttsApiUrl}/v1/audio/speech`);

      const response = await fetch(`${this.ttsApiUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        logger.error(
          `TTS API error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.debug(`received TTS audio: ${buffer.length} bytes`);

      // process through RVC
      const rvcProcessedBuffer = await this.processWithRVC(buffer);
      if (!rvcProcessedBuffer) {
        logger.error('failed to process audio with RVC, using original');
        return this.bufferToStream(buffer);
      }

      return this.bufferToStream(rvcProcessedBuffer);
    } catch (error) {
      logger.error('error generating TTS:', error);
      return null;
    }
  }

  private async processWithRVC(audioBuffer: Buffer): Promise<Buffer | null> {
    try {
      const rvcApiUrl = process.env.RVC_API_URL || 'http://localhost:5001';
      const base64Audio = audioBuffer.toString('base64');

      logger.debug(
        `processing audio through RVC (${audioBuffer.length} bytes)`
      );

      const response = await fetch(`${rvcApiUrl}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_data: base64Audio,
        }),
      });

      if (!response.ok) {
        logger.error(
          `RVC API error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      // rvc-python returns audio data
      const arrayBuffer = await response.arrayBuffer();
      const processedBuffer = Buffer.from(arrayBuffer);

      logger.debug(`RVC processed audio: ${processedBuffer.length} bytes`);
      return processedBuffer;
    } catch (error) {
      logger.error('error processing with RVC:', error);
      return null;
    }
  }

  private bufferToStream(buffer: Buffer): Readable {
    const stream = new Readable({
      read() {},
    });
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  private async handleFunctionCalls(
    mockMessage: any,
    response: {
      content: string;
      functionCalls?: any[];
      rawContent?: string;
    },
    services: ReturnType<typeof this.getServices>,
    voiceChannelId: string,
    guildId: string
  ): Promise<void> {
    logger.info(
      `executing ${response.functionCalls!.length} function calls from voice`
    );

    const functionResults = await services.ai.executeFunctionCalls(
      response.functionCalls!,
      mockMessage
    );

    const contentToStore = response.rawContent || response.content;

    if (response.content?.trim()) {
      await this.playTTSResponse(guildId, response.content);
    }

    await this.storeBotResponse(
      voiceChannelId,
      guildId,
      contentToStore,
      services
    );

    await this.storeFunctionResults(
      functionResults,
      voiceChannelId,
      guildId,
      services
    );

    const updatedContext = await services.memory.getChannelContext(
      voiceChannelId,
      guildId
    );

    const followUpResponse = await services.ai.generateResponse(
      updatedContext.messages,
      mockMessage
    );

    if (followUpResponse.content?.trim()) {
      await this.playTTSResponse(guildId, followUpResponse.content);

      await this.storeBotResponse(
        voiceChannelId,
        guildId,
        followUpResponse.rawContent || followUpResponse.content,
        services
      );
    }
  }

  private async storeBotResponse(
    voiceChannelId: string,
    guildId: string,
    content: string,
    services: ReturnType<typeof this.getServices>
  ): Promise<void> {
    await services.memory.addMessage({
      id: `voice-bot-${Date.now()}`,
      channelId: voiceChannelId,
      guildId: guildId,
      author: this.client.user!.username,
      authorId: this.client.user!.id,
      content: content,
      timestamp: new Date(),
      isBot: true,
      botId: this.client.user!.id,
    });
  }

  private async storeFunctionResults(
    results: string[],
    voiceChannelId: string,
    guildId: string,
    services: ReturnType<typeof this.getServices>
  ): Promise<void> {
    for (const result of results) {
      await services.memory.addSystemMessage({
        channelId: voiceChannelId,
        guildId: guildId,
        content: result,
        timestamp: new Date(),
      });
    }
  }

  private getServices() {
    return {
      memory: serviceManager.getMemoryService(),
      ai: serviceManager.getAIService(),
      config: serviceManager.getConfigService(),
    };
  }
}
