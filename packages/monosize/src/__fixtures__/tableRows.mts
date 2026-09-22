import stripAnsi from 'strip-ansi';
import { assert } from 'vitest';

export function tableRows(output: unknown): string[][] {
  assert(typeof output === 'string');
  return stripAnsi(output)
    .split('\n')
    .filter(line => line.startsWith('│'))
    .map(line =>
      line
        .split('│')
        .slice(1, -1)
        .map(cell => cell.trim()),
    );
}
