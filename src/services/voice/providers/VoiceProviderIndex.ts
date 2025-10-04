import { BaseVoiceProvider } from './BaseVoiceProvider';
import { RVCKokoroProvider } from './RVCKokoroProvider';

import { logger } from '../../../utils/logger';

export class VoiceProviderFactory {
  static create(): BaseVoiceProvider | null {
    const voiceMode = process.env.VOICE_MODE || 'none';

    if (voiceMode === 'none') {
      logger.info('voice mode disabled');
      return null;
    }

    switch (voiceMode.toLowerCase()) {
      case 'rvc':
      case 'rvc-kokoro':
        return new RVCKokoroProvider({
          enabled: true,
          ttsApiUrl: process.env.TTS_API_URL || 'http://localhost:8880',
          rvcApiUrl: process.env.RVC_API_URL || 'http://localhost:5001',
        });

      default:
        logger.error(`unsupported voice mode: ${voiceMode}`);
        return null;
    }
  }
}
