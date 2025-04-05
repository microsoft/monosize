import { describe, expect, test } from 'vitest';
import { formatHrTime } from './helpers.mjs';

describe('formatHrTime', () => {
  test('formats hrtime to seconds', () => {
    const hrtime = [1, 500000000] satisfies [number, number]; // 1.5 seconds
    expect(formatHrTime(hrtime)).toBe('1.50s');
  });

  test('formats hrtime to milliseconds', () => {
    const hrtime = [0, 150000000] satisfies [number, number]; // 0.15 seconds
    expect(formatHrTime(hrtime)).toBe('150ms');
  });
});
