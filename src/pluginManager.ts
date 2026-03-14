import type { Command } from 'commander';
import type { Plugin, PluginContext } from './pluginTypes.js';

export interface PluginManager {
  readonly loadPlugin: (plugin: Plugin) => Promise<void>;
  readonly unloadPlugin: (name: string) => Promise<void>;
}

const createPluginContext = (program: Command): PluginContext => {
  return {
    registerCommand: (command) => {
      program.addCommand(command);
    },
  };
};

export const createPluginManager = (program: Command): PluginManager => {
  const plugins = new Map<string, Plugin>();
  const context = createPluginContext(program);

  return {
    loadPlugin: async (plugin) => {
      if (plugins.has(plugin.name)) {
        console.warn(`Plugin ${plugin.name} already loaded.`);
        return;
      }

      await plugin.activate(context);
      plugins.set(plugin.name, plugin);
    },
    unloadPlugin: async (name) => {
      const plugin = plugins.get(name);
      if (!plugin) {
        return;
      }

      if (plugin.deactivate) {
        await plugin.deactivate();
      }

      plugins.delete(name);
    },
  };
};
