import type { Device } from '../adb/adbClient.js';
import { AppError, getErrorMessage } from '../errors.js';

export interface DeviceSelectionResult {
  serial: string;
  model?: string | undefined;
  availableDevices: ReadonlyArray<Device>;
  autoSelected: boolean;
  explicitSerial: boolean;
}

export interface DeviceSelectionOptions {
  serial?: string | undefined;
  preferredSerial?: string | null | undefined;
  preferNetworkDevice?: boolean | undefined;
}

export type SessionStopReason = 'signal' | 'source-close' | 'completed';

export interface SessionControllerOptions {
  signal?: NodeJS.Signals | undefined;
  registerSignal?: boolean | undefined;
  cleanup: (reason: SessionStopReason) => Promise<void> | void;
  onError?: ((error: unknown, reason: SessionStopReason) => void) | undefined;
  exitCode?: number | undefined;
  errorExitCode?: number | undefined;
}

export interface SessionController {
  readonly completion: Promise<SessionStopReason>;
  readonly shutdown: (reason?: SessionStopReason) => Promise<SessionStopReason>;
  readonly dispose: () => void;
}

export const formatDeviceLabel = (device: { serial: string; model?: string | undefined }): string =>
  device.model ? `${device.serial} (${device.model})` : device.serial;

export const selectStreamingDevice = (
  devices: ReadonlyArray<Device>,
  options: DeviceSelectionOptions = {}
): DeviceSelectionResult => {
  const availableDevices = devices.filter(device => device.status === 'device');

  if (options.serial) {
    const matchedDevice = devices.find(device => device.serial === options.serial);
    return {
      serial: options.serial,
      model: matchedDevice?.model,
      availableDevices,
      autoSelected: false,
      explicitSerial: true,
    };
  }

  if (availableDevices.length === 0) {
    throw new AppError('No device found. Connect a device or pass --serial.', {
      code: 'DEVICE_NOT_FOUND',
    });
  }

  const chosenDevice =
    (options.preferredSerial
      ? availableDevices.find(device => device.serial === options.preferredSerial)
      : undefined) ||
    (options.preferNetworkDevice
      ? availableDevices.find(device => device.serial.includes(':'))
      : undefined) ||
    availableDevices[0]!;

  return {
    serial: chosenDevice.serial,
    model: chosenDevice.model,
    availableDevices,
    autoSelected: availableDevices.length > 1,
    explicitSerial: false,
  };
};

export const logSelectedDevice = (
  selection: DeviceSelectionResult,
  log: (message: string) => void = console.log
): void => {
  if (!selection.explicitSerial && selection.autoSelected) {
    log('Multiple devices found:');
    selection.availableDevices.forEach((device, index) => {
      log(`  [${index + 1}] ${formatDeviceLabel(device)}`);
    });
    log(`Auto-selecting device: ${formatDeviceLabel(selection)}`);
    return;
  }

  log(`Using device ${formatDeviceLabel(selection)}`);
};

export const createSessionController = (
  options: SessionControllerOptions
): SessionController => {
  const signal = options.signal ?? 'SIGINT';
  const registerSignal = options.registerSignal ?? true;
  let shutdownPromise: Promise<SessionStopReason> | null = null;
  let resolveCompletion: ((reason: SessionStopReason) => void) | null = null;
  let rejectCompletion: ((error: unknown) => void) | null = null;

  const completion = new Promise<SessionStopReason>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const dispose = (): void => {
    if (registerSignal) {
      process.off(signal, listener);
    }
  };

  const shutdown = (
    reason: SessionStopReason = 'completed',
    exitAfterCleanup = false
  ): Promise<SessionStopReason> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      dispose();

      try {
        await options.cleanup(reason);
        resolveCompletion?.(reason);

        if (exitAfterCleanup) {
          process.exit(options.exitCode ?? 0);
        }

        return reason;
      } catch (error: unknown) {
        if (options.onError) {
          options.onError(error, reason);
        } else {
          console.error(`Shutdown failed: ${getErrorMessage(error)}`);
        }

        rejectCompletion?.(error);

        if (exitAfterCleanup) {
          process.exit(options.errorExitCode ?? 1);
        }

        throw error;
      }
    })();

    return shutdownPromise;
  };

  const listener = (): void => {
    void shutdown('signal', true);
  };

  if (registerSignal) {
    process.on(signal, listener);
  }

  return {
    completion,
    shutdown: (reason?: SessionStopReason) => shutdown(reason),
    dispose,
  };
};
