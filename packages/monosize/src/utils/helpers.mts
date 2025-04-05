import prettyBytes from 'pretty-bytes';
import process from 'node:process';

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
