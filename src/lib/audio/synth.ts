/**
 * Ju-60 Synthesis Engine
 *
 * This file is now a thin re-export shim.
 * Implementation has been split into src/lib/audio/synth/
 *   - params.ts     — Ju60Params, ArpMode, sanitizePatch
 *   - voice.ts      — Ju60Voice (DCO, VCF, envelopes, LFO)
 *   - arp.ts        — Ju60Arpeggiator
 *   - channel.ts    — Ju60Channel (voice pool, chorus)
 *   - engine.ts     — Ju60Engine (singleton, lifecycle)
 *   - cart.ts       — CartManager (preset bank import/export)
 *   - tuning.ts     — Microtuner (Scala .scl/.kbm support)
 *   - paramMap.ts   — Parameter descriptor system
 *   - index.ts      — Re-exports everything
 */
export * from './synth/index';
