import type { ILogEntry } from './pipeline/types.js';

export interface BaseSessionStats {
  total: number;
  errors: number;
  warnings: number;
  startTime: Date;
}

export interface LogSessionStats extends BaseSessionStats {
  patterns: number;
  aiAnalyses: number;
}

export type RealtimeSessionStats = BaseSessionStats;

export interface MultiDeviceSessionDeviceStats extends LogSessionStats {
  closed: boolean;
}

export interface MultiDeviceSessionStats extends LogSessionStats {
  deviceCount: number;
  activeDeviceCount: number;
  devices: Record<string, MultiDeviceSessionDeviceStats>;
}

export const createBaseSessionStats = (startTime = new Date()): BaseSessionStats => ({
  total: 0,
  errors: 0,
  warnings: 0,
  startTime,
});

export const createLogSessionStats = (startTime = new Date()): LogSessionStats => ({
  ...createBaseSessionStats(startTime),
  patterns: 0,
  aiAnalyses: 0,
});

const createMultiDeviceSessionDeviceStats = (
  startTime = new Date()
): MultiDeviceSessionDeviceStats => ({
  ...createLogSessionStats(startTime),
  closed: false,
});

export const createMultiDeviceSessionStats = (
  deviceSerials: ReadonlyArray<string>,
  startTime = new Date()
): MultiDeviceSessionStats => {
  const devices = Object.fromEntries(
    deviceSerials.map((deviceSerial) => [
      deviceSerial,
      createMultiDeviceSessionDeviceStats(startTime),
    ])
  ) as Record<string, MultiDeviceSessionDeviceStats>;

  return {
    ...createLogSessionStats(startTime),
    deviceCount: deviceSerials.length,
    activeDeviceCount: deviceSerials.length,
    devices,
  };
};

const getOrCreateMultiDeviceStats = (
  stats: MultiDeviceSessionStats,
  deviceSerial: string
): MultiDeviceSessionDeviceStats => {
  const existing = stats.devices[deviceSerial];

  if (existing) {
    return existing;
  }

  const created = createMultiDeviceSessionDeviceStats(stats.startTime);
  stats.devices[deviceSerial] = created;
  stats.deviceCount++;
  stats.activeDeviceCount++;
  return created;
};

export const recordEntryStats = (
  stats: BaseSessionStats,
  entry: Pick<ILogEntry, 'priority'>
): void => {
  stats.total++;

  if (entry.priority === 'E' || entry.priority === 'F') {
    stats.errors++;
  }

  if (entry.priority === 'W') {
    stats.warnings++;
  }
};

export const recordMultiDeviceEntry = (
  stats: MultiDeviceSessionStats,
  deviceSerial: string,
  entry: Pick<ILogEntry, 'priority'>
): void => {
  recordEntryStats(stats, entry);
  recordEntryStats(getOrCreateMultiDeviceStats(stats, deviceSerial), entry);
};

export const recordMultiDevicePattern = (
  stats: MultiDeviceSessionStats,
  deviceSerial: string
): void => {
  stats.patterns++;
  getOrCreateMultiDeviceStats(stats, deviceSerial).patterns++;
};

export const recordMultiDeviceAiAnalysis = (
  stats: MultiDeviceSessionStats,
  deviceSerial: string
): void => {
  stats.aiAnalyses++;
  getOrCreateMultiDeviceStats(stats, deviceSerial).aiAnalyses++;
};

export const markMultiDeviceClosed = (
  stats: MultiDeviceSessionStats,
  deviceSerial: string
): void => {
  const deviceStats = getOrCreateMultiDeviceStats(stats, deviceSerial);
  if (deviceStats.closed) {
    return;
  }

  deviceStats.closed = true;
  stats.activeDeviceCount = Math.max(0, stats.activeDeviceCount - 1);
};

export const getSessionRuntimeSeconds = (
  startTime: Date,
  now = new Date()
): number => Math.floor((now.getTime() - startTime.getTime()) / 1000);

export const getLogsPerMinute = (total: number, runtimeSeconds: number): string =>
  runtimeSeconds > 0 ? ((total / runtimeSeconds) * 60).toFixed(1) : '0';
