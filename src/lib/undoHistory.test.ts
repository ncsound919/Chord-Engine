import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createUndoMiddleware } from './undoHistory';

interface TestState {
  count: number;
  name: string;
  setCount: (c: number) => void;
  setName: (n: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function createStore(maxHistory = 50) {
  return create<TestState>()(createUndoMiddleware((set) => ({
    count: 0,
    name: 'test',
    setCount: (c) => set({ count: c }),
    setName: (n) => set({ name: n }),
  }), maxHistory));
}

describe('createUndoMiddleware', () => {
  it('basic set/undo/redo cycle', () => {
    const store = createStore();
    store.getState().setCount(5);
    expect(store.getState().count).toBe(5);
    store.getState().undo();
    expect(store.getState().count).toBe(0);
    store.getState().redo();
    expect(store.getState().count).toBe(5);
  });

  it('canUndo/canRedo return correct values', () => {
    const store = createStore();
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(false);
    store.getState().setCount(10);
    expect(store.getState().canUndo()).toBe(true);
    expect(store.getState().canRedo()).toBe(false);
    store.getState().undo();
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(true);
  });

  it('undo when past is empty is a no-op', () => {
    const store = createStore();
    store.getState().setCount(1);
    store.getState().undo();
    expect(store.getState().count).toBe(0);
    store.getState().undo();
    expect(store.getState().count).toBe(0);
    expect(store.getState().canUndo()).toBe(false);
  });

  it('redo when future is empty is a no-op', () => {
    const store = createStore();
    store.getState().redo();
    expect(store.getState().count).toBe(0);
    store.getState().setCount(1);
    store.getState().redo();
    expect(store.getState().count).toBe(1);
  });

  it('maxHistory limits past length', () => {
    const store = createStore(3);
    for (let i = 1; i <= 5; i++) {
      store.getState().setCount(i);
    }
    expect(store.getState().count).toBe(5);
    const undoState = (store.getState() as any)._undo;
    expect(undoState.past.length).toBe(3);
    expect(undoState.past[0].count).toBe(2);
  });

  it('new action after undo clears future', () => {
    const store = createStore();
    store.getState().setCount(1);
    store.getState().setCount(2);
    store.getState().undo();
    expect(store.getState().canRedo()).toBe(true);
    store.getState().setCount(3);
    expect(store.getState().canRedo()).toBe(false);
    expect(store.getState().count).toBe(3);
  });

  it('multiple undo/redo cycles', () => {
    const store = createStore();
    store.getState().setCount(1);
    store.getState().setCount(2);
    store.getState().setCount(3);
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().count).toBe(1);
    store.getState().redo();
    store.getState().redo();
    expect(store.getState().count).toBe(3);
  });

  it('setCount and setName both track history correctly', () => {
    const store = createStore();
    store.getState().setCount(10);
    store.getState().setName('hello');
    expect(store.getState().count).toBe(10);
    expect(store.getState().name).toBe('hello');
    store.getState().undo();
    expect(store.getState().name).toBe('test');
    expect(store.getState().count).toBe(10);
    store.getState().undo();
    expect(store.getState().count).toBe(0);
  });

  it('redo does not affect future when past is exhausted', () => {
    const store = createStore();
    store.getState().setCount(1);
    store.getState().redo();
    store.getState().redo();
    expect(store.getState().count).toBe(1);
  });

  it('canUndo/canRedo remain valid after multiple cycles', () => {
    const store = createStore();
    store.getState().setCount(1);
    store.getState().setCount(2);
    store.getState().setCount(3);
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().canUndo()).toBe(true);
    expect(store.getState().canRedo()).toBe(true);
    store.getState().redo();
    expect(store.getState().canUndo()).toBe(true);
    expect(store.getState().canRedo()).toBe(true);
    store.getState().redo();
    expect(store.getState().canUndo()).toBe(true);
    expect(store.getState().canRedo()).toBe(false);
  });
});
