import { describe, expect, it, vi } from 'vitest';
import { renderReport, type ReportSink } from '../src/reporting.js';

const createSink = (): {
  sink: ReportSink;
  renderInfo: ReturnType<typeof vi.fn>;
  renderSuccess: ReturnType<typeof vi.fn>;
  renderWarning: ReturnType<typeof vi.fn>;
  renderError: ReturnType<typeof vi.fn>;
  renderGray: ReturnType<typeof vi.fn>;
} => {
  const renderInfo = vi.fn();
  const renderSuccess = vi.fn();
  const renderWarning = vi.fn();
  const renderError = vi.fn();
  const renderGray = vi.fn();

  return {
    sink: {
      renderInfo,
      renderSuccess,
      renderWarning,
      renderError,
      renderGray,
    },
    renderInfo,
    renderSuccess,
    renderWarning,
    renderError,
    renderGray,
  };
};

describe('renderReport', () => {
  it('routes report levels to the correct renderer methods', () => {
    const sink = createSink();

    renderReport(sink.sink, { level: 'info', message: 'info' });
    renderReport(sink.sink, { level: 'success', message: 'success' });
    renderReport(sink.sink, { level: 'warning', message: 'warning' });
    renderReport(sink.sink, { level: 'error', message: 'error' });
    renderReport(sink.sink, { level: 'gray', message: 'gray' });

    expect(sink.renderInfo).toHaveBeenCalledWith('info');
    expect(sink.renderSuccess).toHaveBeenCalledWith('success');
    expect(sink.renderWarning).toHaveBeenCalledWith('warning');
    expect(sink.renderError).toHaveBeenCalledWith('error');
    expect(sink.renderGray).toHaveBeenCalledWith('gray');
  });
});
