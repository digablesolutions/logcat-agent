import { createTcpCommand } from './tcpCommand.js';
import type { Plugin } from './pluginTypes.js';

export const sicpPlugin: Plugin = {
  name: 'sicp',
  version: '1.0.0',
  activate: async (context) => {
    const tcpCmd = createTcpCommand();

    context.registerCommand(tcpCmd);
  },
};
