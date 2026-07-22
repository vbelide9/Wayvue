import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingStars } from '@/components/RatingStars';
import { useAuth } from '@/lib/AuthContext';
import { useRating } from '@/lib/useRating';
import { savePendingRating } from '@/lib/pendingRating';

vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/useRating', () => ({
  useRating: vi.fn(),
}));

vi.mock('@/lib/pendingRating', () => ({
  savePendingRating: vi.fn(),
}));

describe('RatingStars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the rating summary and allows a signed-in user to rate', async () => {
    const submit = vi.fn().mockResolvedValue(true);
    vi.mocked(useAuth).mockReturnValue({
      enabled: true,
      user: { id: 'u1' } as any,
      signInWithGoogle: vi.fn(),
    } as any);
    vi.mocked(useRating).mockReturnValue({
      avg: 4.5,
      count: 12,
      myStars: 0,
      saving: false,
      error: null,
      submit,
    } as any);

    render(<RatingStars place={{ placeKey: 'osm-1', name: 'Test Place' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rate 5 stars' }));

    expect(submit).toHaveBeenCalledWith(5);
    expect(screen.getByText('4.5 (12)')).toBeInTheDocument();
  });

  it('stores a pending rating and triggers sign-in for signed-out users', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      enabled: true,
      user: null,
      signInWithGoogle,
    } as any);
    vi.mocked(useRating).mockReturnValue({
      avg: null,
      count: 0,
      myStars: null,
      saving: false,
      error: null,
      submit: vi.fn(),
    } as any);

    render(<RatingStars place={{ placeKey: 'osm-2', name: 'Another Place' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rate 3 stars' }));

    expect(savePendingRating).toHaveBeenCalledWith({
      placeKey: 'osm-2',
      name: 'Another Place',
      type: undefined,
      stars: 3,
    });
    expect(signInWithGoogle).toHaveBeenCalled();
  });
});
