/**
 * Undo History — generic stack-based undo/redo for Zustand stores.
 * Wraps a store with a history middleware that snapshots state on each mutation.
 */

export interface UndoableState {
  past: any[];
  future: any[];
}

export function createUndoMiddleware<S extends Record<string, any>>(
  config: (set: any, get: any, api: any) => S,
  maxHistory: number = 50
) {
  return (set: any, get: any, api: any) => {
    const undoState: UndoableState = { past: [], future: [] };

    const undoableSet = (partial: any, replace?: boolean) => {
      // Snapshot current state before applying change (shallow copy)
      const current = { ...get() };
      const { past, future } = current._undo ?? undoState;
      // Remove undo internals from snapshot
      const { _undo, ...stateSnapshot } = current;
      past.push(stateSnapshot);
      if (past.length > maxHistory) past.shift();
      // Clear future on new action
      future.length = 0;

      set({ ...partial, _undo: { past, future } }, replace);
    };

    const state = config(undoableSet, get, api);
    return {
      ...state,
      _undo: undoState,
      undo: () => {
        const { _undo } = get();
        if (_undo.past.length === 0) return;
        const current = { ...get() };
        const { past, future } = _undo;
        const { _undo: _, ...stateSnapshot } = current;
        future.push(stateSnapshot);
        const prev = past.pop();
        set({ ...prev, _undo: { past, future } });
      },
      redo: () => {
        const { _undo } = get();
        if (_undo.future.length === 0) return;
        const current = { ...get() };
        const { past, future } = _undo;
        const { _undo: _, ...stateSnapshot } = current;
        past.push(stateSnapshot);
        const next = future.pop();
        set({ ...next, _undo: { past, future } });
      },
      canUndo: () => get()._undo?.past.length > 0,
      canRedo: () => get()._undo?.future.length > 0,
    };
  };
}
