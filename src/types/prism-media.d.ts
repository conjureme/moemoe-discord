declare module 'prism-media' {
  import { Transform } from 'stream';

  namespace opus {
    class Decoder extends Transform {
      constructor(options?: {
        frameSize?: number;
        channels?: number;
        rate?: number;
      });
    }

    class Encoder extends Transform {
      constructor(options?: {
        frameSize?: number;
        channels?: number;
        rate?: number;
      });
    }
  }

  class FFmpeg extends Transform {
    constructor(options?: { args?: string[] });
  }

  class VolumeTransformer extends Transform {
    constructor(options?: { type?: string; volume?: number });

    get volume(): number;
    set volume(value: number);

    setVolume(volume: number): void;
  }
}
