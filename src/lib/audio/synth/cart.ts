import type { Ju60Params } from './params';
import { DEFAULT_PATCH } from './params';
import { Ju60Engine } from './engine';

export interface SynthCartridge {
  name: string;
  patches: Ju60Params[];
  version: number;
}

const PATCHES_PER_BANK = 32;

export class CartManager {
  private _cartridges: SynthCartridge[] = [];

  get cartridges() { return this._cartridges; }

  createCartridge(name: string, patches?: Ju60Params[]): SynthCartridge {
    const cart: SynthCartridge = {
      name,
      patches: patches ?? Array.from({ length: PATCHES_PER_BANK }, () => ({ ...DEFAULT_PATCH })),
      version: 1,
    };
    this._cartridges.push(cart);
    return cart;
  }

  deleteCartridge(index: number) {
    if (index >= 0 && index < this._cartridges.length) {
      this._cartridges.splice(index, 1);
    }
  }

  loadPatchFromCartridge(cartIndex: number, patchIndex: number, channelId: string) {
    const cart = this._cartridges[cartIndex];
    if (!cart || patchIndex < 0 || patchIndex >= cart.patches.length) return;
    const engine = Ju60Engine.getInstance();
    engine.updatePatch(channelId, cart.patches[patchIndex]);
  }

  savePatchToCartridge(cartIndex: number, patchIndex: number, channelId: string): boolean {
    const cart = this.cartridges[cartIndex];
    if (!cart || patchIndex < 0 || patchIndex >= cart.patches.length) return false;
    const engine = Ju60Engine.getInstance();
    const patch = engine.getPatch(channelId);
    if (!patch) return false;
    cart.patches[patchIndex] = { ...patch };
    return true;
  }

  exportToJSON(cartIndex: number): string | null {
    const cart = this.cartridges[cartIndex];
    if (!cart) return null;
    return JSON.stringify(cart, null, 2);
  }

  importFromJSON(json: string): SynthCartridge | null {
    try {
      const data = JSON.parse(json);
      if (!data.patches || !Array.isArray(data.patches)) return null;
      const cart: SynthCartridge = {
        name: data.name || 'Imported',
        patches: data.patches,
        version: data.version || 1,
      };
      this._cartridges.push(cart);
      return cart;
    } catch { return null; }
  }

  /** Serialize cartridge to .syx binary format (DX7-compatible) */
  exportToSyx(cartIndex: number): Uint8Array | null {
    const cart = this._cartridges[cartIndex];
    if (!cart) return null;
    const encoder = new TextEncoder();
    const json = JSON.stringify(cart);
    return encoder.encode(json);
  }
}

export const cartManager = new CartManager();
