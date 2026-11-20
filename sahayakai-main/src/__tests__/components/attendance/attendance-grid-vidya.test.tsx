/**
 * AttendanceGrid ↔ VIDYA.
 *
 * - Publishes today's attendance state (counts + ONLY absent/late names;
 *   never ids or parent phone numbers).
 * - "Mark everyone present" runs the grid's own markAllPresent.
 * - "Submit attendance" runs the grid's own handleSubmit →
 *   saveAttendanceAction (the backend authorises it like a manual tap), and
 *   a backend refusal is surfaced, not bypassed.
 */

import { render, screen, waitFor, act } from '@testing-library/react';

jest.mock('next/navigation', () => ({ usePathname: () => '/attendance/class-1' }));
jest.mock('@/context/language-context', () => ({ useLanguage: () => ({ t: (s: string) => s }) }));
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const mockGetForDate = jest.fn();
const mockSave = jest.fn();
jest.mock('@/lib/api/attendance', () => ({
    getAttendanceForDateAction: (...a: unknown[]) => mockGetForDate(...a),
    saveAttendanceAction: (...a: unknown[]) => mockSave(...a),
}));

import { AttendanceGrid } from '@/components/attendance/attendance-grid';
import {
    __resetVidyaAppContextForTests,
    buildVidyaAppContext,
    getRegisteredCapability,
} from '@/lib/vidya/app-context-registry';

const STUDENTS = [
    { id: 's1', classId: 'class-1', rollNumber: 1, name: 'Asha', parentPhone: '+919800000001', parentLanguage: 'Hindi' },
    { id: 's2', classId: 'class-1', rollNumber: 2, name: 'Ravi', parentPhone: '+919800000002', parentLanguage: 'Hindi' },
    { id: 's3', classId: 'class-1', rollNumber: 3, name: 'Meena', parentPhone: '+919800000003', parentLanguage: 'Hindi' },
] as never[];
const PATH = '/attendance/class-1';
const entities = () => buildVidyaAppContext(PATH).entities;

beforeEach(() => {
    jest.clearAllMocks();
    __resetVidyaAppContextForTests();
});

async function renderGrid() {
    render(<AttendanceGrid classId="class-1" students={STUDENTS} date="2026-10-01" />);
    await waitFor(() => expect(screen.getByText('All Present')).toBeTruthy());
}

it('publishes counts and absent names only — no ids, no phone numbers', async () => {
    mockGetForDate.mockResolvedValue({ records: { s1: 'present', s2: 'absent', s3: 'late' } });
    await renderGrid();

    expect(entities()).toMatchObject({
        attendanceDate: '2026-10-01', totalStudents: 3, presentCount: 1, absentCount: 1, lateCount: 1,
        absentStudents: ['Ravi'], lateStudents: ['Meena'], attendanceSubmitted: true, hasUnsavedChanges: false,
    });
    const serialised = JSON.stringify(entities());
    expect(serialised).not.toContain('+9198');
    expect(serialised).not.toContain('"s1"');
});

it('reports "not submitted" when no record exists yet for the date', async () => {
    mockGetForDate.mockResolvedValue(null);
    await renderGrid();

    expect(entities().attendanceSubmitted).toBe(false);
});

it('"mark everyone present" runs the grid\'s own handler and marks unsaved changes', async () => {
    mockGetForDate.mockResolvedValue({ records: { s1: 'absent', s2: 'absent', s3: 'present' } });
    await renderGrid();

    await act(async () => { await getRegisteredCapability('attendance.mark_all_present', PATH)!.run({}); });

    expect(entities()).toMatchObject({ presentCount: 3, absentCount: 0, attendanceSubmitted: false, hasUnsavedChanges: true });
    expect(mockSave).not.toHaveBeenCalled(); // nothing persisted until submit
});

it('"submit attendance" goes through saveAttendanceAction exactly like the button', async () => {
    mockGetForDate.mockResolvedValue(null);
    mockSave.mockResolvedValue(undefined);
    await renderGrid();

    await act(async () => { await getRegisteredCapability('attendance.submit', PATH)!.run({}); });

    expect(mockSave).toHaveBeenCalledWith('class-1', '2026-10-01', { s1: 'present', s2: 'present', s3: 'present' });
    expect(entities().attendanceSubmitted).toBe(true);
});

it('a backend refusal is surfaced and the attendance stays unsubmitted', async () => {
    mockGetForDate.mockResolvedValue(null);
    mockSave.mockRejectedValue(new Error('PREMIUM_REQUIRED'));
    await renderGrid();

    await act(async () => { await getRegisteredCapability('attendance.submit', PATH)!.run({}); });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(entities().attendanceSubmitted).toBe(false);
});
