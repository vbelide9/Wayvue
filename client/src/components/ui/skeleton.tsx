import { cn } from '@/lib/utils';

/** Pulsing placeholder block used while trip data streams in. */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-secondary', className)}
            aria-hidden="true"
        />
    );
}
