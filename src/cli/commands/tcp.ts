import { createTcpCommand } from '../../tcpCommand.js';

export const tcpCmd = createTcpCommand({
  description: 'Connect from this host (PC) to remote host:port (Philips SICP over TCP)',
});
