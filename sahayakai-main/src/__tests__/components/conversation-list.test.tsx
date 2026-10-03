/**
 * My Library → Conversations tab.
 *
 * Lists EVERY retained VIDYA conversation (/api/vidya/session?list=1) — the
 * teacher never has to bookmark anything for a chat to appear. The bookmark is
 * a separate "keep" toggle (PATCH saved) that never removes the conversation
 * from the list, and nothing here ever calls a content (Generations) endpoint.
 *
 * The mocked `user` / `t` are deliberately NEW objects every render (the real
 * LanguageProvider recreates `t` per render): the list must not refetch on
 * identity churn and clobber an open/bookmark in flight.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({ user: { uid: 't1', getIdToken: async () => 'tok' } }),
}));
jest.mock('@/context/language-context', () => ({ useLanguage: () => ({ t: (s: string) => s }) }));
const toast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
jest.mock('@/components/layout', () => ({
    EmptyState: ({ title }: { title: string }) => <div data-testid="empty">{title}</div>,
}));

import { ConversationList } from '@/components/library/conversation-list';

const fetchMock = jest.fn();
beforeEach(() => {
    fetchMock.mockReset();
    toast.mockReset();
    (global as any).fetch = fetchMock;
});
const ok = (body: unknown) => Promise.resolve({ ok: true, json: async () => body });

const ITEMS = [
    { id: 's-chat', title: 'Who are you and what can you help me with?', saved: false, updatedAt: '2026-10-03T10:00:00Z', messageCount: 2 },
    { id: 's-kept', title: 'Fractions help', saved: true, updatedAt: '2026-10-02T10:00:00Z', messageCount: 4 },
];

it('shows the empty state when the teacher has not chatted yet', async () => {
    fetchMock.mockReturnValueOnce(ok({ items: [] }));
    render(<ConversationList />);
    expect(await screen.findByTestId('empty')).toHaveTextContent('No conversations yet');
    expect(fetchMock).toHaveBeenCalledWith('/api/vidya/session?list=1', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
    }));
});

it('lists ordinary (un-bookmarked) chats automatically, alongside bookmarked ones', async () => {
    fetchMock.mockReturnValueOnce(ok({ items: ITEMS }));
    render(<ConversationList />);
    expect(await screen.findByText('Who are you and what can you help me with?')).toBeInTheDocument();
    expect(screen.getByText('Fractions help')).toBeInTheDocument();
    const [chatToggle, keptToggle] = screen.getAllByRole('button', { name: /Save conversation|Saved/ });
    expect(chatToggle).toHaveAttribute('aria-pressed', 'false');
    expect(keptToggle).toHaveAttribute('aria-pressed', 'true');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no refetch on identity churn
});

it('opens a transcript, and the bookmark toggles keep-state without removing the conversation', async () => {
    fetchMock.mockReturnValueOnce(ok({ items: ITEMS }));
    render(<ConversationList />);
    await screen.findByText('Who are you and what can you help me with?');

    fetchMock.mockReturnValueOnce(ok({
        sessionId: 's-chat', title: 'Who are you and what can you help me with?',
        messages: [{ role: 'user', parts: [{ text: 'Who are you?' }] }, { role: 'model', parts: [{ text: 'I am VIDYA.' }] }],
    }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);
    expect(await screen.findByText('I am VIDYA.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/vidya/session?id=s-chat', expect.anything());
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fetchMock.mockReturnValueOnce(ok({ success: true }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save conversation' })[0]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Saved' })).toHaveLength(2));
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('/api/vidya/session');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ sessionId: 's-chat', saved: true });

    fetchMock.mockReturnValueOnce(ok({ success: true }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Saved' })[1]); // un-bookmark the kept one
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Save conversation' })).toHaveLength(1));
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ sessionId: 's-kept', saved: false });
    expect(screen.getByText('Fractions help')).toBeInTheDocument(); // still listed

    for (const [u] of fetchMock.mock.calls) expect(String(u)).not.toMatch(/\/api\/content/);
});
