/**
 * Tests for src/components/community/contextual-connect.tsx.
 *
 * Phase-2 fix verified: empty catch replaced with console.error + toast so
 * silent failures stop hiding real bugs.
 */

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ContextualConnect } from '@/components/community/contextual-connect';

// Mock useToast — we want to assert it fires on error.
const toastMock = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: toastMock }),
}));

beforeEach(() => {
    toastMock.mockClear();
    jest.useFakeTimers();
});
afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
});

const baseProps = {
    authorUid: 'uid-target',
    authorName: 'Anita Sharma',
    authorPhotoURL: null,
    reason: 'Same school, same grade',
    onConnect: jest.fn(),
    onDismiss: jest.fn(),
};

describe('ContextualConnect', () => {
    it('renders the prompt with the author name and reason', () => {
        render(<ContextualConnect {...baseProps} />);
        expect(screen.getByText('Connect with Anita Sharma?')).toBeInTheDocument();
        expect(screen.getByText('Same school, same grade')).toBeInTheDocument();
    });

    it('happy path: clicking Connect → onConnect → "Request sent" → onDismiss after 2s', async () => {
        const onConnect = jest.fn().mockResolvedValue(undefined);
        const onDismiss = jest.fn();
        render(<ContextualConnect {...baseProps} onConnect={onConnect} onDismiss={onDismiss} />);

        fireEvent.click(screen.getByRole('button', { name: /connect/i }));
        await waitFor(() => expect(onConnect).toHaveBeenCalledWith('uid-target'));
        await waitFor(() => expect(screen.getByText(/request sent/i)).toBeInTheDocument());

        act(() => { jest.advanceTimersByTime(2000); });
        expect(onDismiss).toHaveBeenCalled();
    });

    it('error path: shows toast and reverts to idle (Phase 2 fix)', async () => {
        // Silence the expected console.error from the component's catch block.
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const onConnect = jest.fn().mockRejectedValue(new Error('network'));
        render(<ContextualConnect {...baseProps} onConnect={onConnect} />);

        fireEvent.click(screen.getByRole('button', { name: /connect/i }));
        await waitFor(() => expect(toastMock).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive' }),
        ));
        // Status should have reverted to idle — the connect button is back.
        await waitFor(() => expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument());
        // Confirm the diagnostic error was logged (Phase 2 stopped silent catches).
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('ContextualConnect: handleConnect failed'),
            expect.any(Error),
        );
        errorSpy.mockRestore();
    });

    it('clicking the X dismiss button calls onDismiss', () => {
        const onDismiss = jest.fn();
        const { container } = render(<ContextualConnect {...baseProps} onDismiss={onDismiss} />);
        // The dismiss button is the icon-only button with the X — find by class position
        const buttons = container.querySelectorAll('button');
        // Last button is the X dismiss
        fireEvent.click(buttons[buttons.length - 1]);
        expect(onDismiss).toHaveBeenCalled();
    });
});
