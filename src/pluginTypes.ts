import type { Command } from 'commander';

export interface PluginContext {
  registerCommand(command: Command): void;
  // Future: registerSource, registerRenderer, etc.
}

export interface Plugin {
  name: string;
  version: string;
  activate(context: PluginContext): Promise<void>;
  deactivate?(): Promise<void>;
}
