import { describe, it, expect, vi } from 'vitest';
import { createPluginManager } from '../src/pluginManager.js';
import type { Plugin, PluginContext } from '../src/pluginTypes.js';
import { Command } from 'commander';

describe('createPluginManager', () => {
  it('should load a plugin', async () => {
    const program = new Command();
    const manager = createPluginManager(program);

    const activateMock = vi.fn().mockResolvedValue(undefined);
    const plugin: Plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      activate: activateMock,
    };

    await manager.loadPlugin(plugin);
    expect(activateMock).toHaveBeenCalled();
  });

  it('should register commands from plugin', async () => {
    const program = new Command();
    const manager = createPluginManager(program);

    const plugin: Plugin = {
      name: 'command-plugin',
      version: '1.0.0',
      activate: async (ctx: PluginContext) => {
        await Promise.resolve();
        ctx.registerCommand(new Command('test-cmd'));
      },
    };

    await manager.loadPlugin(plugin);
    expect(program.commands.find((command) => command.name() === 'test-cmd')).toBeDefined();
  });
});
