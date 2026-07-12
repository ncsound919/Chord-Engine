import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartManager } from './cart';
import { DEFAULT_PATCH } from './params';

const mockUpdatePatch = vi.fn();
const mockGetPatch = vi.fn(() => ({ ...DEFAULT_PATCH }));

vi.mock('./engine', () => ({
  Ju60Engine: {
    getInstance: vi.fn(() => ({
      updatePatch: mockUpdatePatch,
      getPatch: mockGetPatch,
    })),
  },
}));

describe('CartManager', () => {
  let cart: CartManager;

  beforeEach(() => {
    cart = new CartManager();
    vi.clearAllMocks();
  });

  describe('createCartridge', () => {
    it('creates with default patches of length 32', () => {
      const c = cart.createCartridge('Test');
      expect(c.name).toBe('Test');
      expect(c.patches.length).toBe(32);
      expect(c.version).toBe(1);
    });

    it('creates with custom patches', () => {
      const patches = [{ ...DEFAULT_PATCH }, { ...DEFAULT_PATCH, vcfCutoff: 10 }];
      const c = cart.createCartridge('Custom', patches);
      expect(c.patches).toBe(patches);
      expect(c.patches.length).toBe(2);
    });
  });

  describe('deleteCartridge', () => {
    it('removes by index', () => {
      cart.createCartridge('A');
      cart.createCartridge('B');
      cart.deleteCartridge(0);
      expect(cart.cartridges.length).toBe(1);
      expect(cart.cartridges[0].name).toBe('B');
    });

    it('no-op for out-of-range index', () => {
      cart.createCartridge('A');
      cart.deleteCartridge(5);
      expect(cart.cartridges.length).toBe(1);
      cart.deleteCartridge(-1);
      expect(cart.cartridges.length).toBe(1);
    });
  });

  describe('exportToJSON', () => {
    it('returns JSON string for valid index', () => {
      cart.createCartridge('Test');
      const json = cart.exportToJSON(0);
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.name).toBe('Test');
      expect(parsed.patches.length).toBe(32);
    });

    it('returns null for invalid index', () => {
      expect(cart.exportToJSON(0)).toBeNull();
      expect(cart.exportToJSON(-1)).toBeNull();
    });
  });

  describe('importFromJSON', () => {
    it('parses valid JSON and adds cartridge', () => {
      const data = { name: 'Imported', patches: [{ ...DEFAULT_PATCH }], version: 1 };
      const result = cart.importFromJSON(JSON.stringify(data));
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Imported');
      expect(result!.patches.length).toBe(1);
      expect(cart.cartridges.length).toBe(1);
    });

    it('returns null for invalid JSON', () => {
      expect(cart.importFromJSON('not json')).toBeNull();
    });

    it('returns null if patches not an array', () => {
      const data = { name: 'Bad', patches: 'not an array' };
      expect(cart.importFromJSON(JSON.stringify(data))).toBeNull();
    });

    it('uses default name when missing', () => {
      const data = { patches: [{ ...DEFAULT_PATCH }] };
      const result = cart.importFromJSON(JSON.stringify(data));
      expect(result!.name).toBe('Imported');
    });
  });

  describe('exportToSyx', () => {
    it('returns encodable data for valid index', () => {
      cart.createCartridge('Test');
      const syx = cart.exportToSyx(0);
      expect(syx).not.toBeNull();
      expect(syx!.length).toBeGreaterThan(0);
    });

    it('returns null for invalid index', () => {
      expect(cart.exportToSyx(0)).toBeNull();
    });
  });

  describe('loadPatchFromCartridge', () => {
    it('calls engine.updatePatch', () => {
      cart.createCartridge('Test');
      cart.loadPatchFromCartridge(0, 0, 'lead');
      expect(mockUpdatePatch).toHaveBeenCalledWith('lead', expect.objectContaining({ vcfCutoff: 75 }));
    });
  });

  describe('savePatchToCartridge', () => {
    it('saves patch from engine', () => {
      cart.createCartridge('Test');
      const result = cart.savePatchToCartridge(0, 0, 'lead');
      expect(result).toBe(true);
      expect(cart.cartridges[0].patches[0].vcfCutoff).toBe(75);
    });

    it('returns false for invalid cart index', () => {
      expect(cart.savePatchToCartridge(0, 0, 'lead')).toBe(false);
    });
  });
});
