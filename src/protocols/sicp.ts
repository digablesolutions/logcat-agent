/**
 * Simple helpers for Philips SICP protocol framing.
 *
 * Frame layout:
 *  [0] Size (total bytes in frame, including checksum)
 *  [1] Control (Monitor ID)
 *  [2] Group
 *  [3..N-2] Data bytes
 *  [N-1] Checksum = XOR of all bytes except the checksum itself
 */

export interface SicpFrame {
  size: number;
  control: number;
  group: number;
  data: number[];
  checksum: number;
  valid: boolean;
}

export function xorChecksum(bytes: Uint8Array | number[]): number {
  let c = 0;
  for (const byte of Array.from(bytes)) c ^= byte & 0xff;
  return c & 0xff;
}

/**
 * Build a SICP frame. Computes size and checksum automatically.
 */
export function buildSicp(control: number, group: number, data: number[] = []): Uint8Array {
  const size = 4 + data.length; // size + control + group + data + checksum
  const buf = new Uint8Array(size);
  buf[0] = size & 0xff;
  buf[1] = control & 0xff;
  buf[2] = group & 0xff;
  for (let i = 0; i < data.length; i++) buf[3 + i] = data[i]! & 0xff;
  // checksum is XOR of all bytes except checksum itself
  const cs = xorChecksum(buf.subarray(0, size - 1));
  buf[size - 1] = cs;
  return buf;
}

/**
 * Try to parse a SICP frame from a buffer. Does not validate that the buffer contains only one frame.
 */
export function parseSicpFrame(buf: Uint8Array): SicpFrame | null {
  if (!buf || buf.length < 3) return null;
  const size = buf[0] ?? 0;
  if (size < 3 || size > 0x28) return null;
  if (buf.length < size) return null;
  const control = buf[1] ?? 0;
  const group = buf[2] ?? 0;
  const data = Array.from(buf.slice(3, size - 1));
  const checksum = buf[size - 1] ?? 0;
  const expected = xorChecksum(buf.slice(0, size - 1));
  return { size, control, group, data, checksum, valid: checksum === expected };
}

export type SicpReplyKind = 'ACK' | 'NAV' | 'NACK' | 'REPORT' | 'UNKNOWN';

/**
 * Best-effort classification of a SICP reply, based on documentation examples.
 * Many replies are 6 bytes (size=6), with data[0]=0 and data[1] indicating type.
 */
export function classifySicpReply(frame: SicpFrame): SicpReplyKind {
  if (frame.data.length >= 2 && frame.data[0] === 0x00) {
    switch (frame.data[1]) {
      case 0x06:
        return 'ACK';
      case 0x18:
        return 'NAV';
      case 0x15:
        return 'NACK';
      default:
        return 'REPORT';
    }
  }
  // If data[0] is 0x15 (serial report) or any other structured response, treat as REPORT
  if (frame.data.length >= 1) return 'REPORT';
  return 'UNKNOWN';
}

export function toHex(bytes: Uint8Array | number[], sep = ' '): string {
  return Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(sep);
}

export function toAscii(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map(b => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
    .join('');
}

/**
 * Convenience: Build a SICP Get-Serial command.
 * Docs example: size=0x05, control=<id>, group=0x00, data[0]=0x15
 */
export function buildSicpGetSerial(control: number, group = 0x00): Uint8Array {
  return buildSicp(control, group, [0x15]);
}

/**
 * Convenience: Build a SICP Monitor Restart command.
 * DATA[0] = 0x57, DATA[1] = target (0x00 Android, 0x01 Scalar)
 * Typically group=0x00 per docs.
 */
export function buildSicpRestart(control: number, target = 0x00, group = 0x00): Uint8Array {
  return buildSicp(control, group, [0x57, target & 0xff]);
}

/**
 * Parse a SICP Serial Number report.
 * Expect data[0] = 0x15 and 14 ASCII chars following in data[1..14].
 * Returns the serial string, or null if the frame doesn't match.
 */
export function parseSerialFromReport(frame: SicpFrame): string | null {
  if (frame.data.length >= 15 && frame.data[0] === 0x15) {
    const bytes = frame.data.slice(1, 15);
    return toAscii(bytes);
  }
  return null;
}
