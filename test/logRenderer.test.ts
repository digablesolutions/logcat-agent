import { describe, it, expect, vi } from 'vitest';
import { createConsoleLogRenderer } from '../src/logRenderer.js';
import chalk from 'chalk';

describe('createConsoleLogRenderer', () => {
  it('should render info messages', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const renderer = createConsoleLogRenderer();
    renderer.renderInfo('test info');
    expect(consoleSpy).toHaveBeenCalledWith(chalk.cyan('test info'));
  });

  it('should render error messages', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const renderer = createConsoleLogRenderer();
    renderer.renderError('test error');
    expect(consoleSpy).toHaveBeenCalledWith(chalk.red('test error'));
  });

  it('should render warning messages', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const renderer = createConsoleLogRenderer();
    renderer.renderWarning('test warning');
    expect(consoleSpy).toHaveBeenCalledWith(chalk.yellow('test warning'));
  });

  it('should render realtime summary headings', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const renderer = createConsoleLogRenderer();

    renderer.renderRealtimeSummary(
      {
        total: 10,
        errors: 1,
        warnings: 2,
        startTime: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        isRunning: true,
        bufferSize: 10,
        queueSize: 3,
        totalAnalyses: 4,
        anomaliesDetected: 2,
        trendsDetected: 1,
        aiAnalyses: 5,
      },
      60
    );

    expect(consoleSpy.mock.calls.some(([value]) => value === chalk.cyan('📊 Real-time Analysis Session Summary:'))).toBe(true);
  });

  it('should render multi-device session summary headings', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const renderer = createConsoleLogRenderer();

    renderer.renderMultiDeviceSummary(
      {
        total: 12,
        errors: 2,
        warnings: 3,
        patterns: 4,
        aiAnalyses: 2,
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        deviceCount: 2,
        activeDeviceCount: 1,
        devices: {
          alpha: {
            total: 10,
            errors: 2,
            warnings: 1,
            patterns: 4,
            aiAnalyses: 2,
            startTime: new Date('2026-01-01T00:00:00.000Z'),
            closed: true,
          },
          beta: {
            total: 2,
            errors: 0,
            warnings: 2,
            patterns: 0,
            aiAnalyses: 0,
            startTime: new Date('2026-01-01T00:00:00.000Z'),
            closed: false,
          },
        },
      },
      60
    );

    expect(consoleSpy.mock.calls.some(([value]) => value === chalk.cyan('📊 Multi-device Session Summary:'))).toBe(true);
  });

  it('should render multi-device session headers', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const renderer = createConsoleLogRenderer();

    renderer.renderMultiDeviceHeader({
      deviceCount: 3,
      buffers: ['main', 'crash'],
      minPriority: 'W',
      tags: 'ActivityManager,MyApp',
      aiEnabled: true,
    });

    expect(consoleSpy.mock.calls.some(([value]) => value === chalk.cyan('📡 Multi-device Logcat Session Started'))).toBe(true);
  });
});
