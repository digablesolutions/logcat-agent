import { Command } from 'commander';
import chalk from 'chalk';
import { listDevices, type Device } from '../../adb/adbClient.js';

type DevicesOptions = Readonly<{
  long?: boolean;
}>;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'device':
      return chalk.green;
    case 'unauthorized':
      return chalk.yellow;
    default:
      return chalk.red;
  }
};

const renderDevice = (device: Device, index: number, isLong: boolean): void => {
  const color = getStatusColor(device.status);
  if (isLong) {
    console.log(`[${index + 1}] ${chalk.bold(device.serial)}`);
    console.log(`    Status: ${color(device.status)}`);
    if (device.model) {
      console.log(`    Model:  ${device.model}`);
    }
    console.log();
  } else {
    const modelInfo = device.model ? ` (${device.model})` : '';
    console.log(`  ${chalk.bold(device.serial)} - ${color(device.status)}${modelInfo}`);
  }
};

const performListDevices = async ({ long }: DevicesOptions): Promise<void> => {
  try {
    const devices: ReadonlyArray<Device> = await listDevices();

    if (devices.length === 0) {
      console.log('No devices found.');
      console.log('Make sure:');
      console.log('  - Device is connected via USB or WiFi');
      console.log('  - USB debugging is enabled');
      console.log('  - Device is authorized for ADB');
      return;
    }

    console.log(`Found ${devices.length} device${devices.length > 1 ? 's' : ''}:`);
    console.log();

    devices.forEach((device, index) => renderDevice(device, index, !!long));

    const readyDevices = devices.filter((d) => d.status === 'device');
    if (readyDevices.length === 0) {
      console.log(chalk.yellow('No devices are ready for logcat streaming.'));
      console.log('Check device authorization and connection status.');
    } else if (readyDevices.length === 1) {
      console.log(chalk.green(`✓ ${readyDevices[0]!.serial} is ready for streaming`));
    } else {
      console.log(chalk.green(`✓ ${readyDevices.length} devices ready for streaming`));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Failed to list devices: ${message}`));
    console.error('Make sure ADB is installed and in your PATH.');
  }
};

export const devicesCmd = new Command('devices')
  .description('List connected Android devices')
  .option('-l, --long', 'show detailed device information')
  .action((opts: DevicesOptions) => {
    void performListDevices(opts);
  });
