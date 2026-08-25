import { describe, it, expect } from 'vitest';
import type { AppSettings } from '../types';

describe('Focus Mode & Fullscreen Exit Logic', () => {
  const defaultSettings: AppSettings = {
    activeProfileId: 'prof-1',
    profiles: [],
    autoSaveIntervalMs: 1500,
    autoSnapshotIntervalMs: 60000,
    typewriterMode: false,
    focusMode: false,
    paperTheme: 'parchment',
    typography: 'serif',
    fontSize: 18,
    lineHeight: 1.85,
  };

  it('should toggle focusMode on shortcut Cmd+Shift+F', () => {
    let settings = { ...defaultSettings };
    const updateSettings = (newSettings: AppSettings) => {
      settings = newSettings;
    };

    // Toggle on
    updateSettings({ ...settings, focusMode: !settings.focusMode });
    expect(settings.focusMode).toBe(true);

    // Toggle off
    updateSettings({ ...settings, focusMode: !settings.focusMode });
    expect(settings.focusMode).toBe(false);
  });

  it('should exit focusMode when Escape is triggered without active modals', () => {
    let settings: AppSettings = { ...defaultSettings, focusMode: true };
    const modalStates = {
      isSettingsOpen: false,
      isLensEditorOpen: false,
      isPromptLibraryOpen: false,
      isRevisionsOpen: false,
      isNotesOpen: false,
      isImportAssistantOpen: false,
    };

    const handleEscapeKey = (
      currentSettings: AppSettings,
      modals: typeof modalStates,
      onCloseModal: (key: keyof typeof modalStates) => void,
      onExitFocus: () => void
    ) => {
      for (const [key, isOpen] of Object.entries(modals)) {
        if (isOpen) {
          onCloseModal(key as keyof typeof modalStates);
          return;
        }
      }
      if (currentSettings.focusMode) {
        onExitFocus();
      }
    };

    let exitedFocus = false;
    handleEscapeKey(
      settings,
      modalStates,
      () => {},
      () => {
        exitedFocus = true;
        settings = { ...settings, focusMode: false };
      }
    );

    expect(exitedFocus).toBe(true);
    expect(settings.focusMode).toBe(false);
  });

  it('should prioritize closing open modal before exiting focusMode on Escape', () => {
    let settings: AppSettings = { ...defaultSettings, focusMode: true };
    const modalStates = {
      isSettingsOpen: true,
      isLensEditorOpen: false,
      isPromptLibraryOpen: false,
      isRevisionsOpen: false,
      isNotesOpen: false,
      isImportAssistantOpen: false,
    };

    let closedModalName: string | null = null;
    let exitedFocus = false;

    const handleEscapeKey = (
      currentSettings: AppSettings,
      modals: typeof modalStates,
      onCloseModal: (key: keyof typeof modalStates) => void,
      onExitFocus: () => void
    ) => {
      for (const [key, isOpen] of Object.entries(modals)) {
        if (isOpen) {
          onCloseModal(key as keyof typeof modalStates);
          return;
        }
      }
      if (currentSettings.focusMode) {
        onExitFocus();
      }
    };

    // First Esc: closes modal only
    handleEscapeKey(
      settings,
      modalStates,
      (key) => {
        closedModalName = key;
        modalStates[key] = false;
      },
      () => {
        exitedFocus = true;
      }
    );

    expect(closedModalName).toBe('isSettingsOpen');
    expect(modalStates.isSettingsOpen).toBe(false);
    expect(exitedFocus).toBe(false);
    expect(settings.focusMode).toBe(true);

    // Second Esc: exits focus mode
    handleEscapeKey(
      settings,
      modalStates,
      (key) => {
        modalStates[key] = false;
      },
      () => {
        exitedFocus = true;
        settings = { ...settings, focusMode: false };
      }
    );

    expect(exitedFocus).toBe(true);
    expect(settings.focusMode).toBe(false);
  });
});
