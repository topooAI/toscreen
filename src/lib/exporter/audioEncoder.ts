export class AudioEncoderWrapper {
  private encoder: AudioEncoder | null = null;
  private outputCallback: (chunk: EncodedAudioChunk, meta: EncodedAudioChunkMetadata) => void;
  private audioBuffer: AudioBuffer;
  
  private lastEncodedFrame: number = 0;
  private isConfigured: boolean = false;
  private config: AudioEncoderConfig;

  constructor(
    audioBuffer: AudioBuffer,
    outputCallback: (chunk: EncodedAudioChunk, meta: EncodedAudioChunkMetadata) => void
  ) {
    this.audioBuffer = audioBuffer;
    this.outputCallback = outputCallback;

    const { sampleRate, numberOfChannels } = this.audioBuffer;
    
    // Default config
    this.config = {
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels,
      bitrate: 192_000,
    };
  }

  public getCodec(): string {
    return this.config.codec;
  }

  public async initialize(): Promise<void> {
    try {
      const support = await AudioEncoder.isConfigSupported(this.config);
      if (!support.supported) {
        this.config.codec = 'opus';
      }
    } catch (e) {
      this.config.codec = 'opus';
    }

    let isFirstChunk = true;

    this.encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        if (isFirstChunk) {
          let finalMetadata = metadata || {};
          if (this.config.codec === 'mp4a.40.2' && (!finalMetadata.decoderConfig || !finalMetadata.decoderConfig.description)) {
            finalMetadata = {
              ...finalMetadata,
              decoderConfig: {
                ...(finalMetadata.decoderConfig || {}),
                codec: 'mp4a.40.2',
                sampleRate: this.config.sampleRate,
                numberOfChannels: this.config.numberOfChannels,
                description: new Uint8Array([0x11, 0x90]).buffer
              }
            } as any;
          }
          this.outputCallback(chunk, finalMetadata);
          isFirstChunk = false;
        } else {
          this.outputCallback(chunk, {});
        }
      },
      error: (e) => {
        console.error('[AudioEncoderWrapper] Encoding error:', e);
      }
    });

    this.encoder.configure(this.config);
    this.isConfigured = true;
  }

  public async encodeUpTo(targetTimeSec: number): Promise<void> {
    if (!this.isConfigured || !this.encoder) return;
    
    const { sampleRate, numberOfChannels, length: totalFrames } = this.audioBuffer;
    const targetFrame = Math.min(Math.floor(targetTimeSec * sampleRate), totalFrames);
    
    if (targetFrame <= this.lastEncodedFrame) return;

    // chunk it in max 1-second chunks to prevent massive frames feeding
    const maxFramesPerChunk = sampleRate;
    
    while (this.lastEncodedFrame < targetFrame) {
      const startFrame = this.lastEncodedFrame;
      const endFrame = Math.min(startFrame + maxFramesPerChunk, targetFrame);
      const frameCount = endFrame - startFrame;
      
      const planarData = new Float32Array(frameCount * numberOfChannels);
      for (let c = 0; c < numberOfChannels; c++) {
        const channelData = this.audioBuffer.getChannelData(c);
        planarData.set(channelData.subarray(startFrame, endFrame), c * frameCount);
      }

      const timestamp = (startFrame / sampleRate) * 1_000_000;

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels,
        timestamp,
        data: planarData,
      });

      this.encoder.encode(audioData);
      audioData.close();
      
      this.lastEncodedFrame = endFrame;

      // Throttle if encoder queue is too deep
      if (this.encoder.encodeQueueSize > 50) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
  }

  public async flush(): Promise<void> {
    if (this.encoder) {
      await this.encoder.flush();
      this.encoder.close();
    }
  }
}
