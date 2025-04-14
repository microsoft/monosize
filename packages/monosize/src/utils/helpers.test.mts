import { describe, expect, test } from 'vitest';
import { formatBytes } from './helpers.mjs';

describe('formatBytes', () => {
  test('formats bytes to human-readable string', () => {
    expect(formatBytes(124)).toBe('124 B');
    expect(formatBytes(1536)).toBe('1.536 kB');
    expect(formatBytes(1624857)).toBe('1.625 MB');
  });
});
