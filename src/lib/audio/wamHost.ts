export interface WamPluginInfo {
  id: string;
  name: string;
  url: string;
  type: 'synth' | 'effect';
  author?: string;
  version?: string;
}

interface WamInstance {
  id: string;
  plugin: WamPluginInfo;
  audioNode: AudioNode | null;
  paramIds: string[];
  loaded: boolean;
}

export class WamHost {
  private static instance: WamHost;
  private instances: Map<string, WamInstance> = new Map();
  private initialized = false;
  private audioCtx: AudioContext | null = null;
  private listeners = new Set<(info: WamPluginInfo, loaded: boolean) => void>();

  private constructor() {}

  static getInstance(): WamHost {
    if (!WamHost.instance) {
      WamHost.instance = new WamHost();
    }
    return WamHost.instance;
  }

  init(ctx: AudioContext) {
    if (this.initialized) return;
    this.audioCtx = ctx;
    this.initialized = true;
  }

  get isInitialized() { return this.initialized; }

  async loadPlugin(info: WamPluginInfo): Promise<boolean> {
    if (!this.audioCtx) {
      console.warn('[WamHost] No AudioContext — call init() first');
      return false;
    }

    try {
      // WAM plugins are ES modules loaded via <script type="module">
      // We load them dynamically and they register themselves

      // First, check if already loaded
      if (this.instances.has(info.id)) {
        console.log(`[WamHost] Plugin "${info.id}" already loaded`);
        return true;
      }

      const mod = await import(/* @vite-ignore */ info.url);
      const pluginFactory = mod.default || mod;

      if (typeof pluginFactory !== 'function') {
        // Fallback: try creating a simple AudioWorkletNode if available
        try {
          await this.audioCtx.audioWorklet.addModule(info.url);
          const node = new AudioWorkletNode(this.audioCtx, info.id);
          const instance: WamInstance = {
            id: info.id,
            plugin: info,
            audioNode: node,
            paramIds: [],
            loaded: true,
          };
          this.instances.set(info.id, instance);
          this.notify(info, true);
          return true;
        } catch (workletErr) {
          console.error(`[WamHost] Failed to load plugin "${info.id}" as AudioWorklet:`, workletErr);
          return false;
        }
      }

      // If we got a factory function, use it
      const node = await pluginFactory(this.audioCtx);
      if (!node) throw new Error('Plugin factory returned no node');

      const paramIds = Array.from(node.parameters?.keys?.() || []);

      const instance: WamInstance = {
        id: info.id,
        plugin: info,
        audioNode: node,
        paramIds: paramIds as string[],
        loaded: true,
      };
      this.instances.set(info.id, instance);
      this.notify(info, true);
      return true;
    } catch (err) {
      console.error(`[WamHost] Failed to load plugin "${info.id}":`, err);
      this.notify(info, false);
      return false;
    }
  }

  unloadPlugin(id: string) {
    const inst = this.instances.get(id);
    if (!inst) return;
    if (inst.audioNode && 'disconnect' in inst.audioNode) {
      try { inst.audioNode.disconnect(); } catch {}
      try { (inst.audioNode as any).dispose?.(); } catch {}
    }
    this.instances.delete(id);
    this.notify(inst.plugin, false);
  }

  getNode(id: string): AudioNode | null {
    return this.instances.get(id)?.audioNode || null;
  }

  getParamValue(pluginId: string, paramId: string): number {
    const inst = this.instances.get(pluginId);
    if (!inst?.audioNode) return 0;
    const param = (inst.audioNode as any).parameters?.get(paramId);
    return param?.value ?? 0;
  }

  setParamValue(pluginId: string, paramId: string, value: number) {
    const inst = this.instances.get(pluginId);
    if (!inst?.audioNode) return;
    const param = (inst.audioNode as any).parameters?.get(paramId);
    if (param) param.value = value;
  }

  getLoadedPlugins(): WamPluginInfo[] {
    return Array.from(this.instances.values())
      .filter(i => i.loaded)
      .map(i => i.plugin);
  }

  onPluginChange(cb: (info: WamPluginInfo, loaded: boolean) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(info: WamPluginInfo, loaded: boolean) {
    this.listeners.forEach(fn => fn(info, loaded));
  }

  dispose() {
    this.instances.forEach(inst => {
      if (inst.audioNode && 'disconnect' in inst.audioNode) {
        try { inst.audioNode.disconnect(); } catch {}
      }
    });
    this.instances.clear();
    this.listeners.clear();
    WamHost.instance = undefined as any;
  }

  /** Reset the singleton for test isolation. */
  static resetInstance() {
    if (WamHost.instance) {
      WamHost.instance.dispose();
      WamHost.instance = undefined as any;
    }
  }
}
