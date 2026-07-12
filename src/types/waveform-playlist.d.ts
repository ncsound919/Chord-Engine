declare module '@waveform-playlist/browser' {
  interface PlaylistOptions {
    container: HTMLElement;
    samplesPerPixel?: number;
    mono?: boolean;
    fadeType?: string;
    exclSolo?: boolean;
    timescale?: boolean;
    waveHeight?: number;
    isAutomaticScroll?: boolean;
    mode?: string;
    controls?: { show: boolean; width: number };
    zoomLevels?: number[];
    colors?: Record<string, string>;
  }

  interface PlaylistInstance {
    destroy(): void;
    load(data: any[]): void;
    play(): void;
    pause(): void;
    stop(): void;
    setTrackVolume(track: number, volume: number): void;
    setTrackPan(track: number, pan: number): void;
    on(event: string, callback: (...args: any[]) => void): void;
  }

  export function init(options: PlaylistOptions): PlaylistInstance;
  export default { init };
}

declare module 'waveform-playlist' {
  export * from '@waveform-playlist/browser';
}
