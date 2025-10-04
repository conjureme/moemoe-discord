import { Readable } from 'stream';

import { logger } from '../../../utils/logger';

export interface VoiceConfig {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  [key: string]: any;
}

export abstract class BaseVoiceProvider {
  protected config: VoiceConfig;

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  abstract getName(): string;

  abstract validateConfig(): boolean;

  abstract generateVoice(text: string): Promise<Readable | null>;

  protected bufferToStream(buffer: Buffer): Readable {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  protected async fetchAudio(
    url: string,
    body: any,
    headers: Record<string, string> = {}
  ): Promise<Buffer | null> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        logger.error(
          `audio fetch error: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('error fetching audio:', error);
      return null;
    }
  }
}
