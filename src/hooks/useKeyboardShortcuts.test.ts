import { renderHook, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSaveProject = vi.fn();
const mockSetIsProjectListOpen = vi.fn();
const mockLoadUserProjects = vi.fn();
const mockExportProjectToFile = vi.fn();
const mockImportProjectFromFile = vi.fn();
const mockSetProjectName = vi.fn();
const mockSetProjectId = vi.fn();
const mockSetActiveView = vi.fn();

vi.mock('../stores/projectStore', () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      saveProject: mockSaveProject,
      setIsProjectListOpen: mockSetIsProjectListOpen,
      loadUserProjects: mockLoadUserProjects,
      exportProjectToFile: mockExportProjectToFile,
      importProjectFromFile: mockImportProjectFromFile,
      setProjectName: mockSetProjectName,
      setProjectId: mockSetProjectId,
    })),
  },
}));

vi.mock('../stores/uiStore', () => ({
  useUiStore: {
    getState: vi.fn(() => ({
      setActiveView: mockSetActiveView,
    })),
  },
}));

import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ...opts,
    }),
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useKeyboardShortcuts', () => {
  it('attaches a keydown listener to window', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useKeyboardShortcuts());
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addSpy.mockRestore();
  });

  it('Ctrl+S calls saveProject', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('s', { ctrlKey: true });
    expect(mockSaveProject).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+O calls setIsProjectListOpen(true) and loadUserProjects', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('o', { ctrlKey: true });
    expect(mockSetIsProjectListOpen).toHaveBeenCalledWith(true);
    expect(mockLoadUserProjects).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+E calls exportProjectToFile', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('E', { ctrlKey: true, shiftKey: true });
    expect(mockExportProjectToFile).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+I calls importProjectFromFile', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('I', { ctrlKey: true, shiftKey: true });
    expect(mockImportProjectFromFile).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+N calls setProjectName("Untitled Project") and setProjectId', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('n', { ctrlKey: true });
    expect(mockSetProjectName).toHaveBeenCalledWith('Untitled Project');
    expect(mockSetProjectId).toHaveBeenCalledTimes(1);
  });

  it('pressing 1 calls setActiveView("arranger")', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('1');
    expect(mockSetActiveView).toHaveBeenCalledWith('arranger');
  });

  it('pressing 6 calls setActiveView("blender")', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('6');
    expect(mockSetActiveView).toHaveBeenCalledWith('blender');
  });

  it('pressing 7 does nothing (out of range)', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('7');
    expect(mockSetActiveView).not.toHaveBeenCalled();
  });

  it('number key while focused on an input does NOT call setActiveView', () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '3',
        bubbles: true,
      }),
    );
    expect(mockSetActiveView).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('cleanup removes event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('Cmd+S (metaKey) also calls saveProject', () => {
    renderHook(() => useKeyboardShortcuts());
    fireKey('s', { metaKey: true });
    expect(mockSaveProject).toHaveBeenCalledTimes(1);
  });
});
