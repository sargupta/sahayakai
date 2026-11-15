/**
 * Settings → Calling provider. The school owns its provider: the card shows it with its price,
 * an admin changes it on the same choice cards (price per minute + monthly estimate for this
 * school), and the change is saved for the school. On an internal demo deployment (the per-session
 * chooser on), the card shows the session choice and a Switch link instead, as before.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('next/navigation', () => ({ usePathname: () => '/sampark/sargvision-local/settings', useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/components/sampark/school-context', () => ({ useSamparkSchool: () => ({ orgId: 'sargvision-local' }) }));

const getProviderChoice = jest.fn();
const getSchoolProvider = jest.fn();
const setSchoolProvider = jest.fn();
jest.mock('@/lib/api/sampark', () => ({
    ...jest.requireActual('@/lib/api/sampark'),
    getProviderChoice: (...a: unknown[]) => getProviderChoice(...a),
    getSchoolProvider: (...a: unknown[]) => getSchoolProvider(...a),
    setSchoolProvider: (...a: unknown[]) => setSchoolProvider(...a),
}));

import { ConversationProviderSection } from '@/components/sampark/settings-mode';

const options = [
    { id: 'elevenlabs', available: true, price: { inrPerMinute: 9, asOf: '2026-11-15' }, differences: ['Calls run on the hosted ElevenLabs voice agent'] },
    { id: 'vobiz', available: true, price: { inrPerMinute: 4, asOf: '2026-11-15' }, differences: ['No call audio is stored'] },
];
const state = (over: Record<string, unknown> = {}) => ({
    provider: 'elevenlabs', chosen: true, options,
    estimateDefaults: { families: 500, callsPerFamilyPerMonth: 2, minutesPerCall: 2 },
    demoChooser: false, ...over,
});

beforeEach(() => {
    getProviderChoice.mockReset();
    getSchoolProvider.mockReset();
    setSchoolProvider.mockReset();
});

it("shows the school's provider and its price; no session Switch link", async () => {
    getSchoolProvider.mockResolvedValue(state());
    render(<ConversationProviderSection />);
    await waitFor(() => expect(screen.getByTestId('school-provider').textContent).toBe('ElevenLabs Calls'));
    expect(screen.getByText('₹9 per connected minute')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Switch provider' })).toBeNull();
    expect(getSchoolProvider).toHaveBeenCalledWith('sargvision-local', expect.anything());
});

it('says when the school has not chosen yet (the default is in force)', async () => {
    getSchoolProvider.mockResolvedValue(state({ chosen: false }));
    render(<ConversationProviderSection />);
    await waitFor(() => expect(screen.getByText('Default, not chosen yet')).toBeTruthy());
});

it('an admin compares both on budget and switches the school to Vobiz', async () => {
    getSchoolProvider.mockResolvedValue(state());
    setSchoolProvider.mockResolvedValue(state({ provider: 'vobiz' }));
    render(<ConversationProviderSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change provider' }));
    // 500 families × 2 calls × 2 minutes × price.
    expect(screen.getByTestId('provider-estimate-elevenlabs').textContent).toBe('About ₹18,000 a month');
    expect(screen.getByTestId('provider-estimate-vobiz').textContent).toBe('About ₹8,000 a month');
    fireEvent.click(screen.getByTestId('provider-card-vobiz'));
    fireEvent.click(screen.getByRole('button', { name: 'Save provider' }));
    await waitFor(() => expect(setSchoolProvider).toHaveBeenCalledWith('sargvision-local', 'vobiz'));
});

it('a provider the deployment has not set up cannot be picked; a missing price is never a number', async () => {
    getSchoolProvider.mockResolvedValue(state({ options: [options[0], { ...options[1], available: false, price: { inrPerMinute: null, asOf: null } }] }));
    render(<ConversationProviderSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change provider' }));
    expect((screen.getByTestId('provider-card-vobiz') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('provider-price-vobiz').textContent).toBe('Price not set yet');
    expect(screen.queryByTestId('provider-estimate-vobiz')).toBeNull();
});

it('demo deployment: shows the session provider and a Switch link back to the chooser', async () => {
    getSchoolProvider.mockResolvedValue(state({ demoChooser: true }));
    getProviderChoice.mockResolvedValue({ choice: 'vobiz', options: [] });
    render(<ConversationProviderSection />);
    await waitFor(() => expect(screen.getByText('Vobiz Calls')).toBeTruthy());
    const link = screen.getByRole('link', { name: 'Switch provider' });
    expect(link.getAttribute('href')).toBe('/sampark/choose-provider?next=%2Fsampark%2Fsargvision-local%2Fsettings&switch=1');
});
