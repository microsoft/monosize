import prettyBytes from 'pretty-bytes';
import process from 'node:process';
import type { ThresholdValue } from '../types.mjs';

/**
 * Formats a number of bytes into a human-readable string.
 *
 * @param value - The number of bytes to format.
 */
export function formatBytes(value: number): string {
  return prettyBytes(value, { maximumFractionDigits: 3 });
}

export function formatHrTime(hrtime: ReturnType<typeof process.hrtime>): string {
  const number = hrtime[0] * 1e9 + hrtime[1];

  if (number >= 1e9) {
    return (number / 1e9).toFixed(2) + 's';
  }

  return (number / 1e6).toFixed(0) + 'ms';
}

/**
 * Parses a limit value from a string.
 *
 * @param value - The limit value to parse (10kB, 10%, 10
 */
export function parseThreshold(value: string): ThresholdValue {
  if (value.match(/^(\d+\.)?\d+\s?kB$/)) {
    const size = parseFloat(value.slice(0, -2).trimEnd()) * 1024;

    if (isNaN(size)) {
      throw new Error(`Invalid threshold value: ${value}`);
    }

    return { size, type: 'size' };
  }

  if (value.match(/^\d+\s?%$/)) {
    const size = parseFloat(value.slice(0, -1));

    if (isNaN(size) || size > 100 || size <= 0) {
      throw new Error(`Invalid threshold value: ${value}`);
    }

    return { size, type: 'percent' };
  }

  throw new Error(`Invalid threshold value: ${value}`);
}
