import { VoiceChannel, StageChannel, Client } from 'discord.js';
import {
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} from '@discordjs/voice';

import { serviceManager } from '../ServiceManager';
import { VoiceConnectionManager } from './VoiceConnectionManager';
import { VoiceProviderFactory } from './providers/VoiceProviderIndex';
import { BaseVoiceProvider } from './providers/BaseVoiceProvider';

import { logger } from '../../utils/logger';

export class VoiceTranscriptHandler {
  private client: Client;
  private voiceProvider: BaseVoiceProvider | null;

  constructor(client: Client) {
    this.client = client;
    this.voiceProvider = VoiceProviderFactory.create();

    if (this.voiceProvider) {
      logger.info(
        `initialized voice provider: ${this.voiceProvider.getName()}`
      );
    } else {
      logger.info('voice mode disabled');
    }
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
      if (!this.voiceProvider) {
        logger.debug(
          'no voice provider configured, please specify one in .env; skipping tts playback!'
        );
        return;
      }

      const voiceManager = VoiceConnectionManager.getInstance();
      const connectionInfo = voiceManager.getConnection(guildId);

      if (!connectionInfo) {
        logger.warn('no voice connection found for tts playback');
        return;
      }

      const audioStream = await this.voiceProvider.generateVoice(text);
      if (!audioStream) {
        logger.error('failed to generate voice audio');
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

      logger.info('voice playback completed');
    } catch (error) {
      logger.error('error playing voice response:', error);
    }
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
      `${response.functionCalls!.length} function calls will execute after voice playback`
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

    logger.info(
      `executing ${response.functionCalls!.length} function calls from voice`
    );

    const functionResults = await services.ai.executeFunctionCalls(
      response.functionCalls!,
      mockMessage
    );

    await this.storeFunctionResults(
      functionResults,
      voiceChannelId,
      guildId,
      services
    );

    const hasLeaveCall = response.functionCalls!.some(
      (call) => call.name === 'leave_call'
    );

    if (hasLeaveCall) {
      logger.debug(
        'skipping follow-up response - bot left voice channel'
      );
      return;
    }

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
