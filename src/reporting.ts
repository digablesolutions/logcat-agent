export type ReportLevel = 'info' | 'success' | 'warning' | 'error' | 'gray';

export interface ReportMessage {
  level: ReportLevel;
  message: string;
}

export interface ReportSink {
  renderInfo(message: string): void;
  renderSuccess(message: string): void;
  renderWarning(message: string): void;
  renderError(message: string): void;
  renderGray(message: string): void;
}

export const renderReport = (sink: ReportSink, report: ReportMessage): void => {
  switch (report.level) {
    case 'success':
      sink.renderSuccess(report.message);
      return;
    case 'warning':
      sink.renderWarning(report.message);
      return;
    case 'error':
      sink.renderError(report.message);
      return;
    case 'gray':
      sink.renderGray(report.message);
      return;
    case 'info':
    default:
      sink.renderInfo(report.message);
  }
};
