/**
 * My calls (teacher and principal both render RiyaCallHistory): each finished call shows its
 * synopsis bullets, the collected answers as a separate structured list, the callback status
 * (requested ≠ scheduled), and an honest note while the synopsis is provisional. There is no
 * transcript in the view type, so nothing can render one; the Details panel says it stays on
 * the server.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';

jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/lib/api/sampark-riya', () => ({
    ...jest.requireActual('@/lib/api/sampark-riya'),
    getRiyaCall: jest.fn(),
    reconcileRiyaCall: jest.fn(async () => ({})),
}));

import { RiyaCallHistory } from '@/components/sampark/riya-call-panel';
import type { CallbackView } from '@/lib/api/sampark-callbacks';
import type { ConversationCallView } from '@/lib/sampark/conversation/types';

const ENDED = new Date(Date.now() - 30 * 60_000).toISOString();

function view(over: Partial<ConversationCallView> = {}): ConversationCallView {
    return {
        id: 'call-1', orgId: 'sargvision-local', provider: 'elevenlabs', state: 'completed', riyaPurpose: 'ptm_invitation',
        createdAt: ENDED, updatedAt: ENDED, endedAt: ENDED, durationSeconds: 113, providerConversationId: 'conv_1',
        announcement: 'PTM on Saturday at 10 AM.', dataCollection: { ptm_attendance: 'cannot_attend', ptm_preferred_time: 'Saturday after 11 AM', callback_requested_time: 'tomorrow at 5 PM', ptm_meeting_mode: 'not_applicable' },
        stopRequested: false, failureReason: null, transcriptExpiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
        synopsis: { bullets: ['Riya shared the PTM date.', 'The parent said they cannot attend.', 'The parent asked to be called back tomorrow at 5 PM.'], callbackRequest: 'tomorrow at 5 PM', source: 'ai', generatedAt: ENDED, status: 'final', transcriptTurns: 15 },
        ...over,
    } as unknown as ConversationCallView;
}

it('shows the synopsis, the answers apart from it, and a requested (not scheduled) callback; no transcript', () => {
    render(<RiyaCallHistory orgId="sargvision-local" calls={[view()]} reload={jest.fn()} storeTranscripts />);
    const bullets = within(screen.getByRole('list', { name: 'Call synopsis' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(bullets).toEqual(['Riya shared the PTM date.', 'The parent said they cannot attend.', 'The parent asked to be called back tomorrow at 5 PM.']);
    const answers = screen.getByLabelText('Collected answers');
    expect(answers.textContent).toContain('Coming to the meeting');
    expect(answers.textContent).toContain('Cannot attend');
    expect(answers.textContent).toContain('Saturday after 11 AM');
    expect(answers.textContent).not.toMatch(/_|Asked to be called back|not applicable/i); // raw keys and the callback field stay out
    expect(screen.getByText('Callback requested')).toBeTruthy();
    expect(screen.getByText('Not in the calendar yet.')).toBeTruthy();
    expect(screen.queryByText('Callback scheduled')).toBeNull();
    expect(screen.queryByText(/Provisional/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Listener:|Riya:/);
});

it('a scheduled callback is shown as scheduled only when the calendar has it', () => {
    const cb = { id: 'cb1', sourceCallId: 'call-1', status: 'scheduled', scheduledAt: '2026-10-31T11:30:00.000Z', requestedText: 'tomorrow at 5 PM', createdAt: ENDED } as unknown as CallbackView;
    render(<RiyaCallHistory orgId="sargvision-local" calls={[view()]} reload={jest.fn()} callbacks={[cb]} />);
    expect(screen.getByText('Callback scheduled')).toBeTruthy();
    expect(screen.queryByText('Callback requested')).toBeNull();
});

it('a provisional synopsis says it will be replaced when the transcript arrives', () => {
    const provisional = view({ synopsis: { bullets: ['PTM invitation call: the call connected and ended normally, 113 s.', 'No conversation was recorded.', 'The listener did not speak.'], callbackRequest: null, source: 'rules', generatedAt: ENDED, status: 'provisional', transcriptTurns: 0 }, transcriptExpiresAt: null, dataCollection: {} } as Partial<ConversationCallView>);
    render(<RiyaCallHistory orgId="sargvision-local" calls={[provisional]} reload={jest.fn()} storeTranscripts />);
    expect(screen.getByText(/Provisional: written before the provider sent the conversation/)).toBeTruthy();
    expect(screen.queryByLabelText('Collected answers')).toBeNull();
    expect(screen.getByText(/Updating call status every 15 seconds/)).toBeTruthy(); // auto-refresh keeps looking
});
