import { describe, expect, it } from 'vitest';
import { getKayakLink, getBookingLink } from '@/utils/deepLinks';

describe('deepLinks utilities', () => {
  it('builds a Kayak rental link with origin and destination', () => {
    const link = getKayakLink({
      origin: 'New York',
      destination: 'Boston',
      pickupDate: '2026-08-01',
      dropoffDate: '2026-08-03',
    });

    expect(link).toContain('https://www.kayak.com/cars/New%20York-Boston');
    expect(link).toContain('2026-08-01');
  });

  it('builds a Booking.com hotel link with default guest count', () => {
    const link = getBookingLink({ city: 'Denver, CO', checkIn: '2026-08-01', checkOut: '2026-08-03' });

    expect(link).toContain('https://www.booking.com/searchresults.html');
    expect(link).toContain('ss=Denver%2C+CO');
    expect(link).toContain('group_adults=2');
  });
});
