import { describe, expect, it } from 'vitest';
import type { Device } from '../src/adb/adbClient.js';
import { createSessionController, selectStreamingDevice } from '../src/cli/sessionSupport.js';

const makeDevice = (overrides: Partial<Device>): Device => {
  const device: Device = {
    serial: overrides.serial ?? 'emulator-5554',
    status: overrides.status ?? 'device',
  };

  if (overrides.model) {
    device.model = overrides.model;
  }

  return device;
};

describe('selectStreamingDevice', () => {
  it('prefers an explicit serial when provided', () => {
    const selection = selectStreamingDevice(
      [makeDevice({ serial: 'USB123', model: 'Pixel' }), makeDevice({ serial: '10.0.0.8:5555' })],
      { serial: '10.0.0.8:5555' }
    );

    expect(selection.serial).toBe('10.0.0.8:5555');
    expect(selection.model).toBeUndefined();
    expect(selection.explicitSerial).toBe(true);
    expect(selection.autoSelected).toBe(false);
  });

  it('uses the preferred serial before other ready devices', () => {
    const selection = selectStreamingDevice(
      [
        makeDevice({ serial: 'USB123', model: 'Pixel' }),
        makeDevice({ serial: '10.0.0.8:5555', model: 'Shield' }),
      ],
      { preferredSerial: '10.0.0.8:5555' }
    );

    expect(selection.serial).toBe('10.0.0.8:5555');
    expect(selection.model).toBe('Shield');
    expect(selection.autoSelected).toBe(true);
  });

  it('prefers network devices when requested', () => {
    const selection = selectStreamingDevice(
      [makeDevice({ serial: 'USB123', model: 'Pixel' }), makeDevice({ serial: '10.0.0.8:5555', model: 'Shield' })],
      { preferNetworkDevice: true }
    );

    expect(selection.serial).toBe('10.0.0.8:5555');
    expect(selection.model).toBe('Shield');
    expect(selection.autoSelected).toBe(true);
  });

  it('throws when no ready devices are available', () => {
    expect(() =>
      selectStreamingDevice([
        makeDevice({ serial: 'USB123', status: 'offline' }),
        makeDevice({ serial: '10.0.0.8:5555', status: 'unauthorized' }),
      ])
    ).toThrow('No device found. Connect a device or pass --serial.');
  });
});

describe('createSessionController', () => {
  it('runs cleanup once and resolves the first shutdown reason', async () => {
    const reasons: string[] = [];
    const session = createSessionController({
      registerSignal: false,
      cleanup: (reason) => {
        reasons.push(reason);
      },
    });

    await session.shutdown('source-close');
    await session.shutdown('completed');

    await expect(session.completion).resolves.toBe('source-close');
    expect(reasons).toEqual(['source-close']);
  });

  it('rejects completion when cleanup fails', async () => {
    const session = createSessionController({
      registerSignal: false,
      cleanup: () => {
        throw new Error('boom');
      },
      onError: () => undefined,
    });

    const completion: Promise<unknown> = session.completion.catch((error: unknown) => error);

    await expect(session.shutdown('completed')).rejects.toThrow('boom');
    await expect(completion).resolves.toMatchObject({ message: 'boom' });
  });
});
