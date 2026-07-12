import React from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WamPluginLoader } from './WamPluginLoader';

let mockLoadedPlugins: any[] = [];
let onChangeCallback: ((info: any, loaded: boolean) => void) | null = null;

const mockInit = vi.fn();
const mockLoadPlugin = vi.fn(async () => {});
const mockUnloadPlugin = vi.fn();
const mockOnPluginChange = vi.fn((cb: any) => {
  onChangeCallback = cb;
  return vi.fn();
});
const mockGetLoadedPlugins = vi.fn(() => mockLoadedPlugins);

vi.mock('../lib/audio/wamHost', () => ({
  WamHost: {
    getInstance: vi.fn(() => ({
      init: mockInit,
      loadPlugin: mockLoadPlugin,
      unloadPlugin: mockUnloadPlugin,
      getLoadedPlugins: mockGetLoadedPlugins,
      onPluginChange: mockOnPluginChange,
    })),
  },
}));

vi.mock('../lib/audio/engine', () => ({
  audioEngine: {
    ctx: {},
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockLoadedPlugins = [];
  onChangeCallback = null;
});

describe('WamPluginLoader', () => {
  beforeEach(() => {
    mockGetLoadedPlugins.mockImplementation(() => mockLoadedPlugins);
  });

  it('renders demo plugins list', () => {
    render(<WamPluginLoader />);
    expect(screen.getByText('DX7 FM Synth')).toBeInTheDocument();
    expect(screen.getByText('CZ-101 Phase Distortion')).toBeInTheDocument();
  });

  it('shows Web Audio Modules header', () => {
    render(<WamPluginLoader />);
    expect(screen.getByText('Web Audio Modules (WAM)')).toBeInTheDocument();
  });

  it('shows Custom URL button', () => {
    render(<WamPluginLoader />);
    expect(screen.getByText('Custom URL')).toBeInTheDocument();
  });

  it('load button triggers handleLoad', async () => {
    render(<WamPluginLoader />);
    const loadBtns = screen.getAllByText('Load');
    fireEvent.click(loadBtns[0]);
    expect(mockLoadPlugin).toHaveBeenCalledTimes(1);
  });

  it('custom URL input shows on toggle', () => {
    render(<WamPluginLoader />);
    fireEvent.click(screen.getByText('Custom URL'));
    expect(screen.getByPlaceholderText('https://example.com/plugin.js')).toBeInTheDocument();
  });

  it('load custom URL works after confirmation', () => {
    // Security fix: custom URLs now require user confirmation via window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WamPluginLoader />);
    fireEvent.click(screen.getByText('Custom URL'));
    const input = screen.getByPlaceholderText('https://example.com/plugin.js');
    fireEvent.change(input, { target: { value: 'https://example.com/myplugin.js' } });
    const loadBtns = screen.getAllByText('Load');
    const customLoadBtn = loadBtns[0];
    fireEvent.click(customLoadBtn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockLoadPlugin).toHaveBeenCalled();
    const pluginArg = mockLoadPlugin.mock.calls[0][0];
    expect(pluginArg.url).toBe('https://example.com/myplugin.js');
    confirmSpy.mockRestore();
  });

  it('custom URL load is blocked when confirmation is declined', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WamPluginLoader />);
    fireEvent.click(screen.getByText('Custom URL'));
    const input = screen.getByPlaceholderText('https://example.com/plugin.js');
    fireEvent.change(input, { target: { value: 'https://example.com/myplugin.js' } });
    const loadBtns = screen.getAllByText('Load');
    const customLoadBtn = loadBtns[0];
    fireEvent.click(customLoadBtn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockLoadPlugin).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('non-http URL is rejected with an alert', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<WamPluginLoader />);
    fireEvent.click(screen.getByText('Custom URL'));
    const input = screen.getByPlaceholderText('https://example.com/plugin.js');
    fireEvent.change(input, { target: { value: 'ftp://malicious.com/plugin.js' } });
    const loadBtns = screen.getAllByText('Load');
    const customLoadBtn = loadBtns[0];
    fireEvent.click(customLoadBtn);
    expect(alertSpy).toHaveBeenCalled();
    expect(mockLoadPlugin).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('does not load empty custom URL', () => {
    render(<WamPluginLoader />);
    fireEvent.click(screen.getByText('Custom URL'));
    const loadBtns = screen.getAllByText('Load');
    const customLoadBtn = loadBtns[0];
    expect(customLoadBtn).toBeDisabled();
  });

  it('unload button removes plugin', () => {
    mockLoadedPlugins = [{ id: 'webdx7', name: 'DX7 FM Synth', url: '', type: 'synth' }];
    render(<WamPluginLoader />);
    const pluginRows = screen.getAllByText('DX7 FM Synth');
    const demoRow = pluginRows[0].closest('[class*="flex items-center justify-between"]')!;
    const trashBtn = demoRow.querySelector('button');
    expect(trashBtn).not.toBeNull();
    fireEvent.click(trashBtn!);
    expect(mockUnloadPlugin).toHaveBeenCalledWith('webdx7');
  });

  it('shows loading state', async () => {
    mockLoadPlugin.mockImplementationOnce(async () => {
      await new Promise(r => setTimeout(r, 100));
    });
    render(<WamPluginLoader />);
    const loadBtns = screen.getAllByText('Load');
    const demoLoadBtn = loadBtns[loadBtns.length - 1];
    fireEvent.click(demoLoadBtn);
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });

  it('shows active plugins section', () => {
    mockLoadedPlugins = [
      { id: 'webdx7', name: 'DX7 FM Synth', url: '', type: 'synth' },
      { id: 'custom-1', name: 'My Plugin', url: '', type: 'synth' },
    ];
    render(<WamPluginLoader />);
    expect(screen.getByText('Active Plugins (2)')).toBeInTheDocument();
  });

  it('shows loaded state with Check icon for loaded plugins', () => {
    mockLoadedPlugins = [{ id: 'webdx7', name: 'DX7 FM Synth', url: '', type: 'synth' }];
    render(<WamPluginLoader />);
    expect(screen.getAllByText('Loaded').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show active plugins section when none loaded', () => {
    render(<WamPluginLoader />);
    expect(screen.queryByText(/Active Plugins/)).not.toBeInTheDocument();
  });

  it('handles load failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockLoadPlugin.mockRejectedValueOnce(new Error('Load failed'));
    render(<WamPluginLoader />);
    const loadBtns = screen.getAllByText('Load');
    const demoLoadBtn = loadBtns[loadBtns.length - 1];
    const rejectHandler = () => {};
    window.addEventListener('unhandledrejection', rejectHandler);
    fireEvent.click(demoLoadBtn);
    await waitFor(() => {
      expect(mockLoadPlugin).toHaveBeenCalled();
    });
    window.removeEventListener('unhandledrejection', rejectHandler);
    consoleSpy.mockRestore();
  });

  it('shows retry after failed load', async () => {
    render(<WamPluginLoader />);
    expect(onChangeCallback).not.toBeNull();
    if (onChangeCallback) {
      onChangeCallback({ id: 'webdx7', name: 'DX7', url: '', type: 'synth' }, false);
    }
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('shows author for demo plugins', () => {
    render(<WamPluginLoader />);
    const authors = screen.getAllByText('WAM Community');
    expect(authors.length).toBeGreaterThanOrEqual(1);
  });

  it('shows plugin type badge', () => {
    render(<WamPluginLoader />);
    const badges = screen.getAllByText('synth');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('shows online status for loaded plugins', () => {
    mockLoadedPlugins = [{ id: 'webdx7', name: 'DX7 FM Synth', url: '', type: 'synth' }];
    render(<WamPluginLoader />);
    expect(screen.getByText('online')).toBeInTheDocument();
  });

  it('handles rapid load/unload without crashing', () => {
    render(<WamPluginLoader />);
    const loadBtns = screen.getAllByText('Load');
    const demoLoadBtns = loadBtns.filter(b => b.closest('[class*="space-y-2"]') !== null);
    if (demoLoadBtns.length >= 2) {
      fireEvent.click(demoLoadBtns[0]);
      fireEvent.click(demoLoadBtns[1]);
    }
    expect(mockLoadPlugin).toHaveBeenCalled();
  });

  it('hides custom URL input on second toggle', () => {
    render(<WamPluginLoader />);
    fireEvent.click(screen.getByText('Custom URL'));
    expect(screen.getByPlaceholderText('https://example.com/plugin.js')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Custom URL'));
    expect(screen.queryByPlaceholderText('https://example.com/plugin.js')).not.toBeInTheDocument();
  });
});
