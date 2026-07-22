import { describe, expect, it } from 'vitest';
import { shortPlace } from '@/lib/placeFormat';

describe('placeFormat utilities', () => {
  it('shortens addresses to city and state', () => {
    expect(shortPlace('1080 Olivia Dr, Oakdale, PA, 15071')).toBe('Oakdale, PA');
  });

  it('strips country suffixes while preserving a state label', () => {
    expect(shortPlace('Chicago, Cook County, Illinois, USA')).toBe('Chicago, Illinois');
  });

  it('returns empty string for missing input', () => {
    expect(shortPlace()).toBe('');
  });
});
