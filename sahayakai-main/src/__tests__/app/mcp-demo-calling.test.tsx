/**
 * @jest-environment jsdom
 *
 * /mcp-demo/calling — UI: status pill, class roster from list_parent_contacts
 * (masked phones), Contact dialog with the app's reasons, initiate_parent_call
 * via /api/mcp-demo/calling, result and error rendering.
 */
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/firebase', () => ({ auth: { currentUser: { getIdToken: jest.fn().mockResolvedValue('firebase-id-token') } } }));
jest.mock('@/context/language-context', () => ({ useLanguage: () => ({ t: (k: string) => k, language: 'English' }) }));
const mockAuth = { user: { uid: 'teacher-1' } as unknown, loading: false };
jest.mock('@/context/auth-context', () => ({ useAuth: () => mockAuth }));

import McpCallingDemoPage from '@/app/mcp-demo/calling/page';

const SERVER = { name: 'sahayak-parent-calling', version: '1.0.0', tool: 'initiate_parent_call', protocol: 'Streamable HTTP' };
const CONTACTS = { classes: [{ class_id: 'class-6a', name: 'Class 6A', subject: 'Science', grade: 'Class 6', students: [
    { student_id: 'stu-1', name: 'Ravi Kumar', roll_number: 1, parent_language: 'Hindi', parent_reachable: true, parent_phone_last4: '3210' },
    { student_id: 'stu-2', name: 'Asha', roll_number: 2, parent_language: 'English', parent_reachable: false, parent_phone_last4: '' },
] }] };
const RESULT = { status: 'call_initiated', student_name: 'Ravi Kumar', class_name: 'Class 6A', reason: 'consecutive_absences', parent_language: 'Hindi', parent_phone_last4: '3210', message: 'Namaste, Ravi has been absent since Monday.', spoken_script: null };

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 300, status, json: async () => body });
let callReply: () => Promise<unknown>;

beforeEach(() => {
    callReply = () => reply(200, { result: RESULT, mcp: { ...SERVER, durationMs: 14200 } });
    fetchMock.mockReset().mockImplementation((url: string, init?: RequestInit) => {
        if (!init || init.method === 'GET') return reply(200, { configured: true, connected: true, server: SERVER });
        const body = JSON.parse(String(init.body));
        return body.action === 'list' ? reply(200, { result: CONTACTS, mcp: { ...SERVER, durationMs: 300 } }) : callReply();
    });
    (global as any).fetch = fetchMock;
    mockAuth.user = { uid: 'teacher-1' };
    mockAuth.loading = false;
});
const posts = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST').map(([u, i]) => ({ url: u, body: JSON.parse(i.body) }));

it('shows the MCP status and the masked roster loaded via list_parent_contacts', async () => {
    render(<McpCallingDemoPage />);
    expect(screen.getByText('Parent Outreach', { selector: 'div,h1,h2,h3' })).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId('mcp-status')).getByText('initiate_parent_call')).toBeInTheDocument());
    const rows = await screen.findAllByTestId('mcp-calling-student');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ravi Kumar');
    expect(rows[0]).toHaveTextContent('••••3210');
    expect(within(rows[1]).getByRole('button', { name: /Contact/ })).toBeDisabled();
    expect(posts()[0]).toEqual({ url: '/api/mcp-demo/calling', body: { action: 'list' } });
});

it('Contact → reason → Call parent sends initiate_parent_call arguments and shows the started call', async () => {
    render(<McpCallingDemoPage />);
    const [ravi] = await screen.findAllByTestId('mcp-calling-student');
    fireEvent.click(within(ravi).getByRole('button', { name: /Contact/ }));
    const callBtn = await screen.findByRole('button', { name: /Call parent/ });
    expect(callBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Consecutive Absences'));
    fireEvent.change(screen.getByPlaceholderText('Add a note for the parent (optional)'), { target: { value: 'Absent since Monday' } });
    fireEvent.click(callBtn);
    const result = await screen.findByTestId('mcp-call-result');
    expect(result).toHaveTextContent('Call started');
    expect(result).toHaveTextContent('••••3210');
    expect(result).toHaveTextContent('Namaste, Ravi has been absent since Monday.');
    expect(screen.getByTestId('mcp-call-info')).toHaveTextContent('initiate_parent_call');
    expect(posts()[1]).toEqual({ url: '/api/mcp-demo/calling', body: { action: 'call', class_id: 'class-6a', student_id: 'stu-1', reason: 'consecutive_absences', teacher_note: 'Absent since Monday' } });
});

it('shows a clear error (e.g. quiet hours) and keeps the dialog for retry', async () => {
    callReply = () => reply(409, { error: { category: 'outside_allowed_hours', message: 'Parents can only be called between 09:00 and 21:00 IST.', retryable: true } });
    render(<McpCallingDemoPage />);
    const [ravi] = await screen.findAllByTestId('mcp-calling-student');
    fireEvent.click(within(ravi).getByRole('button', { name: /Contact/ }));
    fireEvent.click(await screen.findByText('Positive Feedback'));
    fireEvent.click(screen.getByRole('button', { name: /Call parent/ }));
    const err = await screen.findByTestId('mcp-call-error');
    expect(err).toHaveTextContent('09:00 and 21:00 IST');
    expect(screen.getByRole('button', { name: /Try again/ })).toBeEnabled();
});

it('empty state when the key\'s school has no classes', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method === 'POST'
        ? reply(200, { result: { classes: [] }, mcp: SERVER })
        : reply(200, { configured: true, connected: true, server: SERVER })));
    render(<McpCallingDemoPage />);
    expect(await screen.findByTestId('mcp-calling-empty')).toBeInTheDocument();
});

it('waits for the Firebase session; signed out it asks to sign in and calls nothing', async () => {
    mockAuth.user = null;
    render(<McpCallingDemoPage />);
    expect(await screen.findByTestId('mcp-calling-list-error')).toHaveTextContent('Sign in to Sahayak to use this demo.');
    expect(within(screen.getByTestId('mcp-status')).getByText('Not connected')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
});
