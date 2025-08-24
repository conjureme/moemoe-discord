import {
  BaseFunction,
  FunctionContext,
  FunctionResult,
  FunctionDefinition,
} from '../BaseFunction';

import { VoiceConnectionManager } from '../../services/voice/VoiceConnectionManager';
import { VoiceCaptureService } from '../../services/voice/VoiceCaptureService';

import { logger } from '../../utils/logger';

import {
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} from '@discordjs/voice';

import * as fs from 'fs';
import * as path from 'path';

export class SingSongFunction extends BaseFunction {
  definition: FunctionDefinition = {
    name: 'sing_song',
    description:
      'play a song from the songs folder in the current voice channel',
    parameters: [
      {
        name: 'song_name',
        type: 'string',
        required: false,
        description:
          'name of the song file (without .mp3 extension). if not provided, lists available songs',
      },
    ],
  };

  async execute(
    context: FunctionContext,
    args: Record<string, any>
  ): Promise<FunctionResult> {
    const validationError = this.validateArgs(args);
    if (validationError) {
      return {
        success: false,
        message: validationError,
      };
    }

    const { song_name } = args;

    try {
      if (!context.guildId) {
        return {
          success: false,
          message: 'this command can only be used in a server',
        };
      }

      const voiceManager = VoiceConnectionManager.getInstance();
      const connectionInfo = voiceManager.getConnection(context.guildId);

      if (!connectionInfo) {
        return {
          success: false,
          message: 'i need to be in a voice channel first! use join_call',
        };
      }

      const songsPath = path.join(process.cwd(), 'data', 'songs');

      if (!fs.existsSync(songsPath)) {
        fs.mkdirSync(songsPath, { recursive: true });
        logger.info('created songs directory');
      }

      if (!song_name) {
        const songs = fs
          .readdirSync(songsPath)
          .filter((file) => file.endsWith('.mp3'))
          .map((file) => file.replace('.mp3', ''));

        if (songs.length === 0) {
          return {
            success: true,
            message: 'no songs available in the songs folder',
          };
        }

        return {
          success: true,
          message: `available songs: ${songs.join(', ')}`,
          data: { songs },
        };
      }

      const songFile = `${song_name}.mp3`;
      const songPath = path.join(songsPath, songFile);

      if (!fs.existsSync(songPath)) {
        const availableSongs = fs
          .readdirSync(songsPath)
          .filter((file) => file.endsWith('.mp3'))
          .map((file) => file.replace('.mp3', ''));

        return {
          success: false,
          message: `song "${song_name}" not found. available songs: ${availableSongs.join(', ') || 'none'}`,
        };
      }

      const voiceCapture = VoiceCaptureService.getInstance();
      const listeningUsers = voiceManager.getListeningUsers(context.guildId);

      logger.info(
        `pausing voice capture for ${listeningUsers.length} users during song playback`
      );

      for (const userId of listeningUsers) {
        voiceCapture.pauseListening(userId);
      }

      const resource = createAudioResource(songPath, {
        inputType: StreamType.Arbitrary,
      });

      const player = connectionInfo.audioPlayer;

      if (player.state.status === AudioPlayerStatus.Playing) {
        player.stop();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          logger.error('song playback timeout - took too long');
          player.stop();
          resolve();
        }, 600000);

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
        logger.info(`started playing song: ${song_name}`);
      });

      logger.info('resuming voice capture after song playback');

      for (const userId of listeningUsers) {
        voiceCapture.resumeListening(userId);
      }

      return {
        success: true,
        message: `finished playing "${song_name}"`,
        data: {
          songName: song_name,
          channelName: connectionInfo.channel.name,
        },
      };
    } catch (error) {
      logger.error('error in sing_song function:', error);

      try {
        const voiceManager = VoiceConnectionManager.getInstance();
        const listeningUsers = voiceManager.getListeningUsers(context.guildId!);

        for (const userId of listeningUsers) {
          voiceManager.startListeningToUser(context.guildId!, userId);
        }
      } catch (resumeError) {
        logger.error('error resuming voice capture:', resumeError);
      }

      return {
        success: false,
        message: `failed to play song: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  formatForPrompt(): string {
    return `sing_song(song_name?: string) - play a song from the songs folder`;
  }
}
