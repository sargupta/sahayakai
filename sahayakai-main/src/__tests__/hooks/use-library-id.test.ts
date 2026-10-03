import { renderHook } from '@testing-library/react';
import { useLibraryId } from '@/hooks/use-library-id';

describe('useLibraryId', () => {
    it('uses the generation/restored contentId when present', () => {
        const { result } = renderHook(() => useLibraryId('server-id', { a: 1 }));
        expect(result.current).toBe('server-id');
    });

    it('repeated Saves of the same result reuse one fallback id (idempotent)', () => {
        const artifact = { title: 'Plan A' };
        const { result, rerender } = renderHook(({ a }) => useLibraryId(null, a), { initialProps: { a: artifact } });
        const first = result.current;
        rerender({ a: artifact });
        expect(result.current).toBe(first);
    });

    it('a DIFFERENT result in the same mounted display gets a new id (never overwrites the previous save)', () => {
        const { result, rerender } = renderHook(({ a }) => useLibraryId(undefined, a), { initialProps: { a: { title: 'Plan A' } as object } });
        const first = result.current;
        rerender({ a: { title: 'Plan B' } });
        expect(result.current).not.toBe(first);
    });
});
