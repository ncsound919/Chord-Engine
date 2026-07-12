import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGenerationStore } from './generationStore';

vi.mock('../lib/generatePipeline', () => ({
  runGenerationPipeline: vi.fn(() => [
    {
      def: { id: 'gen1', name: 'Generated', preset: 'steely', lengthBars: 4 },
      chords: [],
      drumPattern: null,
    },
  ]),
  compileAndGenerate: vi.fn(() => ({
    sections: [{ id: 'compiled', name: 'Compiled', preset: 'steely', lengthBars: 8 }],
    generated: [
      {
        def: { id: 'gen1', name: 'Generated', preset: 'steely', lengthBars: 4 },
        chords: [],
        drumPattern: null,
      },
    ],
  })),
  applySubstitution: vi.fn(() => [
    {
      def: { id: 'sub', name: 'Sub', preset: 'steely', lengthBars: 4 },
      chords: [],
      drumPattern: null,
    },
  ]),
  applyCriticFix: vi.fn(() => [
    {
      def: { id: 'fix', name: 'Fix', preset: 'steely', lengthBars: 4 },
      chords: [],
      drumPattern: null,
    },
  ]),
}));

import {
  runGenerationPipeline,
  compileAndGenerate,
  applySubstitution,
  applyCriticFix,
} from '../lib/generatePipeline';

describe('generationStore — pipeline actions', () => {
  beforeEach(() => {
    useGenerationStore.setState({
      musicKey: 'F',
      seed: 'test-seed',
      sections: [
        { id: '1', name: 'Verse', preset: 'steely', lengthBars: 8 },
      ],
      generated: [],
    });
    vi.clearAllMocks();
  });

  it('handleGenerate sets generated to pipeline output', () => {
    useGenerationStore.getState().handleGenerate();
    const { generated } = useGenerationStore.getState();
    expect(runGenerationPipeline).toHaveBeenCalledTimes(1);
    expect(generated).toHaveLength(1);
    expect(generated[0].def.id).toBe('gen1');
  });

  it('handleGenerate passes correct args to pipeline', () => {
    useGenerationStore.getState().handleGenerate();
    expect(runGenerationPipeline).toHaveBeenCalledWith({
      musicKey: 'F',
      seed: 'test-seed',
      sections: expect.arrayContaining([
        expect.objectContaining({ id: '1', name: 'Verse' }),
      ]),
      writerWeights: expect.any(Object),
      reframeTarget: 'none',
    });
  });

  it('handleCompileSong updates both sections and generated', () => {
    useGenerationStore.getState().handleCompileSong();
    const { sections, generated } = useGenerationStore.getState();
    expect(compileAndGenerate).toHaveBeenCalledTimes(1);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('compiled');
    expect(generated).toHaveLength(1);
    expect(generated[0].def.id).toBe('gen1');
  });

  it('handleCompileSong passes correct args', () => {
    useGenerationStore.getState().handleCompileSong();
    expect(compileAndGenerate).toHaveBeenCalledWith({
      musicKey: 'F',
      seed: 'test-seed',
      sections: expect.arrayContaining([
        expect.objectContaining({ id: '1' }),
      ]),
      writerWeights: expect.any(Object),
      reframeTarget: 'none',
    });
  });

  it('handleSubstitute calls applySubstitution with correct args', () => {
    useGenerationStore.getState().handleSubstitute(0, 0, 'tritone');
    expect(applySubstitution).toHaveBeenCalledWith(
      expect.any(Array),
      0,
      0,
      'tritone',
      'F',
      'test-seed',
    );
    const { generated } = useGenerationStore.getState();
    expect(generated).toHaveLength(1);
    expect(generated[0].def.id).toBe('sub');
  });

  it('handleApplyCriticFix calls applyCriticFix with correct args', () => {
    useGenerationStore.getState().handleApplyCriticFix(0, 2, 'revoice');
    expect(applyCriticFix).toHaveBeenCalledWith(
      expect.any(Array),
      0,
      2,
      'revoice',
      'F',
      'test-seed',
    );
    const { generated } = useGenerationStore.getState();
    expect(generated).toHaveLength(1);
    expect(generated[0].def.id).toBe('fix');
  });
});
