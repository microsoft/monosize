import { describe, expect, test } from 'vitest';
import { formatBytes, formatHrTime, parseThreshold } from './helpers.mjs';

describe('formatBytes', () => {
  test('formats bytes to human-readable string', () => {
    expect(formatBytes(124)).toBe('124 B');
    expect(formatBytes(1536)).toBe('1.536 kB');
    expect(formatBytes(1624857)).toBe('1.625 MB');
  });
});

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

describe('parseThreshold', () => {
  test('parse sizes in kB', () => {
    expect(parseThreshold('10kB')).toEqual({ size: 10240, type: 'size' });
    expect(parseThreshold('1.5 kB')).toEqual({ size: 1536, type: 'size' });
  });

  test('parse percentages', () => {
    expect(parseThreshold('10%')).toEqual({ size: 10, type: 'percent' });
  });
});
