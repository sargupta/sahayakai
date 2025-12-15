import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from '@/hooks/use-toast';

describe('useToast Hook', () => {
    beforeEach(() => {
        // Reset internal state if possible, or just rely on isolation.
        // Since module state is singleton-ish in use-toast.ts (memoryState), 
        // we might need to be careful. Ideally useToast should be refactored for testing, 
        // but for now we test behavior.
        act(() => {
            toast({ title: "Reset", duration: 0 });
        });
    });

    it('should add a toast', () => {
        const { result } = renderHook(() => useToast());

        act(() => {
            toast({ title: "Test Toast" });
        });

        expect(result.current.toasts.length).toBeGreaterThan(0);
        expect(result.current.toasts[0].title).toBe("Test Toast");
    });

    it('should dismiss a toast', () => {
        const { result } = renderHook(() => useToast());
        let toastId: string;

        act(() => {
            const t = toast({ title: "To Dismiss" });
            toastId = t.id;
        });

        expect(result.current.toasts.find(t => t.id === toastId!)?.open).toBe(true);

        act(() => {
            result.current.dismiss(toastId!);
        });

        expect(result.current.toasts.find(t => t.id === toastId!)?.open).toBe(false);
    });

    it('should respect toast limit', () => {
        const { result } = renderHook(() => useToast());

        act(() => {
            toast({ title: "Toast 1" });
            toast({ title: "Toast 2" });
            toast({ title: "Toast 3" });
        });

        // Limit is 1 in source code
        expect(result.current.toasts.length).toBe(1);
        expect(result.current.toasts[0].title).toBe("Toast 3");
    });
});
