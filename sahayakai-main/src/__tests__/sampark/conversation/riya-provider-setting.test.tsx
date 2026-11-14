/**
 * Settings → Calling provider: shows this session's provider (chosen at the SamparkAI entry)
 * and links back to the one chooser. It no longer sets a school-wide provider.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('next/navigation', () => ({ usePathname: () => '/sampark/sargvision-local/settings', useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

const getProviderChoice = jest.fn();
jest.mock('@/lib/api/sampark', () => ({
    ...jest.requireActual('@/lib/api/sampark'),
    getProviderChoice: (...a: unknown[]) => getProviderChoice(...a),
}));

import { ConversationProviderSection } from '@/components/sampark/settings-mode';

beforeEach(() => getProviderChoice.mockReset());

it('shows the session provider and a Switch link back to the chooser (returning here)', async () => {
    getProviderChoice.mockResolvedValue({ choice: 'vobiz', options: [] });
    render(<ConversationProviderSection />);
    await waitFor(() => expect(screen.getByText('Vobiz Calls')).toBeTruthy());
    const link = screen.getByRole('link', { name: 'Switch provider' });
    expect(link.getAttribute('href')).toBe('/sampark/choose-provider?next=%2Fsampark%2Fsargvision-local%2Fsettings&switch=1');
});

it('says when nothing has been chosen yet and offers no school-wide toggle', async () => {
    getProviderChoice.mockResolvedValue({ choice: null, options: [] });
    render(<ConversationProviderSection />);
    await waitFor(() => expect(screen.getByText('Not chosen yet')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Use .* Calls/ })).toBeNull();
});
