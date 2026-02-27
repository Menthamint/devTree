/** @vitest-environment happy-dom */
import React from 'react';

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationProvider } from '@/lib/confirmationContext';
import { I18nProvider } from '@/lib/i18n';
import { useRecordingStore } from '@/lib/recordingStore';
import { useSettingsStore } from '@/lib/settingsStore';

import { attemptStartRecording } from './recordingHelpers';
import { VoiceDictationButton } from './VoiceDictationButton';

describe('VoiceDictationButton integration (helper)', () => {
  beforeEach(() => {
    useRecordingStore.setState({
      isRecording: false,
      recordingBlockId: null,
      cancelRecordingCallback: () => {},
    });
  });

  it('uses attemptStartRecording helper correctly (sanity)', async () => {
    const startFn = vi.fn();
    const confirm = vi.fn(() => Promise.resolve(true));

    await attemptStartRecording({ blockId: 'b1', startFn, confirm });

    expect(startFn).toHaveBeenCalled();
  });
});

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider>
      <ConfirmationProvider>{component}</ConfirmationProvider>
    </I18nProvider>,
  );
};

describe('VoiceDictationButton', () => {
  it('renders without crashing', () => {
    const handleTextRecognized = vi.fn();
    const { container } = renderWithProviders(
      <VoiceDictationButton onTextRecognized={handleTextRecognized} />,
    );
    expect(container).toBeInTheDocument();
  });

  it('accepts language prop', () => {
    const handleTextRecognized = vi.fn();
    const { container } = renderWithProviders(
      <VoiceDictationButton onTextRecognized={handleTextRecognized} language="uk" />,
    );
    expect(container).toBeInTheDocument();
  });

  it('defaults to English language', () => {
    const handleTextRecognized = vi.fn();
    const { container } = renderWithProviders(
      <VoiceDictationButton onTextRecognized={handleTextRecognized} />,
    );
    expect(container).toBeInTheDocument();
  });

  it('accepts onTextRecognized callback prop', () => {
    const handleTextRecognized = vi.fn();
    renderWithProviders(
      <VoiceDictationButton onTextRecognized={handleTextRecognized} language="en" />,
    );
    expect(handleTextRecognized).not.toHaveBeenCalled();
  });

  it('formats recognized dictation text before emitting callback', async () => {
    vi.useFakeTimers();

    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36',
      configurable: true,
    });

    type MockRecognition = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: ((event: Event) => void) | null;
      onend: ((event: Event) => void) | null;
      onresult: ((event: SpeechRecognitionEvent) => void) | null;
      onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
      start: () => void;
      stop: () => void;
    };

    const recognitionInstance: MockRecognition = {
      lang: 'en-US',
      continuous: false,
      interimResults: false,
      onstart: null,
      onend: null,
      onresult: null,
      onerror: null,
      start() {
        this.onstart?.(new Event('start'));
      },
      stop() {
        this.onend?.(new Event('end'));
      },
    };

    const MockSpeechRecognitionConstructor = function MockSpeechRecognition() {
      // Return mock instance from constructor (matches SpeechRecognition behavior in some engines)
      return recognitionInstance as SpeechRecognition;
    };

    (
      globalThis as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }
    ).webkitSpeechRecognition =
      MockSpeechRecognitionConstructor as unknown as typeof SpeechRecognition;

    const handleTextRecognized = vi.fn();
    renderWithProviders(
      <VoiceDictationButton
        onTextRecognized={handleTextRecognized}
        language="en"
        blockId="block-1"
      />,
    );

    const button = screen.getByTitle('Start voice dictation');
    fireEvent.mouseDown(button);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Web Speech API returns literal punctuation (not spoken-word punctuation like "comma", "period")
    const finalResult = Object.assign([{ transcript: 'hello, world?' }], {
      isFinal: true,
    });

    await act(async () => {
      recognitionInstance.onresult?.({
        resultIndex: 0,
        results: [finalResult],
      } as unknown as SpeechRecognitionEvent);

      const onEndResult = recognitionInstance.onend?.(new Event('end'));
      if (onEndResult && typeof (onEndResult as Promise<void>).then === 'function') {
        await Promise.resolve(onEndResult);
      }
    });

    // Wait a bit for async formatting to complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // The punctuation service preserves existing punctuation and capitalizes
    expect(handleTextRecognized).toHaveBeenCalledWith('Hello, world?');

    delete (globalThis as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
      .webkitSpeechRecognition;
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    vi.useRealTimers();
  });

  it('passes raw text when formatting is disabled', async () => {
    vi.useFakeTimers();

    await act(async () => {
      useSettingsStore.setState({ dictationFormattingEnabled: false });
    });

    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36',
      configurable: true,
    });

    type MockRecognition = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: ((event: Event) => void) | null;
      onend: ((event: Event) => void) | null;
      onresult: ((event: SpeechRecognitionEvent) => void) | null;
      onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
      start: () => void;
      stop: () => void;
    };

    const recognitionInstance: MockRecognition = {
      lang: 'en-US',
      continuous: false,
      interimResults: false,
      onstart: null,
      onend: null,
      onresult: null,
      onerror: null,
      start() {
        this.onstart?.(new Event('start'));
      },
      stop() {
        this.onend?.(new Event('end'));
      },
    };

    const MockSpeechRecognitionConstructor = function MockSpeechRecognition() {
      // Return mock instance from constructor (matches SpeechRecognition behavior in some engines)
      return recognitionInstance as SpeechRecognition;
    };

    (
      globalThis as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }
    ).webkitSpeechRecognition =
      MockSpeechRecognitionConstructor as unknown as typeof SpeechRecognition;

    const handleTextRecognized = vi.fn();
    renderWithProviders(
      <VoiceDictationButton
        onTextRecognized={handleTextRecognized}
        language="en"
        blockId="block-2"
      />,
    );

    const button = screen.getByTitle('Start voice dictation');
    fireEvent.mouseDown(button);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const finalResult = Object.assign([{ transcript: 'hello comma world question mark' }], {
      isFinal: true,
    });

    await act(async () => {
      recognitionInstance.onresult?.({
        resultIndex: 0,
        results: [finalResult],
      } as unknown as SpeechRecognitionEvent);

      const onEndResult = recognitionInstance.onend?.(new Event('end'));
      if (onEndResult && typeof (onEndResult as Promise<void>).then === 'function') {
        await Promise.resolve(onEndResult);
      }
    });

    // Wait for async operations
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // When disabled, raw trimmed text should be passed without formatting
    expect(handleTextRecognized).toHaveBeenCalledWith('hello comma world question mark');

    delete (globalThis as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
      .webkitSpeechRecognition;
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    vi.useRealTimers();
    await act(async () => {
      useSettingsStore.setState({ dictationFormattingEnabled: true });
    });
  });
});
