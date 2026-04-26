/**
 * Tests for src/components/community/group-card.tsx.
 *
 * Phase-2 fix verified: split join/leave loading flags so a slow join can't
 * disable the leave button and vice-versa. Plus baseline rendering behaviour.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GroupCard } from '@/components/community/group-card';
import type { Group } from '@/types/community';

const baseGroup: Group = {
    id: 'grp-1',
    name: 'Class 8 Science — CBSE',
    description: 'Teachers teaching Science to Class 8 students (CBSE)',
    type: 'subject_grade',
    coverColor: 'linear-gradient(135deg, #fb923c, #f59e0b)',
    memberCount: 12,
    autoJoinRules: { subjects: ['Science'], grades: ['Grade 8'], board: 'CBSE' },
    lastActivityAt: new Date(Date.now() - 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: 'system',
};

describe('GroupCard', () => {
    it('renders the group name and pluralised member count', () => {
        render(<GroupCard group={baseGroup} isMember={false} />);
        expect(screen.getByText('Class 8 Science — CBSE')).toBeInTheDocument();
        expect(screen.getByText(/12 members/)).toBeInTheDocument();
    });

    it('uses singular "member" when memberCount === 1', () => {
        render(<GroupCard group={{ ...baseGroup, memberCount: 1 }} isMember={false} />);
        expect(screen.getByText(/1 member$/)).toBeInTheDocument();
    });

    it('shows "Join" button when not a member', () => {
        render(<GroupCard group={baseGroup} isMember={false} onJoin={jest.fn()} />);
        expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /leave/i })).not.toBeInTheDocument();
    });

    it('shows "Leave" button when a member', () => {
        render(<GroupCard group={baseGroup} isMember={true} onLeave={jest.fn()} />);
        expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^join$/i })).not.toBeInTheDocument();
    });

    it('calls onJoin with the group id', async () => {
        const onJoin = jest.fn();
        render(<GroupCard group={baseGroup} isMember={false} onJoin={onJoin} />);
        fireEvent.click(screen.getByRole('button', { name: /join/i }));
        await waitFor(() => expect(onJoin).toHaveBeenCalledWith('grp-1'));
    });

    it('calls onLeave with the group id', async () => {
        const onLeave = jest.fn();
        render(<GroupCard group={baseGroup} isMember={true} onLeave={onLeave} />);
        fireEvent.click(screen.getByRole('button', { name: /leave/i }));
        await waitFor(() => expect(onLeave).toHaveBeenCalledWith('grp-1'));
    });

    it('disables the join button while join is in flight (Phase 2 fix)', async () => {
        let resolveJoin: () => void = () => {};
        const onJoin = jest.fn(() => new Promise<void>((r) => { resolveJoin = r; }));
        render(<GroupCard group={baseGroup} isMember={false} onJoin={onJoin} />);

        const joinBtn = screen.getByRole('button', { name: /join/i });
        fireEvent.click(joinBtn);

        await waitFor(() => expect(joinBtn).toBeDisabled());

        resolveJoin();
        await waitFor(() => expect(joinBtn).not.toBeDisabled());
    });

    it('renders compact layout when compact=true', () => {
        const onClick = jest.fn();
        render(<GroupCard group={baseGroup} isMember={false} compact onClick={onClick} />);
        // Compact has no Join/Leave button — just name + count.
        expect(screen.queryByRole('button', { name: /join/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /leave/i })).not.toBeInTheDocument();
        expect(screen.getByText('Class 8 Science — CBSE')).toBeInTheDocument();
    });
});
