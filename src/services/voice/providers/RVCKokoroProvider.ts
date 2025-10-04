import { Readable } from 'stream';
import { BaseVoiceProvider } from './BaseVoiceProvider';

import { logger } from '../../../utils/logger';

export class RVCKokoroProvider extends BaseVoiceProvider {
  private ttsApiUrl: string;
  private rvcApiUrl: string;

  constructor(config: any) {
    super(config);
    this.ttsApiUrl = config.ttsApiUrl || 'http://localhost:8880';
    this.rvcApiUrl = config.rvcApiUrl || 'http://localhost:5001';
  }

  getName(): string {
    return 'rvc-kokoro';
  }

  validateConfig(): boolean {
    if (!this.config.enabled) {
      return true;
    }

    if (!this.ttsApiUrl || !this.rvcApiUrl) {
      logger.error('rvc-kokoro provider requires ttsApiUrl and rvcApiUrl');
      return false;
    }

    return true;
  }

  async generateVoice(text: string): Promise<Readable | null> {
    try {
      const ttsAudio = await this.generateTTS(text);
      if (!ttsAudio) {
        logger.error('failed to generate TTS audio');
        return null;
      }

      const rvcProcessedBuffer = await this.processWithRVC(ttsAudio);
      if (!rvcProcessedBuffer) {
        logger.error('failed to process audio with rvc, using original');
        return this.bufferToStream(ttsAudio);
      }

      return this.bufferToStream(rvcProcessedBuffer);
    } catch (error) {
      logger.error('error generating voice:', error);
      return null;
    }
  }

  private async generateTTS(text: string): Promise<Buffer | null> {
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

      logger.debug(`requesting tts from ${this.ttsApiUrl}/v1/audio/speech`);

      return await this.fetchAudio(
        `${this.ttsApiUrl}/v1/audio/speech`,
        requestBody
      );
    } catch (error) {
      logger.error('error generating tts:', error);
      return null;
    }
  }

  private async processWithRVC(audioBuffer: Buffer): Promise<Buffer | null> {
    try {
      const base64Audio = audioBuffer.toString('base64');

      logger.debug(
        `processing audio through rvc (${audioBuffer.length} bytes)`
      );

      const response = await fetch(`${this.rvcApiUrl}/convert`, {
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
          `rvc api error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const processedBuffer = Buffer.from(arrayBuffer);

      logger.debug(`rvc processed audio: ${processedBuffer.length} bytes`);

      return processedBuffer;
    } catch (error) {
      logger.error('error processing with rvc:', error);
      return null;
    }
  }
}
